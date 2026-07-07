class CustomDataRepository {
    constructor(db) {
        this.db = db;
    }

    async findCoachByUserId(userId, academyId) {
        return this.db('coach_profiles')
            .where({ user_id: userId, academy_id: academyId })
            .whereNull('deleted_at')
            .first();
    }

    async findPlayerById(playerId, academyId) {
        return this.db('player_profiles')
            .where({ id: playerId, academy_id: academyId })
            .whereNull('deleted_at')
            .first();
    }

    async coachPlayerAccess(coachId, playerId) {
        const directGroupAccess = await this.db('player_group_assignments as pga')
            .join('coach_group_assignments as cga', 'pga.group_id', 'cga.group_id')
            .where('pga.player_id', playerId)
            .where('cga.coach_id', coachId)
            .whereNull('pga.left_at')
            .select('pga.player_id')
            .first();
        if (directGroupAccess) return directGroupAccess;

        const db = this.db;
        return this.db('player_profiles as pp')
            .join('academy_birth_years as aby', function joinBirthYear() {
                this.on('aby.branch_id', '=', 'pp.branch_id')
                    .andOn(db.raw('EXTRACT(YEAR FROM pp.date_of_birth)::int BETWEEN aby.from_year AND aby.to_year'));
            })
            .where('pp.id', playerId)
            .whereNull('pp.deleted_at')
            .whereNull('aby.deleted_at')
            .whereIn('aby.id', this._coachAccessibleBirthYearIdsQuery(coachId))
            .select('pp.id as player_id')
            .first();
    }

    _coachAccessibleBirthYearIdsQuery(coachId) {
        return this.db
            .select('birth_year_id')
            .from(function accessibleBirthYears() {
                this.select('aby_all.id as birth_year_id')
                    .from('coach_branch_access_rules as car_all')
                    .join('academy_birth_years as aby_all', 'aby_all.branch_id', 'car_all.branch_id')
                    .where('car_all.coach_id', coachId)
                    .whereIn('car_all.access_type', ['birth_years', 'both'])
                    .where('car_all.all_birth_years', true)
                    .whereNull('aby_all.deleted_at')
                    .union(function selectedBirthYears() {
                        this.select('carb.birth_year_id')
                            .from('coach_branch_access_rules as car_selected')
                            .join('coach_access_rule_birth_years as carb', 'carb.rule_id', 'car_selected.id')
                            .where('car_selected.coach_id', coachId)
                            .whereIn('car_selected.access_type', ['birth_years', 'both']);
                    })
                    .union(function groupBirthYears() {
                        this.select('gby.birth_year_id')
                            .from('coach_group_assignments as cga')
                            .join('academy_groups as ag', 'cga.group_id', 'ag.id')
                            .join('group_birth_years as gby', 'gby.group_id', 'ag.id')
                            .where('cga.coach_id', coachId)
                            .whereNull('ag.deleted_at');
                    })
                    .as('coach_accessible_birth_years');
            });
    }

    visibleCategoriesQuery(user, coachId, filters = {}) {
        const query = this.db('custom_categories as cc')
            .where('cc.academy_id', user.academyId)
            .whereNull('cc.deleted_at')
            .modify((q) => {
                if (!filters.includeInactive) q.where('cc.is_active', true);
                if (filters.targetModule) q.where('cc.target_module', filters.targetModule);
                if (user.role === 'coach') {
                    q.andWhere((scope) => {
                        scope.where('cc.visibility', 'global')
                            .orWhere('cc.visibility', 'shared')
                            .orWhere((specific) => {
                                specific.where('cc.visibility', 'specific_coach').where('cc.assigned_coach_id', coachId);
                            })
                            .orWhere((own) => {
                                own.where('cc.created_by_role', 'coach').where('cc.created_by_coach_id', coachId);
                            });
                    });
                }
            })
            .orderBy('cc.sort_order', 'asc')
            .orderBy('cc.created_at', 'asc')
            .select('cc.*');
        return query;
    }

    async findCategoryById(categoryId, academyId) {
        return this.db('custom_categories')
            .where({ id: categoryId, academy_id: academyId })
            .whereNull('deleted_at')
            .first();
    }

    async findFieldById(fieldId) {
        return this.db('custom_fields as cf')
            .join('custom_categories as cc', 'cf.category_id', 'cc.id')
            .where('cf.id', fieldId)
            .whereNull('cf.deleted_at')
            .whereNull('cc.deleted_at')
            .select('cf.*', 'cc.academy_id', 'cc.target_module', 'cc.visibility', 'cc.assigned_coach_id')
            .first();
    }

    async findOptionById(optionId) {
        return this.db('custom_field_options as cfo')
            .join('custom_fields as cf', 'cfo.field_id', 'cf.id')
            .join('custom_categories as cc', 'cf.category_id', 'cc.id')
            .where('cfo.id', optionId)
            .whereNull('cfo.deleted_at')
            .whereNull('cf.deleted_at')
            .whereNull('cc.deleted_at')
            .select(
                'cfo.*',
                'cf.key as field_key',
                'cf.label as field_label',
                'cc.academy_id',
            )
            .first();
    }

    async getCategoriesWithFields(user, coachId, filters) {
        const categories = await this.visibleCategoriesQuery(user, coachId, filters);
        if (!categories.length) return [];
        const categoryIds = categories.map((category) => category.id);
        const fields = await this.db('custom_fields')
            .whereIn('category_id', categoryIds)
            .whereNull('deleted_at')
            .modify((q) => {
                if (!filters.includeInactive) q.where('is_active', true);
            })
            .orderBy('sort_order', 'asc')
            .orderBy('created_at', 'asc');
        const fieldIds = fields.map((field) => field.id);
        const options = fieldIds.length
            ? await this.db('custom_field_options')
                .whereIn('field_id', fieldIds)
                .whereNull('deleted_at')
                .modify((q) => {
                    if (!filters.includeInactive) q.where('is_active', true);
                })
                .orderBy('sort_order', 'asc')
                .orderBy('created_at', 'asc')
            : [];

        const optionsByField = new Map();
        for (const option of options) {
            if (!optionsByField.has(option.field_id)) optionsByField.set(option.field_id, []);
            optionsByField.get(option.field_id).push(option);
        }
        const fieldsByCategory = new Map();
        for (const field of fields) {
            if (!fieldsByCategory.has(field.category_id)) fieldsByCategory.set(field.category_id, []);
            fieldsByCategory.get(field.category_id).push({ ...field, options: optionsByField.get(field.id) || [] });
        }
        return categories.map((category) => ({ ...category, fields: fieldsByCategory.get(category.id) || [] }));
    }

    async getPlayerValues(playerId) {
        return this.db('player_custom_values')
            .where({ player_id: playerId })
            .select('*');
    }
}

module.exports = CustomDataRepository;
