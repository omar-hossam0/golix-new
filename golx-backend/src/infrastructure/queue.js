const { Queue } = require('bullmq');
const env = require('../config/env');
const logger = require('../shared/logger');
const redisConnectionFromUrl = require('./redis-connection');
const { isRedisAvailable } = require('./redis');

const redisConnection = redisConnectionFromUrl(env.REDIS_URL);

const bullmqEnabled =
    process.env.BULLMQ_ENABLED !== 'false' && env.NODE_ENV !== 'test';

const redisUnavailableWarnings = new Set();

const isRedisConnectionError = (err) => {
    if (!err) return false;
    if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(err.code)) return true;
    return String(err.message || '').toLowerCase().includes('redis');
};

const warnRedisUnavailableOnce = (name) => {
    if (redisUnavailableWarnings.has(name)) return;
    redisUnavailableWarnings.add(name);
    logger.warn(
        { queue: name },
        'Redis unavailable; BullMQ queue is disabled and jobs will be skipped until Redis is available',
    );
};

const createNoopQueue = (name) => ({
    add: async (jobName) => {
        logger.debug({ queue: name, jobName }, 'BullMQ disabled; skipping queued job');
        return { id: null, name: jobName, skipped: true };
    },
    close: async () => null,
});

const createQueue = (name) => {
    if (!bullmqEnabled) return createNoopQueue(name);

    let queue = null;

    const getQueue = () => {
        if (!isRedisAvailable()) {
            warnRedisUnavailableOnce(name);
            return null;
        }

        if (queue) return queue;

        queue = new Queue(`${env.BULLMQ_PREFIX}-${name}`, {
            connection: redisConnection,
            defaultJobOptions: {
                removeOnComplete: { count: 1000 },
                removeOnFail: { count: 5000 },
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
            },
        });

        queue.on('error', (err) => {
            if (isRedisConnectionError(err)) {
                warnRedisUnavailableOnce(name);
                return;
            }
            logger.error({ err, queue: name }, 'Queue error');
        });

        return queue;
    };

    return {
        add: async (jobName, payload, options) => {
            const activeQueue = getQueue();
            if (!activeQueue) {
                return { id: null, name: jobName, skipped: true };
            }

            try {
                return await activeQueue.add(jobName, payload, options);
            } catch (err) {
                if (isRedisConnectionError(err)) {
                    warnRedisUnavailableOnce(name);
                    return { id: null, name: jobName, skipped: true };
                }
                throw err;
            }
        },
        close: async () => {
            if (queue) await queue.close();
        },
    };
};

const rankingsQueue = createQueue('rankings');
const notificationsQueue = createQueue('notifications');
const paymentsQueue = createQueue('payments');
const aiQueue = createQueue('ai');
const auditQueue = createQueue('audit');

module.exports = {
    createQueue,
    rankingsQueue,
    notificationsQueue,
    paymentsQueue,
    aiQueue,
    auditQueue,
};
