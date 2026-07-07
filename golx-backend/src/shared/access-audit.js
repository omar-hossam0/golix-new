const logger = require('./logger');

async function auditAccessDenied(db, user, {
    action,
    entityType,
    entityId,
    reason,
    requestId,
} = {}) {
    const payload = {
        user_id: user?.userId || null,
        action: action || 'access_denied',
        table_name: entityType || 'access_policy',
        record_id: entityId || user?.userId || null,
        metadata: JSON.stringify({
            reason,
            role: user?.role || null,
            academyId: user?.academyId || null,
            requestId: requestId || null,
        }),
    };

    try {
        await db('audit_logs').insert(payload);
    } catch (err) {
        logger.warn({ err, payload }, 'Failed to write access denial audit log');
    }
}

module.exports = { auditAccessDenied };
