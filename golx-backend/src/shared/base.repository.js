const { NotFoundError } = require('./errors');

/**
 * BaseRepository — generic CRUD, knows nothing about any specific module.
 * Every module's repository extends this class.
 */
class BaseRepository {
    constructor(tableName, db, options = {}) {
        this.table = tableName;
        this.db = db;
        this.hasSoftDelete = options.hasSoftDelete !== false;
    }

    /** Returns a query builder scoped to non-deleted rows */
    baseQuery(trx) {
        const q = (trx || this.db)(this.table);
        if (this.hasSoftDelete) {
            return q.whereNull(`${this.table}.deleted_at`);
        }
        return q;
    }

    /** Returns a query builder scoped to non-deleted rows belonging to a specific academy */
    forAcademy(academyId, trx) {
        if (!academyId) {
            throw new Error(`academyId is required to query ${this.table} under academy scope`);
        }
        const col = this.table === 'academy_academies' ? 'id' : 'academy_id';
        return this.baseQuery(trx).where(`${this.table}.${col}`, academyId);
    }

    async findById(id, trx, academyId) {
        let query = this.baseQuery(trx).where(`${this.table}.id`, id);
        if (academyId) {
            const col = this.table === 'academy_academies' ? 'id' : 'academy_id';
            query = query.where(`${this.table}.${col}`, academyId);
        }
        return query.first();
    }

    async findOne(filters, trx, academyId) {
        let query = this.baseQuery(trx).where(filters);
        if (academyId) {
            const col = this.table === 'academy_academies' ? 'id' : 'academy_id';
            query = query.where(`${this.table}.${col}`, academyId);
        }
        return query.first();
    }

    async findAll({ filters = {}, page = 1, limit = 20, orderBy = 'created_at', order = 'desc' } = {}, trx, academyId) {
        // Whitelist column name (only lowercase letters and underscores) to prevent injection
        const safeOrderBy = /^[a-z_]+$/.test(orderBy) ? orderBy : 'created_at';
        const safeOrder = order === 'asc' ? 'asc' : 'desc';

        let query = this.baseQuery(trx);
        if (academyId) {
            const col = this.table === 'academy_academies' ? 'id' : 'academy_id';
            query = query.where(`${this.table}.${col}`, academyId);
        }

        // Apply filters — keys must be plain identifiers; values are parameterized by Knex
        for (const [key, value] of Object.entries(filters)) {
            if (/^[a-z_]+$/.test(key) && value !== undefined && value !== null) {
                query.where(`${this.table}.${key}`, value);
            }
        }

        const countResult = await query.clone().count('id as count').first();
        const total = parseInt(countResult.count, 10);

        const data = await query
            .orderBy(`${this.table}.${safeOrderBy}`, safeOrder)
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total, page, totalPages: Math.ceil(total / limit) || 1 };
    }

    async create(data, trx) {
        const [row] = await (trx || this.db)(this.table).insert(data).returning('*');
        return row;
    }

    async createMany(dataArray, trx) {
        return (trx || this.db)(this.table).insert(dataArray).returning('*');
    }

    async update(id, data, trx, academyId) {
        let query = (trx || this.db)(this.table).where({ id });
        if (academyId) {
            const col = this.table === 'academy_academies' ? 'id' : 'academy_id';
            query = query.where(col, academyId);
        }
        if (this.hasSoftDelete) {
            query = query.whereNull('deleted_at');
        }
        const [row] = await query
            .update({ ...data, updated_at: new Date() })
            .returning('*');
        return row;
    }

    async softDelete(id, trx, academyId) {
        if (!this.hasSoftDelete) {
            return this.hardDelete(id, trx, academyId);
        }
        let query = (trx || this.db)(this.table).where({ id });
        if (academyId) {
            const col = this.table === 'academy_academies' ? 'id' : 'academy_id';
            query = query.where(col, academyId);
        }
        const result = await query
            .whereNull('deleted_at')
            .update({ deleted_at: new Date() });
        if (result === 0) throw new NotFoundError(this.table, id);
        return result;
    }

    async hardDelete(id, trx, academyId) {
        let query = (trx || this.db)(this.table).where({ id });
        if (academyId) {
            const col = this.table === 'academy_academies' ? 'id' : 'academy_id';
            query = query.where(col, academyId);
        }
        return query.del();
    }

    async count(filters = {}, trx) {
        const query = this.baseQuery(trx);
        for (const [key, value] of Object.entries(filters)) {
            // Whitelist column names to prevent SQL column injection (same as findAll)
            if (/^[a-z_]+$/.test(key) && value !== undefined && value !== null) {
                query.where(key, value);
            }
        }
        const result = await query.count('id as count').first();
        return parseInt(result.count, 10);
    }

    async exists(filters, trx) {
        const row = await this.baseQuery(trx).where(filters).select(this.db.raw('1')).first();
        return !!row;
    }
}

module.exports = BaseRepository;
