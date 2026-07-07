// Storage client — S3/R2 compatible
// Placeholder: implement when media upload module is needed

const logger = require('../shared/logger');

class StorageClient {
    constructor() {
        this.initialized = false;
    }

    async upload(/* bucket, key, buffer, contentType */) {
        logger.warn('Storage client not configured — upload skipped');
        return null;
    }

    async getSignedUrl(/* bucket, key */) {
        logger.warn('Storage client not configured — getSignedUrl skipped');
        return null;
    }

    async remove(/* bucket, key */) {
        logger.warn('Storage client not configured — delete skipped');
        return null;
    }
}

module.exports = new StorageClient();
