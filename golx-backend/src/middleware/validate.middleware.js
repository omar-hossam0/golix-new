const { ValidationError } = require('../shared/errors');

/**
 * Validate middleware — validates request body/query/params against a Zod schema.
 * @param {Object} schemas - { body?, query?, params? } — Zod schemas
 */
const validate = (schemas) => (req, _res, next) => {
    const errors = [];

    if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
            errors.push(
                ...result.error.issues.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                    source: 'body',
                })),
            );
        } else {
            req.body = result.data;
        }
    }

    if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
            errors.push(
                ...result.error.issues.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                    source: 'query',
                })),
            );
        } else {
            req.query = result.data;
        }
    }

    if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
            errors.push(
                ...result.error.issues.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                    source: 'params',
                })),
            );
        } else {
            req.params = result.data;
        }
    }

    if (errors.length) {
        return next(new ValidationError(errors));
    }

    next();
};

module.exports = validate;
