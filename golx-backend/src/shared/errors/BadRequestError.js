const AppError = require('./AppError');

class BadRequestError extends AppError {
    constructor(message = 'Bad request', details = []) {
        super(message, 400, 'BAD_REQUEST', details);
    }
}

module.exports = BadRequestError;
