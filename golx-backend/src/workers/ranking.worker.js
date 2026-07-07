const { Worker } = require('bullmq');
const env = require('../config/env');
const logger = require('../shared/logger');

function rankingJobSkipped(job, metadata = {}) {
    const result = {
        skipped: true,
        reason: 'ranking_worker_not_connected_to_model',
        ...metadata,
    };
    logger.warn({ jobId: job.id, name: job.name, result }, 'Rankings worker skipped job because ranking model execution is not wired here');
    return result;
}

/**
 * Rankings Worker
 * Jobs: recalculate-rankings (weekly / monthly)
 */
function createRankingsWorker(redisConnection) {
    const worker = new Worker(
        `${env.BULLMQ_PREFIX}-rankings`,
        async (job) => {
            const { type } = job.data;
            logger.debug({ jobId: job.id, type }, 'Rankings worker: processing');

            return rankingJobSkipped(job, { type });
        },
        { connection: redisConnection, concurrency: 2 }
    );

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, err: err.message }, 'Rankings worker: job failed');
    });

    return worker;
}

module.exports = createRankingsWorker;
