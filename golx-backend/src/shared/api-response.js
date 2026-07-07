const { v4: uuidv4 } = require('uuid');

/**
 * Standardized API response builder
 */
class ApiResponse {
    static success(data, meta = {}) {
        return {
            success: true,
            data,
            meta: {
                requestId: meta.requestId || uuidv4(),
                timestamp: new Date().toISOString(),
                ...meta,
            },
        };
    }

    static paginated(data, pagination, meta = {}) {
        return {
            success: true,
            data,
            meta: {
                requestId: meta.requestId || uuidv4(),
                timestamp: new Date().toISOString(),
                pagination,
                ...meta,
            },
        };
    }

    static error(code, message, details = [], meta = {}) {
        return {
            success: false,
            error: {
                code,
                message,
                details,
            },
            meta: {
                requestId: meta.requestId || uuidv4(),
                timestamp: new Date().toISOString(),
            },
        };
    }
}

module.exports = ApiResponse;
