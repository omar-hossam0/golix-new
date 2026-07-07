const Redis = require('ioredis');
const env = require('../config/env');
const logger = require('../shared/logger');

const redisEnabled = process.env.REDIS_ENABLED !== 'false';

const noopRedis = {
    connect: async () => null,
    get: async () => null,
    set: async () => null,
    del: async () => 0,
    incr: async () => 0,
    expire: async () => 0,
    sadd: async () => 0,
    srem: async () => 0,
    smembers: async () => [],
    quit: async () => null,
    disconnect: () => null,
};

const redis = redisEnabled
    ? new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
            if (times > 3) return null; // stop retrying after 3 attempts
            return Math.min(times * 200, 1000);
        },
        lazyConnect: true,
        enableOfflineQueue: false,
    })
    : noopRedis;

let redisAvailable = false;
let redisWarningShown = false;

if (redisEnabled) {
    redis.on('connect', () => {
        const recovered = redisWarningShown;
        redisAvailable = true;
        redisWarningShown = false;
        logger[recovered ? 'info' : 'debug']('Redis connected');
    });
    redis.on('close', () => {
        redisAvailable = false;
    });
    redis.on('error', (err) => {
        redisAvailable = false;
        if (redisWarningShown) return;
        redisWarningShown = true;
        logger.warn(
            { message: err.message, code: err.code },
            'Redis unavailable; caching, queues, and distributed locks are disabled',
        );
    });
}

const connectRedis = async () => {
    if (!redisEnabled) {
        logger.info('Redis disabled for this environment');
        redisAvailable = false;
        return;
    }

    if (redis.status === 'ready') {
        redisAvailable = true;
        return;
    }

    try {
        await redis.connect();
        redisAvailable = true;
    } catch (err) {
        if (!redisWarningShown) {
            redisWarningShown = true;
            logger.warn(
                { message: err.message, code: err.code },
                'Redis connection failed; continuing without optional Redis features',
            );
        }
        redisAvailable = false;
    }
};

const isRedisAvailable = () => redisAvailable;

module.exports = { redis, connectRedis, isRedisAvailable };
