require('dotenv').config();

const env = require('../config/env');
const logger = require('../shared/logger');
const { connectRedis, isRedisAvailable, redis } = require('../infrastructure/redis');
const { connectDatabase } = require('../infrastructure/database');
const redisConnectionFromUrl = require('../infrastructure/redis-connection');
const { startWorkers, stopWorkers } = require('./index');
const { createApplicationServices } = require('../bootstrap/service-factory');
const { startBackgroundAutomations } = require('../bootstrap/background-automations');

let workers = null;
let backgroundAutomations = null;
let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down BullMQ worker process');

    try {
        backgroundAutomations?.stop?.();
        await stopWorkers(workers);
        await redis.quit();
        process.exit(exitCode);
    } catch (err) {
        logger.error({ err }, 'Failed to stop BullMQ worker process cleanly');
        process.exit(1);
    }
}

async function main() {
    await connectDatabase();
    await connectRedis();
    if (!isRedisAvailable()) {
        throw new Error('Redis is unavailable; BullMQ workers cannot start');
    }

    workers = startWorkers(redisConnectionFromUrl(env.REDIS_URL));
    backgroundAutomations = startBackgroundAutomations({
        services: createApplicationServices().services,
    });
    logger.info(
        { queues: Object.keys(workers), prefix: env.BULLMQ_PREFIX },
        'BullMQ worker process ready',
    );

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
        logger.fatal({ err }, 'Uncaught worker process exception');
        void shutdown('uncaughtException', 1);
    });
    process.on('unhandledRejection', (err) => {
        logger.fatal({ err }, 'Unhandled worker process rejection');
        void shutdown('unhandledRejection', 1);
    });
}

main().catch((err) => {
    logger.fatal({ err }, 'Failed to start BullMQ worker process');
    process.exit(1);
});
