require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { randomUUID } = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const { corsOrigin, isAllowedOrigin } = require('./config/cors');
const logger = require('./shared/logger');
const db = require('./infrastructure/database');
const { isRedisAvailable } = require('./infrastructure/redis');
const { auditQueue } = require('./infrastructure/queue');
const errorHandler = require('./middleware/errorHandler.middleware');
const { authMiddleware } = require('./middleware/auth.middleware');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const { requireCsrfToken, setCsrfCookie } = require('./middleware/csrf.middleware');
const {
    noStoreApiResponses,
    rejectCrossSiteMutations,
    setSecureUploadHeaders,
} = require('./middleware/security.middleware');
const ApiResponse = require('./shared/api-response');
const storage = require('./shared/storage');
const { canAccessMediaFile } = require('./shared/upload-access');
const { auditAccessDenied } = require('./shared/access-audit');
const { createApplicationServices } = require('./bootstrap/service-factory');
const { mountApplicationRoutes } = require('./bootstrap/route-registry');
const { startBackgroundAutomations } = require('./bootstrap/background-automations');

const { controllers, services } = createApplicationServices();
const { chatService } = services;

const app = express();
app.locals.services = { chatService };
app.locals.backgroundAutomations = startBackgroundAutomations({ services });

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
    req.id = req.get('x-request-id') || randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
});

app.use((req, res, next) => {
    if (env.SLOW_REQUEST_LOG_MS <= 0) return next();
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        if (durationMs < env.SLOW_REQUEST_LOG_MS) return;

        logger.warn(
            {
                requestId: req.id,
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Number(durationMs.toFixed(2)),
            },
            'Slow HTTP request',
        );
    });

    return next();
});

app.use(helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: false,
}));
app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Authorization',
        'Content-Type',
        'X-CSRF-Token',
        'X-File-Name',
        'X-Confirm-Username',
    ],
}));
app.use(compression());
app.use(hpp());
app.use(cookieParser(env.COOKIE_SECRET));
app.use('/api/', noStoreApiResponses);
app.use(rejectCrossSiteMutations);
app.use(setCsrfCookie);
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    if (isAllowedOrigin(origin)) return next();

    return res.status(403).json({
        success: false,
        error: { code: 'CSRF_ORIGIN_REJECTED', message: 'Request origin is not allowed' },
    });
});
app.use(requireCsrfToken);

const sensitiveAuditTargets = [
    { prefix: '/api/v1/admin', entityType: 'admin_api' },
    { prefix: '/api/admin', entityType: 'admin_api' },
    { prefix: '/api/v1/auth/register', entityType: 'auth_users' },
    { prefix: '/api/v1/auth/2fa', entityType: 'auth_2fa' },
    { prefix: '/api/v1/players', entityType: 'player' },
    { prefix: '/api/v1/coaches', entityType: 'coach' },
    { prefix: '/api/v1/payments', entityType: 'payment' },
    { prefix: '/api/v1/academy', entityType: 'academy_settings' },
    { prefix: '/api/v1/chat', entityType: 'chat' },
];

app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

    const auditTarget = sensitiveAuditTargets.find((target) => req.originalUrl.startsWith(target.prefix));
    if (!auditTarget) return next();

    res.on('finish', () => {
        if (!req.user?.userId) return;
        const routePath = req.route?.path || req.path;
        const normalizedPath = String(routePath).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        
        const logData = {
            user_id: req.user.userId,
            action: `${auditTarget.entityType}_${req.method.toLowerCase()}_${normalizedPath || 'mutation'}`,
            table_name: auditTarget.entityType,
            record_id: req.user.userId,
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
            session_jti: req.user.sessionId || null,
            metadata: JSON.stringify({
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                requestId: req.id,
            }),
        };

        const queueEnabled = process.env.BULLMQ_ENABLED !== 'false' && env.NODE_ENV !== 'test';
        if (queueEnabled && isRedisAvailable() && auditQueue) {
            auditQueue.add('log', logData).catch((err) => {
                logger.warn({ err, requestId: req.id }, 'Failed to queue audit log, attempting direct insert fallback');
                db('audit_logs').insert(logData).catch((dbErr) => {
                    logger.warn({ err: dbErr, requestId: req.id }, 'Failed to write sensitive audit log in fallback');
                });
            });
        } else {
            db('audit_logs').insert(logData).catch((err) => {
                logger.warn({ err, requestId: req.id }, 'Failed to write sensitive audit log directly');
            });
        }
    });

    return next();
});

app.use('/api/', apiLimiter);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req, res) => {
    const checks = {
        postgres: { ok: false },
        redis: { ok: isRedisAvailable(), optional: true },
    };

    try {
        await db.raw('SELECT 1');
        checks.postgres.ok = true;
    } catch (err) {
        checks.postgres.error = err.message;
    }

    const ok = checks.postgres.ok;
    res.status(ok ? 200 : 503).json({
        status: ok && checks.redis.ok ? 'ready' : ok ? 'degraded' : 'not_ready',
        timestamp: new Date().toISOString(),
        checks,
    });
});

app.get('/api/v1/csrf-token', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(ApiResponse.success({ csrfToken: res.locals.csrfToken }));
});

app.get('/uploads/*', authMiddleware, async (req, res, next) => {
    try {
        const relativePath = req.params[0] || '';
        const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
        const upload = await storage.getUpload(relativePath);
        if (!upload) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_FILE_PATH', message: 'Invalid file path' },
            });
        }

        if (normalizedPath.startsWith('chat/')) {
            const attachmentUrl = `/uploads/${normalizedPath}`;
            const allowed = await chatService.canUserAccessAttachment(req.user, attachmentUrl);
            if (!allowed) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'File not found' },
                });
            }
        } else {
            const mediaFile = await storage.findUploadMetadata(normalizedPath);
            const allowedByMetadata = mediaFile && await canAccessMediaFile(req.user, mediaFile, db);
            const pathParts = normalizedPath.split('/');
            const legacyScope = pathParts[0];
            const legacyAcademyId = pathParts[1];
            const sensitiveLegacyScopes = new Set(['assignments', 'player-assignments']);
            const publicLegacyScopes = new Set(['coaches']);
            const allowedLegacySameAcademy = !mediaFile
                && legacyAcademyId
                && legacyAcademyId === req.user.academyId
                && (
                    publicLegacyScopes.has(legacyScope)
                    || (sensitiveLegacyScopes.has(legacyScope) && ['admin', 'coach'].includes(req.user.role))
                );

            if (!allowedByMetadata && !allowedLegacySameAcademy) {
                if (mediaFile?.is_sensitive !== false) {
                    await auditAccessDenied(db, req.user, {
                        action: 'upload_access_denied',
                        entityType: 'media_files',
                        entityId: mediaFile?.id || null,
                        reason: mediaFile ? 'policy_denied' : 'metadata_missing',
                    });
                }
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'File not found' },
                });
            }
        }

        setSecureUploadHeaders(res, normalizedPath);
        res.setHeader('Cache-Control', 'private, max-age=604800');
        if (upload.type === 'stream') {
            if (upload.contentType) res.setHeader('Content-Type', upload.contentType);
            if (upload.contentLength) res.setHeader('Content-Length', String(upload.contentLength));
            upload.body.on('error', next);
            return upload.body.pipe(res);
        }
        return res.sendFile(upload.path, (err) => {
            if (err) next(err);
        });
    } catch (err) {
        return next(err);
    }
});

mountApplicationRoutes(app, controllers);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
    });
});

app.use(errorHandler);

module.exports = app;
