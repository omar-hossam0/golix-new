require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const env = require('./config/env');
const logger = require('./shared/logger');
const { connectRedis, isRedisAvailable } = require('./infrastructure/redis');
const {
    buildRedisConnection,
    startWorkers,
    stopWorkers,
} = require('./workers');

let workers = null;

async function main() {
    if (process.env.BULLMQ_ENABLED === 'false') {
        logger.info('BullMQ is disabled; worker process will exit');
        return;
    }

    await connectRedis();
    if (!isRedisAvailable()) {
        throw new Error('Redis is unavailable; cannot start BullMQ workers');
    }

    workers = startWorkers(buildRedisConnection(env.REDIS_URL));
    logger.info('GOALIX worker process is ready');

    const shutdown = async (signal) => {
        logger.info({ signal }, 'Stopping worker process...');
        await stopWorkers(workers);
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
    logger.fatal({ err }, 'Failed to start worker process');
    process.exit(1);
});
