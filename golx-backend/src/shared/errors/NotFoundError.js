const AppError = require('./AppError');

class NotFoundError extends AppError {
    constructor(resource = 'Resource', id = '') {
        const msg = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
        super(msg, 404, 'RESOURCE_NOT_FOUND');
    }
}

module.exports = NotFoundError;
