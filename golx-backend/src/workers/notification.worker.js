const { Worker } = require('bullmq');
const env = require('../config/env');
const logger = require('../shared/logger');

function deliveryProviderNotConfigured(job, metadata = {}) {
    const result = {
        skipped: true,
        reason: 'delivery_provider_not_configured',
        ...metadata,
    };
    logger.warn(
        { jobId: job.id, name: job.name, result },
        'Notifications worker skipped external delivery because no provider is configured',
    );
    return result;
}

/**
 * Notifications Worker
 * Jobs: deliver-notification, bulk-notification
 */
function createNotificationsWorker(redisConnection) {
    const worker = new Worker(
        `${env.BULLMQ_PREFIX}-notifications`,
        async (job) => {
            logger.debug({ jobId: job.id, name: job.name }, 'Notifications worker: processing');

            switch (job.name) {
                case 'deliver-notification': {
                    const { notificationId, channel, userId } = job.data;
                    return deliveryProviderNotConfigured(job, { notificationId, channel, userId });
                }
                case 'bulk-notification': {
                    const { academyId, type, channel, targetRole } = job.data;
                    return deliveryProviderNotConfigured(job, { academyId, type, channel, targetRole });
                }
                default:
                    logger.warn({ name: job.name }, 'Unknown notification job');
                    return { skipped: true, reason: 'unknown_job', name: job.name };
            }
        },
        { connection: redisConnection, concurrency: 5 }
    );

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, err: err.message }, 'Notifications worker: job failed');
    });

    return worker;
}

module.exports = createNotificationsWorker;
