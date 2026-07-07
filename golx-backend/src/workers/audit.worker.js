const { Worker } = require('bullmq');
const env = require('../config/env');
const db = require('../infrastructure/database');
const logger = require('../shared/logger');

/**
 * Audit Worker
 * Jobs: log
 */
function createAuditWorker(redisConnection) {
    const worker = new Worker(
        `${env.BULLMQ_PREFIX}-audit`,
        async (job) => {
            const auditData = job.data;
            logger.debug({ jobId: job.id, action: auditData.action }, 'Audit worker: processing log');
            
            // Insert log into Postgres
            await db('audit_logs').insert(auditData);
            
            return { success: true };
        },
        { connection: redisConnection, concurrency: 5 }
    );

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, err: err.message }, 'Audit worker: job failed');
    });

    return worker;
}

module.exports = createAuditWorker;
