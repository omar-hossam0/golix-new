const knex = require('knex');
const env = require('../config/env');
const logger = require('../shared/logger');

const db = knex({
    client: 'pg',
    connection: {
        connectionString: env.DATABASE_URL,
        ssl: (env.DATABASE_SSL ?? env.NODE_ENV === 'production')
            ? { rejectUnauthorized: true }
            : false,
    },
    pool: {
        min: env.DB_POOL_MIN,
        max: env.DB_POOL_MAX,
        acquireTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        afterCreate(connection, done) {
            const statements = [
                `SET application_name TO '${String(env.DB_APPLICATION_NAME).replace(/'/g, "''")}'`,
                env.DB_STATEMENT_TIMEOUT_MS > 0
                    ? `SET statement_timeout TO ${env.DB_STATEMENT_TIMEOUT_MS}`
                    : null,
                env.DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS > 0
                    ? `SET idle_in_transaction_session_timeout TO ${env.DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS}`
                    : null,
                env.DB_LOCK_TIMEOUT_MS > 0
                    ? `SET lock_timeout TO ${env.DB_LOCK_TIMEOUT_MS}`
                    : null,
            ].filter(Boolean).join('; ');

            connection.query(statements, (err) => done(err, connection));
        },
    },
    acquireConnectionTimeout: 10000,
});

const activeQueries = new Map();

if (env.SLOW_QUERY_LOG_MS > 0) {
    const formatSqlForLog = (sql) => {
        const normalized = String(sql || '').replace(/\s+/g, ' ').trim();
        if (normalized.length <= env.SLOW_QUERY_SQL_MAX_CHARS) return normalized;
        return `${normalized.slice(0, env.SLOW_QUERY_SQL_MAX_CHARS)}… [truncated ${normalized.length - env.SLOW_QUERY_SQL_MAX_CHARS} chars]`;
    };

    db.on('query', (query) => {
        if (!query.__knexQueryUid) return;
        activeQueries.set(query.__knexQueryUid, {
            startedAt: process.hrtime.bigint(),
            sql: formatSqlForLog(query.sql),
        });
    });

    const finishQuery = (query, error = null) => {
        if (!query?.__knexQueryUid) return;
        const entry = activeQueries.get(query.__knexQueryUid);
        activeQueries.delete(query.__knexQueryUid);
        if (!entry) return;

        const durationMs = Number(process.hrtime.bigint() - entry.startedAt) / 1e6;
        if (durationMs < env.SLOW_QUERY_LOG_MS) return;

        logger.warn(
            {
                durationMs: Number(durationMs.toFixed(2)),
                sql: entry.sql,
                err: error || undefined,
            },
            error ? 'Slow PostgreSQL query failed' : 'Slow PostgreSQL query',
        );
    };

    db.on('query-response', (_response, query) => finishQuery(query));
    db.on('query-error', (error, query) => finishQuery(query, error));
}

const wait = (milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
});

async function connectDatabase({ attempts = 5, retryDelayMs = 2000 } = {}) {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            await db.raw('SELECT 1');
            logger.info('PostgreSQL connected');
            return;
        } catch (error) {
            lastError = error;
            if (attempt === attempts) break;
            logger.warn(
                { attempt, attempts, message: error.message },
                'PostgreSQL connection attempt failed; retrying',
            );
            await wait(retryDelayMs);
        }
    }

    throw lastError;
}

module.exports = db;
module.exports.connectDatabase = connectDatabase;
