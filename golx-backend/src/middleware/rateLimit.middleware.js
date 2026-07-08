const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { redis, isRedisAvailable } = require('../infrastructure/redis');
const env = require('../config/env');
const ApiResponse = require('../shared/api-response');

/**
 * A resilient store wrapper that uses RedisStore if Redis is connected,
 * and seamlessly falls back to MemoryStore if Redis is offline or disabled.
 */
class ResilientStore {
    constructor(prefix) {
        this.prefix = prefix;
        this.memoryStore = new rateLimit.MemoryStore();
        this.redisStore = null;
        this.redisInitialized = false;
        this.options = null;
        this.redisEnabled = process.env.REDIS_ENABLED !== 'false';
    }

    _createRedisStore() {
        const store = new RedisStore({
            sendCommand: async (...args) => {
                return await redis.call(args[0], ...args.slice(1));
            },
            prefix: `goalix:ratelimit:${this.prefix}:`,
        });

        // rate-limit-redis@4 loads Lua scripts in the constructor. Keep those
        // promises observed so a Redis race does not surface as an unhandled rejection.
        store.incrementScriptSha?.catch(() => {});
        store.getScriptSha?.catch(() => {});

        if (this.options) store.init(this.options);
        return store;
    }

    async init(options) {
        this.options = options;
        this.memoryStore.init(options);
        // We will try to initialize RedisStore lazily in increment/decrement if not yet initialized
    }

    async _ensureRedisInitialized() {
        if (this.redisEnabled && isRedisAvailable() && !this.redisInitialized) {
            try {
                if (!this.redisStore) {
                    this.redisStore = this._createRedisStore();
                }
                // Initialize the store with default options
                this.redisStore.init(this.options || {});
                this.redisInitialized = true;
            } catch {
                this.redisInitialized = false;
            }
        }
    }

    async increment(key) {
        await this._ensureRedisInitialized();
        if (this.redisStore && isRedisAvailable() && this.redisInitialized) {
            try {
                return await this.redisStore.increment(key);
            } catch {
                // Fallback to memory store if Redis operation fails
                return await this.memoryStore.increment(key);
            }
        }
        return await this.memoryStore.increment(key);
    }

    async decrement(key) {
        await this._ensureRedisInitialized();
        if (this.redisStore && isRedisAvailable() && this.redisInitialized) {
            try {
                await this.redisStore.decrement(key);
                return;
            } catch {
                // Fallback to memory store
            }
        }
        await this.memoryStore.decrement(key);
    }

    async resetKey(key) {
        await this._ensureRedisInitialized();
        if (this.redisStore && isRedisAvailable() && this.redisInitialized) {
            try {
                await this.redisStore.resetKey(key);
                return;
            } catch {
                // Fallback to memory store
            }
        }
        await this.memoryStore.resetKey(key);
    }
}

const getStore = (prefix) => new ResilientStore(prefix);

// Use req.ip which is set correctly when app.set('trust proxy', 1) is configured.
const keyGenerator = (req) => req.ip;
const userAwareKeyGenerator = (req) => {
    if (req.user?.userId) return `${req.user.role || 'user'}:${req.user.userId}`;
    return keyGenerator(req);
};

/**
 * General API rate limiter for authenticated dashboards and realtime fallbacks.
 */
const apiLimiter = rateLimit({
    windowMs: env.API_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    store: getStore('api'),
    handler: (_req, res) => {
        res.status(429).json(
            ApiResponse.error('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later'),
        );
    },
});

/**
 * Auth endpoints rate limiter: 10 requests per 15 minutes
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    store: getStore('auth'),
    handler: (_req, res) => {
        res.status(429).json(
            ApiResponse.error('RATE_LIMIT_EXCEEDED', 'Too many authentication attempts, please try again later'),
        );
    },
});

/**
 * Admin credential submissions are protected by account lockout as well, so
 * keep this IP throttle high enough for normal admin + coach sign-in flows.
 */
const adminAuthLimiter = rateLimit({
    windowMs: env.ADMIN_AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.ADMIN_AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    store: getStore('admin_auth'),
    handler: (_req, res) => {
        res.status(429).json(
            ApiResponse.error('RATE_LIMIT_EXCEEDED', 'Too many admin authentication attempts, please try again later'),
        );
    },
});

const mfaAuthLimiter = rateLimit({
    windowMs: env.MFA_AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.MFA_AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    store: getStore('mfa_auth'),
    handler: (_req, res) => {
        res.status(429).json(
            ApiResponse.error('RATE_LIMIT_EXCEEDED', 'Too many MFA verification attempts, please try again later'),
        );
    },
});

const chatWriteLimiter = rateLimit({
    windowMs: env.CHAT_WRITE_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.CHAT_WRITE_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userAwareKeyGenerator,
    store: getStore('chat'),
    handler: (_req, res) => {
        res.status(429).json(
            ApiResponse.error('RATE_LIMIT_EXCEEDED', 'Too many chat actions, please try again later'),
        );
    },
});

const uploadLimiter = rateLimit({
    windowMs: env.UPLOAD_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.UPLOAD_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userAwareKeyGenerator,
    store: getStore('upload'),
    handler: (_req, res) => {
        res.status(429).json(
            ApiResponse.error('RATE_LIMIT_EXCEEDED', 'Too many uploads, please try again later'),
        );
    },
});

module.exports = {
    apiLimiter,
    authLimiter,
    adminAuthLimiter,
    mfaAuthLimiter,
    chatWriteLimiter,
    uploadLimiter,
};
