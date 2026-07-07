const pino = require('pino');
const env = require('../config/env');

const logger = pino({
    level: env.LOG_LEVEL || 'info',
    transport:
        env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
            : undefined,
    base: { service: 'goalix-api' },
    serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
    },
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            '*.password',
            '*.token',
            '*.refreshToken',
        ],
        censor: '[REDACTED]',
    },
});

module.exports = logger;
