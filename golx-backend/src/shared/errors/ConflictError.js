const AppError = require('./AppError');

class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409, 'CONFLICT');
    }
}

module.exports = ConflictError;
