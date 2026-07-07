const logger = require('../shared/logger');
const createRankingsWorker = require('./ranking.worker');
const createNotificationsWorker = require('./notification.worker');
const createPaymentsWorker = require('./payment.worker');
const createAiWorker = require('./ai.worker');
const createAuditWorker = require('./audit.worker');

function buildRedisConnection(redisUrl) {
    const url = new URL(redisUrl);
    return {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
        ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
        ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    };
}

function buildRedisConnection(redisUrl) {
    const url = new URL(redisUrl);
    return {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
        ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
        ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    };
}

/**
 * Initialize all BullMQ workers.
 * Call this after Redis is connected.
 */
function startWorkers(redisConnection) {
    const workers = {
        rankings: createRankingsWorker(redisConnection),
        notifications: createNotificationsWorker(redisConnection),
        payments: createPaymentsWorker(redisConnection),
        ai: createAiWorker(redisConnection),
        audit: createAuditWorker(redisConnection),
    };

    logger.info('All BullMQ workers started');

    return workers;
}

async function stopWorkers(workers) {
    if (!workers) return;
    const names = Object.keys(workers);
    await Promise.all(names.map((name) => workers[name].close()));
    logger.info('All BullMQ workers stopped');
}

module.exports = { buildRedisConnection, startWorkers, stopWorkers };
