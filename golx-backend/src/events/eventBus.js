const EventEmitter = require('node:events');
const logger = require('../shared/logger');

/**
 * Internal EventBus — Node EventEmitter today → Kafka/RabbitMQ tomorrow.
 *
 * All inter-module communication goes through this bus.
 * When extracted to microservices: replace this with a message broker adapter
 * using the same event names and payload shapes — zero module code changes.
 */
class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50);
    }

    /**
     * Emit an event with payload.
     * @param {string} event - dot-separated event name e.g. 'attendance.marked'
     * @param {Object} payload - event data
     */
    publish(event, payload) {
        // Strip sensitive fields from debug log to prevent secret leakage
        const safePayload = { ...payload };
        delete safePayload.resetToken;
        delete safePayload.password;
        delete safePayload.token;
        logger.debug({ event, payload: safePayload }, `Event published: ${event}`);
        this.emit(event, payload);
    }

    /**
     * Subscribe to an event.
     * @param {string} event - event name
     * @param {Function} handler - async handler function
     */
    subscribe(event, handler) {
        this.on(event, async (payload) => {
            try {
                await handler(payload);
            } catch (err) {
                logger.error({ err, event, payload }, `Event handler error: ${event}`);
            }
        });
        logger.debug({ event }, 'Event handler subscribed');
    }
}

// Singleton
const eventBus = new EventBus();

module.exports = eventBus;
