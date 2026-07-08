const { z } = require('zod');

const optionalBoolean = z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional();
const databaseSsl = z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional();
const DEFAULT_COOKIE_SECRET = 'change-this-to-a-random-32-char-secret-in-production';
const PLACEHOLDER_SECRET_MARKERS = [
    'replace-with',
    'replace-me',
    'change-this',
    'please-change',
    'placeholder',
    'example',
    'your-',
];

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    ENABLE_HTTPS: optionalBoolean,
    ENABLE_HSTS: optionalBoolean,

    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_SSL: databaseSsl,
    DB_POOL_MIN: z.coerce.number().int().min(0).default(2),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    DB_APPLICATION_NAME: z.string().min(1).default('goalix-api'),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(0).default(30000),
    DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS: z.coerce.number().int().min(0).default(10000),
    DB_LOCK_TIMEOUT_MS: z.coerce.number().int().min(0).default(5000),

    // Redis
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    REDIS_REQUIRED: optionalBoolean,
    AUTH_SESSION_CACHE_TTL_SECONDS: z.coerce.number().int().min(30).default(900),
    AUTH_SESSION_LAST_SEEN_INTERVAL_SECONDS: z.coerce.number().int().min(30).default(300),
    AUTH_SESSION_LAST_SEEN_JITTER_SECONDS: z.coerce.number().int().min(0).default(60),
    AUTH_USER_CACHE_TTL_SECONDS: z.coerce.number().int().min(5).default(120),
    AUTH_PERMISSIONS_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(30),
    ACADEMY_BRANCHES_CACHE_TTL_SECONDS: z.coerce.number().int().min(5).default(120),
    NOTIFICATION_UNREAD_COUNT_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(30),
    NOTIFICATION_RETENTION_MONTHS: z.coerce.number().int().min(1).default(4),
    NOTIFICATION_CLEANUP_INTERVAL_HOURS: z.coerce.number().int().min(1).default(24),
    NOTIFICATION_CLEANUP_ENABLED: optionalBoolean,
    CHAT_CONVERSATIONS_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(15),
    AUTH_EPHEMERAL_RETENTION_DAYS: z.coerce.number().int().min(7).max(365).default(30),

    // JWT
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACTIVE_KID: z.string().min(1).default('v1'),
    JWT_SECRET_PREVIOUS: z.string().min(32).optional(),
    JWT_REFRESH_SECRET_PREVIOUS: z.string().min(32).optional(),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),

    // BullMQ
    BULLMQ_PREFIX: z.string().default('goalix'),
    BULLMQ_WORKERS_ENABLED: optionalBoolean,
    QUEUE_REDIS_FAILURE_MODE: z.enum(['skip', 'throw']).default('skip'),
    BACKGROUND_AUTOMATIONS_ENABLED: optionalBoolean,
    INJURY_RISK_AUTOMATION_ENABLED: optionalBoolean,
    DATA_LIFECYCLE_ENABLED: optionalBoolean,
    DATA_LIFECYCLE_INTERVAL_HOURS: z.coerce.number().int().min(1).default(24),
    DATA_LIFECYCLE_BATCH_SIZE: z.coerce.number().int().min(1).max(10000).default(1000),

    // CORS
    CORS_ORIGINS: z.string().default('http://localhost:3001'),

    // Bcrypt
    BCRYPT_ROUNDS: z.coerce.number().min(10).max(15).default(12),

    // Pagination
    DEFAULT_PAGE_LIMIT: z.coerce.number().default(20),
    MAX_PAGE_LIMIT: z.coerce.number().default(100),
    API_RATE_LIMIT_MAX: z.coerce.number().default(1000),
    API_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(15),
    CHAT_WRITE_RATE_LIMIT_MAX: z.coerce.number().default(120),
    CHAT_WRITE_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(15),
    UPLOAD_RATE_LIMIT_MAX: z.coerce.number().default(60),
    UPLOAD_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(15),
    AI_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
    AI_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),

    // Account Lockout
    MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().default(5),
    LOCKOUT_DURATION_MINUTES: z.coerce.number().default(15),
    ADMIN_MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().default(3),
    ADMIN_LOCKOUT_DURATION_MINUTES: z.coerce.number().default(30),

    // TOTP 2FA
    TOTP_ISSUER: z.string().default('GOALIX Academy'),
    MFA_ENFORCED_ROLES: z.string().default('admin,coach'),
    TOTP_ENCRYPTION_KEY: z.string().optional(),

    // Admin Login Rate Limit
    ADMIN_AUTH_RATE_LIMIT_MAX: z.coerce.number().default(5),
    ADMIN_AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(15),
    AUTH_ACCOUNT_RATE_LIMIT_MAX: z.coerce.number().int().min(3).default(10),
    AUTH_ACCOUNT_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),

    // Cookie signing secret
    COOKIE_SECRET: z.string().min(32).default(DEFAULT_COOKIE_SECRET),
    CSRF_SECRET: z.string().min(32).optional(),
    QR_ATTENDANCE_SECRET: z.string().min(32).optional(),

    // Storage / backup documentation defaults
    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    ALLOW_LOCAL_UPLOAD_STORAGE_IN_PRODUCTION: optionalBoolean,
    UPLOAD_LEGACY_METADATA_FALLBACK_ENABLED: optionalBoolean,
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    BACKUP_RPO_MINUTES: z.coerce.number().int().min(1).default(15),
    BACKUP_RTO_MINUTES: z.coerce.number().int().min(1).default(120),
    BACKUP_DIR: z.string().min(1).default('backups'),
    BACKUP_AUTOMATION_ENABLED: optionalBoolean,
    BACKUP_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(1440),
    BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).default(14),
    BACKUP_RESTORE_ENABLED: optionalBoolean,

    // HTTP server
    HTTP_LISTEN_BACKLOG: z.coerce.number().int().min(128).default(8192),
    HTTP_KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(65000),
    HTTP_HEADERS_TIMEOUT_MS: z.coerce.number().int().min(2000).default(66000),
    HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(120000),

    // Observability
    SLOW_QUERY_LOG_MS: z.coerce.number().int().min(0).default(250),
    SLOW_QUERY_SQL_MAX_CHARS: z.coerce.number().int().min(200).default(2000),
    SLOW_REQUEST_LOG_MS: z.coerce.number().int().min(0).default(1000),
    METRICS_ENABLED: optionalBoolean,
    METRICS_TOKEN: z.string().min(24).optional(),
});

function configIssue(path, message) {
    return new z.ZodError([
        {
            code: z.ZodIssueCode.custom,
            path: [path],
            message,
        },
    ]);
}

function isValidAes256Key(value) {
    if (!value) return false;
    const raw = value.trim();
    if (/^[a-f0-9]{64}$/i.test(raw)) return true;
    return Buffer.from(raw, 'base64').length === 32;
}

function isPlaceholderSecret(value) {
    if (!value) return false;
    const raw = String(value).trim();
    const normalized = raw.toLowerCase();
    if (PLACEHOLDER_SECRET_MARKERS.some((marker) => normalized.includes(marker))) return true;
    if (/^(0123456789abcdef)+$/i.test(raw)) return true;
    if (/^(.)\1{31,}$/.test(raw)) return true;
    return false;
}

function assertProductionSecret(env, key, { required = true } = {}) {
    const value = env[key];
    if (!value) {
        if (required) throw configIssue(key, `${key} is required in production`);
        return;
    }
    if (isPlaceholderSecret(value)) {
        throw configIssue(
            key,
            `${key} must be a unique random production secret, not an example or placeholder value`,
        );
    }
}

let env;
try {
    env = envSchema.parse(process.env);
    if (env.DB_POOL_MIN > env.DB_POOL_MAX) {
        throw configIssue('DB_POOL_MIN', 'DB_POOL_MIN must be less than or equal to DB_POOL_MAX');
    }
    if (env.NODE_ENV === 'production' && env.COOKIE_SECRET === DEFAULT_COOKIE_SECRET) {
        throw configIssue('COOKIE_SECRET', 'COOKIE_SECRET must be set to a unique production secret');
    }
    if (env.NODE_ENV === 'production') {
        [
            'JWT_SECRET',
            'JWT_REFRESH_SECRET',
            'COOKIE_SECRET',
            'TOTP_ENCRYPTION_KEY',
        ].forEach((key) => assertProductionSecret(env, key));
        [
            'JWT_SECRET_PREVIOUS',
            'JWT_REFRESH_SECRET_PREVIOUS',
            'CSRF_SECRET',
            'QR_ATTENDANCE_SECRET',
            'METRICS_TOKEN',
        ].forEach((key) => assertProductionSecret(env, key, { required: false }));

        if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
            throw configIssue('JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET must be different from JWT_SECRET');
        }
        if (env.CSRF_SECRET && env.CSRF_SECRET === env.COOKIE_SECRET) {
            throw configIssue('CSRF_SECRET', 'CSRF_SECRET must be different from COOKIE_SECRET');
        }
    }
    if (env.NODE_ENV === 'production' && env.REDIS_REQUIRED !== true) {
        throw configIssue('REDIS_REQUIRED', 'REDIS_REQUIRED=true is required in production so cache and realtime dependencies fail fast');
    }
    if (env.NODE_ENV === 'production' && env.QUEUE_REDIS_FAILURE_MODE !== 'throw') {
        throw configIssue('QUEUE_REDIS_FAILURE_MODE', 'QUEUE_REDIS_FAILURE_MODE=throw is required in production so queued jobs are not silently skipped');
    }
    if (env.NODE_ENV === 'production' && !env.TOTP_ENCRYPTION_KEY) {
        throw configIssue('TOTP_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY is required in production for app-level TOTP secret encryption');
    }
    if (env.NODE_ENV === 'production' && !env.CSRF_SECRET) {
        throw configIssue('CSRF_SECRET', 'CSRF_SECRET is required in production');
    }
    if (env.NODE_ENV === 'production' && env.BCRYPT_ROUNDS < 12) {
        throw configIssue('BCRYPT_ROUNDS', 'BCRYPT_ROUNDS must be at least 12 in production');
    }
    if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
        throw configIssue('JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET must be different from JWT_SECRET');
    }
    if (env.JWT_SECRET_PREVIOUS && env.JWT_SECRET_PREVIOUS === env.JWT_SECRET) {
        throw configIssue('JWT_SECRET_PREVIOUS', 'JWT_SECRET_PREVIOUS must be different from JWT_SECRET');
    }
    if (env.JWT_REFRESH_SECRET_PREVIOUS && env.JWT_REFRESH_SECRET_PREVIOUS === env.JWT_REFRESH_SECRET) {
        throw configIssue('JWT_REFRESH_SECRET_PREVIOUS', 'JWT_REFRESH_SECRET_PREVIOUS must be different from JWT_REFRESH_SECRET');
    }
    if (
        env.NODE_ENV === 'production' &&
        env.CORS_ORIGINS.split(',').some((origin) => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(origin))
    ) {
        throw configIssue('CORS_ORIGINS', 'Production CORS_ORIGINS must not include localhost or wildcard development hosts');
    }
    if (env.TOTP_ENCRYPTION_KEY && !isValidAes256Key(env.TOTP_ENCRYPTION_KEY)) {
        throw configIssue('TOTP_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY must be a 32-byte base64 value or 64-character hex value');
    }
    if (env.NODE_ENV === 'production' && env.METRICS_ENABLED && !env.METRICS_TOKEN) {
        throw configIssue('METRICS_TOKEN', 'METRICS_TOKEN is required when production metrics are enabled');
    }
    if (env.STORAGE_PROVIDER === 's3') {
        const missing = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
            .filter((key) => !env[key]);
        if (missing.length) {
            throw configIssue('STORAGE_PROVIDER', `S3 storage requires: ${missing.join(', ')}`);
        }
    }
    if (
        env.NODE_ENV === 'production'
        && env.STORAGE_PROVIDER === 'local'
        && env.ALLOW_LOCAL_UPLOAD_STORAGE_IN_PRODUCTION !== true
    ) {
        throw configIssue(
            'STORAGE_PROVIDER',
            'STORAGE_PROVIDER=s3 is required in production unless ALLOW_LOCAL_UPLOAD_STORAGE_IN_PRODUCTION=true is set for a managed shared volume',
        );
    }
} catch (err) {
    console.error('Environment validation failed:');
    console.error(err.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n'));
    process.exit(1);
}

module.exports = env;
