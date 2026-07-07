const { NotFoundError } = require('./errors');

/**
 * BaseService — common service patterns.
 * Every module's service extends this class.
 */
class BaseService {
    constructor(repository) {
        this.repository = repository;
    }

    async getById(id, academyId) {
        const record = await this.repository.findById(id, null, academyId);
        if (!record) throw new NotFoundError(this.repository.table, id);
        return record;
    }

    async getAll(options, academyId) {
        return this.repository.findAll(options, null, academyId);
    }

    async create(data) {
        return this.repository.create(data);
    }

    async update(id, data, academyId) {
        const record = await this.repository.update(id, data, null, academyId);
        if (!record) throw new NotFoundError(this.repository.table, id);
        return record;
    }

    async delete(id, academyId) {
        return this.repository.softDelete(id, null, academyId);
    }
}

module.exports = BaseService;
