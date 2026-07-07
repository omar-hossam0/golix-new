const logger = require('../shared/logger');
const ApiResponse = require('../shared/api-response');
const { AppError } = require('../shared/errors');

const isJsonParseError = (err) => (
    err instanceof SyntaxError
    && err.status === 400
    && err.type === 'entity.parse.failed'
);

const databaseErrorResponse = (err) => {
    const code = String(err.code || '');

    if (code === '23505') {
        return {
            statusCode: 409,
            code: 'DUPLICATE_ENTRY',
            message: 'A record with this value already exists',
            details: [{
                reason: 'UNIQUE_CONSTRAINT',
                solution: 'Use a different value, or update the existing record.',
            }],
        };
    }
    if (code === '23503') {
        return {
            statusCode: 409,
            code: 'RESOURCE_STILL_LINKED',
            message: 'This item is still linked to other records',
            details: [{
                reason: 'FOREIGN_KEY_CONSTRAINT',
                solution: 'Remove or move the linked records before trying again.',
            }],
        };
    }
    if (code === '23502') {
        return {
            statusCode: 400,
            code: 'REQUIRED_FIELD_MISSING',
            message: 'A required value is missing',
            details: [],
        };
    }
    if (code === '23514' || code === '22P02') {
        return {
            statusCode: 400,
            code: 'INVALID_VALUE',
            message: 'One of the submitted values is invalid',
            details: [],
        };
    }
    if (code === '40001' || code === '40P01') {
        return {
            statusCode: 409,
            code: 'REQUEST_CONFLICT',
            message: 'The data changed while processing the request. Please try again.',
            details: [{ retryable: true }],
        };
    }
    if (code === '57014') {
        return {
            statusCode: 504,
            code: 'DATABASE_TIMEOUT',
            message: 'The request took too long. Please try again.',
            details: [{ retryable: true }],
        };
    }
    if (
        code.startsWith('08') ||
        ['57P01', '57P02', '57P03', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(code)
    ) {
        return {
            statusCode: 503,
            code: 'SERVICE_UNAVAILABLE',
            message: 'The service is temporarily unavailable. Please try again.',
            details: [{ retryable: true }],
        };
    }

    return null;
};

const sendError = (res, requestId, error) => res.status(error.statusCode).json(
    ApiResponse.error(error.code, error.message, error.details || [], { requestId }),
);

/**
 * Global error handler middleware. Must be registered last in Express.
 */
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const requestId = req.id;
    const jsonParseError = isJsonParseError(err);
    const databaseError = databaseErrorResponse(err);
    const isOperational = err instanceof AppError || jsonParseError || Boolean(databaseError);

    const statusCode = jsonParseError
        ? 400
        : databaseError?.statusCode || Number(err.statusCode || 500);

    if (!isOperational) {
        logger.error(
            {
                err,
                requestId,
                url: req.originalUrl,
                method: req.method,
                userId: req.user?.userId,
            },
            'Unhandled error',
        );
    } else if (statusCode === 403 || statusCode === 429) {
        logger.warn(
            {
                code: err.code,
                statusCode,
                url: req.originalUrl,
                method: req.method,
                requestId,
            },
            err.message,
        );
    } else {
        logger.debug(
            {
                code: err.code,
                statusCode,
                url: req.originalUrl,
                method: req.method,
                requestId,
            },
            err.message,
        );
    }

    if (jsonParseError) {
        return res.status(400).json(
            ApiResponse.error('INVALID_JSON', 'Malformed JSON request body', [], { requestId }),
        );
    }

    if (err instanceof AppError) {
        return sendError(res, requestId, err);
    }

    if (databaseError) {
        return sendError(res, requestId, databaseError);
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json(
            ApiResponse.error('INVALID_TOKEN', 'Invalid token', [], { requestId }),
        );
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json(
            ApiResponse.error('TOKEN_EXPIRED', 'Token expired', [], { requestId }),
        );
    }

    return res.status(500).json(
        ApiResponse.error(
            'INTERNAL_ERROR',
            'Internal server error',
            [],
            { requestId },
        ),
    );
};

module.exports = errorHandler;
module.exports.databaseErrorResponse = databaseErrorResponse;
