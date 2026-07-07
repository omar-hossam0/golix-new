const AppError = require('./AppError');

class ForbiddenError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'FORBIDDEN');
    }
}

module.exports = ForbiddenError;
