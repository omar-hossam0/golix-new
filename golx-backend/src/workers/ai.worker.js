const { Worker } = require('bullmq');
const env = require('../config/env');
const logger = require('../shared/logger');

function providerNotConfigured(job, feature, metadata = {}) {
    const result = {
        skipped: true,
        reason: 'provider_not_configured',
        feature,
        ...metadata,
    };
    logger.warn({ jobId: job.id, name: job.name, result }, 'AI worker skipped job because no provider is configured');
    return result;
}

/**
 * AI Worker
 * Jobs: calculate-performance, assess-injury-risk, generate-nutrition-plan, ai-chat
 */
function createAiWorker(redisConnection) {
    const worker = new Worker(
        `${env.BULLMQ_PREFIX}-ai`,
        async (job) => {
            logger.debug({ jobId: job.id, name: job.name }, 'AI worker: processing');

            switch (job.name) {
                case 'calculate-performance': {
                    const { playerId } = job.data;
                    return providerNotConfigured(job, 'calculate-performance', { playerId });
                }
                case 'assess-injury-risk': {
                    const { playerId } = job.data;
                    return providerNotConfigured(job, 'assess-injury-risk', { playerId });
                }
                case 'generate-nutrition-plan': {
                    const { playerId } = job.data;
                    return providerNotConfigured(job, 'generate-nutrition-plan', { playerId });
                }
                case 'ai-chat': {
                    const { userId } = job.data;
                    return providerNotConfigured(job, 'ai-chat', { userId });
                }
                default:
                    logger.warn({ name: job.name }, 'Unknown AI job');
                    return { skipped: true, reason: 'unknown_job', name: job.name };
            }
        },
        { connection: redisConnection, concurrency: 2 }
    );

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, err: err.message }, 'AI worker: job failed');
    });

    return worker;
}

module.exports = createAiWorker;
