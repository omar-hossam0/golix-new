const {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} = require('../../shared/errors');

const needsOptions = new Set(['single_select', 'multi_select']);
const numericTypes = new Set(['number', 'rating', 'percentage']);
const protectedSystemFieldKeys = new Set(['main_position', 'main_postion']);
const MAIN_POSITION_OPTIONS = [
    ['Striker', 'Striker'],
    ['LW', 'LW'],
    ['RW', 'RW'],
    ['LB', 'LB'],
    ['RB', 'RB'],
    ['CM', 'CM'],
    ['CAM', 'CAM'],
    ['CB', 'CB'],
    ['GK', 'GK'],
];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toSnakeLikeKey(label) {
    return String(label || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 140);
}

function isProtectedSystemFieldKey(key) {
    return protectedSystemFieldKeys.has(toSnakeLikeKey(key));
}

function optionValue(label, value) {
    return value ? String(value).trim() : toSnakeLikeKey(label);
}

function hasMeaningfulInput(value) {
    if (value === false || value === 0) return true;
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return String(value).trim() !== '';
}

function jsonbValue(value) {
    return JSON.stringify(value);
}

function normalizeMultiSelectValue(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
    } catch {
        // Fall through to the user-friendly comma-separated fallback below.
    }

    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
}

class CustomDataService {
    constructor(repo) {
        this.repo = repo;
    }

    async _coachForUser(user) {
        if (user.role !== 'coach') return null;
        const coach = await this.repo.findCoachByUserId(user.userId, user.academyId);
        if (!coach) throw new ForbiddenError('Coach profile is not linked to this user');
        return coach;
    }

    _canCoachSeeCategory(category, coachId) {
        return category.visibility === 'global'
            || category.visibility === 'shared'
            || (category.visibility === 'specific_coach' && category.assigned_coach_id === coachId)
            || (category.created_by_role === 'coach' && category.created_by_coach_id === coachId);
    }

    _assertCanSeeCategory(user, coach, category) {
        if (user.role === 'admin') return;
        if (!this._canCoachSeeCategory(category, coach.id)) {
            throw new ForbiddenError('Coach cannot access this custom category');
        }
    }

    _assertCanManageOwned(user, coach, row, label) {
        if (user.role === 'admin') return;
        if (row.created_by_role !== 'coach' || row.created_by_coach_id !== coach.id) {
            throw new ForbiddenError(`Coach can only edit ${label} created by himself`);
        }
    }

    _assertNotProtectedSystemField(row, action = 'modify') {
        if (isProtectedSystemFieldKey(row?.key || row?.field_key)) {
            throw new ForbiddenError(`Main Position is a protected system field and cannot be ${action}`);
        }
    }

    async _ensureMainPositionField(user) {
        if (!user.academyId) return;

        await this.repo.db.transaction(async (trx) => {
            const academy = await trx('academy_academies')
                .where({ id: user.academyId })
                .whereNull('deleted_at')
                .first('id', 'owner_user_id');
            if (!academy) return;

            let category = await trx('custom_categories')
                .where({
                    academy_id: academy.id,
                    target_module: 'player_profile',
                    is_system_default: true,
                })
                .whereNull('deleted_at')
                .orderBy('sort_order', 'asc')
                .first();

            if (!category) {
                [category] = await trx('custom_categories')
                    .insert({
                        academy_id: academy.id,
                        name: 'Football information',
                        description: null,
                        target_module: 'player_profile',
                        created_by_role: 'admin',
                        created_by_id: academy.owner_user_id || null,
                        visibility: 'global',
                        is_editable_by_coach: false,
                        is_system_default: true,
                        is_active: true,
                        sort_order: 0,
                    })
                    .returning('*');
            }

            let field = await trx('custom_fields as cf')
                .join('custom_categories as cc', 'cf.category_id', 'cc.id')
                .where('cc.academy_id', academy.id)
                .whereNull('cf.deleted_at')
                .whereNull('cc.deleted_at')
                .where('cf.key', 'main_position')
                .select('cf.*')
                .first();

            const typoField = await trx('custom_fields as cf')
                .join('custom_categories as cc', 'cf.category_id', 'cc.id')
                .where('cc.academy_id', academy.id)
                .whereNull('cf.deleted_at')
                .whereNull('cc.deleted_at')
                .where('cf.key', 'main_postion')
                .select('cf.*')
                .first();

            if (!field && typoField) {
                const conflict = await trx('custom_fields')
                    .where({ category_id: typoField.category_id, key: 'main_position' })
                    .whereNull('deleted_at')
                    .first('id');
                if (!conflict) {
                    [field] = await trx('custom_fields')
                        .where({ id: typoField.id })
                        .update({
                            label: 'Main Position',
                            key: 'main_position',
                            field_type: 'multi_select',
                            is_required: true,
                            placeholder: null,
                            validation_rules: JSON.stringify({ system: true, immutable: true }),
                            is_editable_by_coach: false,
                            is_active: true,
                            deleted_at: null,
                            updated_at: new Date(),
                        })
                        .returning('*');
                }
            }

            if (!field) {
                [field] = await trx('custom_fields')
                    .insert({
                        category_id: category.id,
                        label: 'Main Position',
                        key: 'main_position',
                        field_type: 'multi_select',
                        is_required: true,
                        placeholder: null,
                        validation_rules: JSON.stringify({ system: true, immutable: true }),
                        created_by_role: 'admin',
                        created_by_id: academy.owner_user_id || null,
                        is_editable_by_coach: false,
                        is_active: true,
                        sort_order: 0,
                    })
                    .returning('*');
            } else {
                [field] = await trx('custom_fields')
                    .where({ id: field.id })
                    .update({
                        label: 'Main Position',
                        key: 'main_position',
                        field_type: 'multi_select',
                        is_required: true,
                        placeholder: null,
                        validation_rules: JSON.stringify({ system: true, immutable: true }),
                        is_editable_by_coach: false,
                        is_active: true,
                        deleted_at: null,
                        updated_at: new Date(),
                    })
                    .returning('*');
            }

            if (typoField && typoField.id !== field.id) {
                await trx.raw(
                    `
                        INSERT INTO player_custom_values (
                            academy_id, player_id, field_id, value_text, value_long_text,
                            value_number, value_decimal, value_date, value_boolean,
                            value_option_id, value_json, created_by_id, updated_by_id,
                            created_at, updated_at
                        )
                        SELECT
                            academy_id, player_id, ?, value_text, value_long_text,
                            value_number, value_decimal, value_date, value_boolean,
                            value_option_id, value_json, created_by_id, updated_by_id,
                            created_at, updated_at
                        FROM player_custom_values
                        WHERE field_id = ?
                        ON CONFLICT (player_id, field_id)
                        DO UPDATE SET
                            value_text = EXCLUDED.value_text,
                            value_long_text = EXCLUDED.value_long_text,
                            value_number = EXCLUDED.value_number,
                            value_decimal = EXCLUDED.value_decimal,
                            value_date = EXCLUDED.value_date,
                            value_boolean = EXCLUDED.value_boolean,
                            value_option_id = EXCLUDED.value_option_id,
                            value_json = EXCLUDED.value_json,
                            updated_by_id = EXCLUDED.updated_by_id,
                            updated_at = EXCLUDED.updated_at
                    `,
                    [field.id, typoField.id],
                );
                await trx('custom_fields').where({ id: typoField.id }).update({
                    is_active: false,
                    deleted_at: new Date(),
                    updated_at: new Date(),
                });
            }

            await trx('custom_categories').where({ id: field.category_id }).update({
                name: 'Football information',
                description: null,
                updated_at: new Date(),
            });

            await trx.raw(
                `
                    UPDATE player_custom_values
                    SET
                        value_json = CASE
                            WHEN value_json IS NOT NULL AND jsonb_typeof(value_json) = 'array' THEN value_json
                            WHEN value_json IS NOT NULL AND jsonb_typeof(value_json) = 'string' THEN jsonb_build_array(value_json #>> '{}')
                            WHEN value_option_id IS NOT NULL THEN jsonb_build_array(value_option_id::text)
                            ELSE value_json
                        END,
                        value_option_id = NULL,
                        updated_at = NOW()
                    WHERE field_id = ?
                      AND (
                        value_option_id IS NOT NULL
                        OR value_json IS NOT NULL
                      )
                `,
                [field.id],
            );

            for (const [index, [value, label]] of MAIN_POSITION_OPTIONS.entries()) {
                await trx('custom_field_options')
                    .insert({
                        field_id: field.id,
                        label,
                        value,
                        created_by_role: 'admin',
                        created_by_id: academy.owner_user_id || null,
                        is_editable_by_coach: false,
                        is_active: true,
                        sort_order: index,
                    })
                    .onConflict(['field_id', 'value'])
                    .merge({
                        label,
                        is_editable_by_coach: false,
                        is_active: true,
                        deleted_at: null,
                        sort_order: index,
                        updated_at: new Date(),
                    });
            }

            await trx('custom_field_options')
                .where({ field_id: field.id })
                .whereNotIn('value', MAIN_POSITION_OPTIONS.map(([value]) => value))
                .update({
                    is_active: false,
                    deleted_at: new Date(),
                    updated_at: new Date(),
                });
        });
    }

    async _assertPlayerAccess(user, coach, playerId) {
        const player = await this.repo.findPlayerById(playerId, user.academyId);
        if (!player) throw new NotFoundError('Player', playerId);
        if (user.role === 'coach') {
            const access = await this.repo.coachPlayerAccess(coach.id, playerId);
            if (!access) throw new ForbiddenError('Coach cannot access this player');
        }
        return player;
    }

    async listCategories(user, filters = {}) {
        const coach = await this._coachForUser(user);
        const targetModule = filters.targetModule || 'player_profile';
        if (targetModule === 'player_profile') {
            await this._ensureMainPositionField(user);
        }
        return this.repo.getCategoriesWithFields(user, coach?.id, {
            targetModule,
            includeInactive: filters.includeInactive,
        });
    }

    async createCategory(user, data) {
        const coach = await this._coachForUser(user);
        const isCoach = user.role === 'coach';
        const visibility = isCoach ? 'coach_only' : (data.visibility || 'global');
        const assignedCoachId = isCoach ? coach.id : (data.assignedCoachId || null);

        if (visibility === 'specific_coach' && !assignedCoachId) {
            throw new BadRequestError('assignedCoachId is required for specific coach visibility');
        }

        const [row] = await this.repo.db('custom_categories').insert({
            academy_id: user.academyId,
            name: data.name,
            description: data.description,
            target_module: data.targetModule || 'player_profile',
            created_by_role: isCoach ? 'coach' : 'admin',
            created_by_id: user.userId,
            created_by_coach_id: coach?.id || null,
            assigned_coach_id: assignedCoachId,
            visibility,
            is_editable_by_coach: isCoach ? true : Boolean(data.isEditableByCoach),
            is_system_default: !isCoach && Boolean(data.isSystemDefault),
            is_active: data.isActive ?? true,
            sort_order: data.sortOrder ?? 0,
        }).returning('*');
        return row;
    }

    async updateCategory(user, categoryId, data) {
        const coach = await this._coachForUser(user);
        const category = await this.repo.findCategoryById(categoryId, user.academyId);
        if (!category) throw new NotFoundError('Custom category', categoryId);
        this._assertCanManageOwned(user, coach, category, 'categories');

        const [row] = await this.repo.db('custom_categories')
            .where({ id: categoryId })
            .update({
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(user.role === 'admin' && data.targetModule !== undefined ? { target_module: data.targetModule } : {}),
                ...(user.role === 'admin' && data.assignedCoachId !== undefined ? { assigned_coach_id: data.assignedCoachId } : {}),
                ...(user.role === 'admin' && data.visibility !== undefined ? { visibility: data.visibility } : {}),
                ...(user.role === 'admin' && data.isEditableByCoach !== undefined ? { is_editable_by_coach: data.isEditableByCoach } : {}),
                ...(user.role === 'admin' && data.isSystemDefault !== undefined ? { is_system_default: data.isSystemDefault } : {}),
                ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
                ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
                updated_at: new Date(),
            })
            .returning('*');
        return row;
    }

    async deleteCategory(user, categoryId) {
        const coach = await this._coachForUser(user);
        const category = await this.repo.findCategoryById(categoryId, user.academyId);
        if (!category) throw new NotFoundError('Custom category', categoryId);
        this._assertCanManageOwned(user, coach, category, 'categories');
        const protectedField = await this.repo.db('custom_fields')
            .where({ category_id: categoryId })
            .whereNull('deleted_at')
            .whereIn('key', [...protectedSystemFieldKeys])
            .first();
        if (protectedField) {
            throw new ForbiddenError('This category contains Main Position, which is protected by the system');
        }
        await this.repo.db('custom_categories').where({ id: categoryId }).update({
            deleted_at: new Date(),
            is_active: false,
        });
        return { message: 'Custom category deleted' };
    }

    async createField(user, categoryId, data) {
        const coach = await this._coachForUser(user);
        const category = await this.repo.findCategoryById(categoryId, user.academyId);
        if (!category) throw new NotFoundError('Custom category', categoryId);
        this._assertCanSeeCategory(user, coach, category);
        this._assertCanManageOwned(user, coach, category, 'fields inside admin-owned categories');
        if (isProtectedSystemFieldKey(data.key || data.label)) {
            throw new ForbiddenError('Main Position is a protected system field and cannot be recreated');
        }
        if (needsOptions.has(data.fieldType) && data.isRequired === false) {
            // Select fields can be optional, but they still need options before being useful.
        }
        const [row] = await this.repo.db('custom_fields').insert({
            category_id: categoryId,
            label: data.label,
            key: data.key || toSnakeLikeKey(data.label),
            field_type: data.fieldType,
            is_required: data.isRequired ?? true,
            placeholder: data.placeholder,
            default_value: data.defaultValue,
            unit: data.unit,
            min_value: data.minValue,
            max_value: data.maxValue,
            validation_rules: data.validationRules || {},
            created_by_role: user.role === 'coach' ? 'coach' : 'admin',
            created_by_id: user.userId,
            created_by_coach_id: coach?.id || null,
            is_editable_by_coach: user.role === 'coach' ? true : Boolean(data.isEditableByCoach),
            is_active: data.isActive ?? true,
            sort_order: data.sortOrder ?? 0,
        }).returning('*');
        return row;
    }

    async updateField(user, fieldId, data) {
        const coach = await this._coachForUser(user);
        const field = await this.repo.findFieldById(fieldId);
        if (!field || field.academy_id !== user.academyId) throw new NotFoundError('Custom field', fieldId);
        this._assertCanManageOwned(user, coach, field, 'fields');
        this._assertNotProtectedSystemField(field, 'edited');
        if (data.key !== undefined && isProtectedSystemFieldKey(data.key)) {
            throw new ForbiddenError('Main Position is a protected system field and cannot be edited');
        }
        const [row] = await this.repo.db('custom_fields')
            .where({ id: fieldId })
            .update({
                ...(data.label !== undefined ? { label: data.label } : {}),
                ...(data.key !== undefined ? { key: data.key } : {}),
                ...(data.fieldType !== undefined ? { field_type: data.fieldType } : {}),
                ...(data.isRequired !== undefined ? { is_required: data.isRequired } : {}),
                ...(data.placeholder !== undefined ? { placeholder: data.placeholder } : {}),
                ...(data.defaultValue !== undefined ? { default_value: data.defaultValue } : {}),
                ...(data.unit !== undefined ? { unit: data.unit } : {}),
                ...(data.minValue !== undefined ? { min_value: data.minValue } : {}),
                ...(data.maxValue !== undefined ? { max_value: data.maxValue } : {}),
                ...(data.validationRules !== undefined ? { validation_rules: data.validationRules } : {}),
                ...(user.role === 'admin' && data.isEditableByCoach !== undefined ? { is_editable_by_coach: data.isEditableByCoach } : {}),
                ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
                ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
                updated_at: new Date(),
            })
            .returning('*');
        return row;
    }

    async deleteField(user, fieldId) {
        const coach = await this._coachForUser(user);
        const field = await this.repo.findFieldById(fieldId);
        if (!field || field.academy_id !== user.academyId) throw new NotFoundError('Custom field', fieldId);
        this._assertCanManageOwned(user, coach, field, 'fields');
        this._assertNotProtectedSystemField(field, 'deleted');
        await this.repo.db.transaction(async (trx) => {
            await trx('player_custom_values').where({ field_id: fieldId }).del();
            await trx('custom_field_options').where({ field_id: fieldId }).update({
                deleted_at: new Date(),
                is_active: false,
                updated_at: new Date(),
            });
            await trx('custom_fields').where({ id: fieldId }).update({
                deleted_at: new Date(),
                is_active: false,
                updated_at: new Date(),
            });
        });
        return { message: 'Custom field deleted' };
    }

    async createOption(user, fieldId, data) {
        const coach = await this._coachForUser(user);
        const field = await this.repo.findFieldById(fieldId);
        if (!field || field.academy_id !== user.academyId) throw new NotFoundError('Custom field', fieldId);
        this._assertCanManageOwned(user, coach, field, 'options');
        this._assertNotProtectedSystemField(field, 'edited');
        const [row] = await this.repo.db('custom_field_options').insert({
            field_id: fieldId,
            label: data.label,
            value: optionValue(data.label, data.value),
            created_by_role: user.role === 'coach' ? 'coach' : 'admin',
            created_by_id: user.userId,
            created_by_coach_id: coach?.id || null,
            is_editable_by_coach: user.role === 'coach' ? true : Boolean(data.isEditableByCoach),
            is_active: data.isActive ?? true,
            sort_order: data.sortOrder ?? 0,
        }).returning('*');
        return row;
    }

    async updateOption(user, optionId, data) {
        const coach = await this._coachForUser(user);
        const option = await this.repo.findOptionById(optionId);
        if (!option || option.academy_id !== user.academyId) throw new NotFoundError('Custom option', optionId);
        this._assertCanManageOwned(user, coach, option, 'options');
        this._assertNotProtectedSystemField(option, 'edited');
        const [row] = await this.repo.db('custom_field_options')
            .where({ id: optionId })
            .update({
                ...(data.label !== undefined ? { label: data.label } : {}),
                ...(data.value !== undefined || data.label !== undefined ? { value: optionValue(data.label || option.label, data.value) } : {}),
                ...(user.role === 'admin' && data.isEditableByCoach !== undefined ? { is_editable_by_coach: data.isEditableByCoach } : {}),
                ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
                ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
                updated_at: new Date(),
            })
            .returning('*');
        return row;
    }

    async deleteOption(user, optionId) {
        const coach = await this._coachForUser(user);
        const option = await this.repo.findOptionById(optionId);
        if (!option || option.academy_id !== user.academyId) throw new NotFoundError('Custom option', optionId);
        this._assertCanManageOwned(user, coach, option, 'options');
        this._assertNotProtectedSystemField(option, 'deleted');
        await this.repo.db('custom_field_options').where({ id: optionId }).update({
            deleted_at: new Date(),
            is_active: false,
        });
        return { message: 'Custom option deleted' };
    }

    _storedValueIsPresent(value) {
        return hasMeaningfulInput(value.value_text)
            || hasMeaningfulInput(value.value_long_text)
            || hasMeaningfulInput(value.value_number)
            || hasMeaningfulInput(value.value_decimal)
            || hasMeaningfulInput(value.value_date)
            || value.value_boolean !== null && value.value_boolean !== undefined
            || hasMeaningfulInput(value.value_option_id)
            || hasMeaningfulInput(value.value_json);
    }

    async _serializeValue(field, rawValue) {
        const blank = {
            value_text: null,
            value_long_text: null,
            value_number: null,
            value_decimal: null,
            value_date: null,
            value_boolean: null,
            value_option_id: null,
            value_json: null,
        };

        if (!hasMeaningfulInput(rawValue)) return blank;

        if (field.field_type === 'single_select') {
            const option = await this.repo.db('custom_field_options')
                .where({ id: rawValue, field_id: field.id, is_active: true })
                .whereNull('deleted_at')
                .first();
            if (!option) throw new BadRequestError(`Invalid option for ${field.label}`);
            return { ...blank, value_option_id: rawValue };
        }

        if (field.field_type === 'multi_select') {
            const selectedOptionIds = normalizeMultiSelectValue(rawValue);
            if (!Array.isArray(selectedOptionIds)) throw new BadRequestError(`${field.label} must be a list`);
            const options = await this.repo.db('custom_field_options')
                .where({ field_id: field.id, is_active: true })
                .whereIn('id', selectedOptionIds)
                .whereNull('deleted_at');
            if (options.length !== selectedOptionIds.length) throw new BadRequestError(`Invalid options for ${field.label}`);
            return { ...blank, value_json: jsonbValue(selectedOptionIds) };
        }

        if (numericTypes.has(field.field_type)) {
            const parsed = Number(rawValue);
            if (!Number.isFinite(parsed)) throw new BadRequestError(`${field.label} must be a number`);
            if (field.min_value !== null && field.min_value !== undefined && parsed < Number(field.min_value)) {
                throw new BadRequestError(`${field.label} is below minimum`);
            }
            if (field.max_value !== null && field.max_value !== undefined && parsed > Number(field.max_value)) {
                throw new BadRequestError(`${field.label} is above maximum`);
            }
            return { ...blank, value_number: Math.round(parsed) };
        }

        if (field.field_type === 'decimal') {
            const parsed = Number(rawValue);
            if (!Number.isFinite(parsed)) throw new BadRequestError(`${field.label} must be a decimal number`);
            return { ...blank, value_decimal: parsed };
        }

        if (field.field_type === 'boolean') {
            return { ...blank, value_boolean: Boolean(rawValue) };
        }

        if (field.field_type === 'date') {
            return { ...blank, value_date: rawValue };
        }

        if (field.field_type === 'long_text') {
            return { ...blank, value_long_text: String(rawValue) };
        }

        if (field.field_type === 'file' || field.field_type === 'image') {
            return { ...blank, value_json: jsonbValue(rawValue) };
        }

        return { ...blank, value_text: String(rawValue) };
    }

    _valueForResponse(value) {
        if (!value) return null;
        if (value.value_option_id) return value.value_option_id;
        if (value.value_json !== null && value.value_json !== undefined) return value.value_json;
        if (value.value_boolean !== null && value.value_boolean !== undefined) return value.value_boolean;
        if (value.value_date) return value.value_date;
        if (value.value_decimal !== null && value.value_decimal !== undefined) return Number(value.value_decimal);
        if (value.value_number !== null && value.value_number !== undefined) return Number(value.value_number);
        if (value.value_long_text) return value.value_long_text;
        if (value.value_text) return value.value_text;
        return null;
    }

    async _displayValueForStoredValue(trx, value) {
        if (value.value_option_id) {
            const option = await trx('custom_field_options')
                .where({ id: value.value_option_id })
                .first('label');
            return option?.label || null;
        }
        const labelsForOptionIds = async (optionIds) => {
            const ids = [...new Set((optionIds || []).filter((item) => typeof item === 'string' && uuidPattern.test(item)))];
            if (!ids.length) return null;
            const rows = await trx('custom_field_options')
                .whereIn('id', ids)
                .select('id', 'label');
            const labelsById = new Map(rows.map((row) => [row.id, row.label]));
            return ids.map((id) => labelsById.get(id) || id).join(', ');
        };
        if (value.value_text) {
            if (uuidPattern.test(value.value_text)) {
                const option = await trx('custom_field_options')
                    .where({ id: value.value_text })
                    .first('label');
                return option?.label || value.value_text;
            }
            return value.value_text;
        }
        if (value.value_long_text) return value.value_long_text;
        if (value.value_decimal !== null && value.value_decimal !== undefined) return String(value.value_decimal);
        if (value.value_number !== null && value.value_number !== undefined) return String(value.value_number);
        if (value.value_date) return String(value.value_date);
        if (value.value_boolean !== null && value.value_boolean !== undefined) return String(value.value_boolean);
        if (value.value_json !== null && value.value_json !== undefined) {
            if (Array.isArray(value.value_json)) {
                return await labelsForOptionIds(value.value_json) || value.value_json.join(', ');
            }
            if (typeof value.value_json === 'string') {
                try {
                    const parsed = JSON.parse(value.value_json);
                    if (Array.isArray(parsed)) {
                        return await labelsForOptionIds(parsed) || parsed.join(', ');
                    }
                    if (typeof parsed === 'string' && uuidPattern.test(parsed)) {
                        return await labelsForOptionIds([parsed]) || parsed;
                    }
                } catch {
                    // Fall back to the raw text below.
                }
            }
            return String(value.value_json);
        }
        return null;
    }

    async getPlayerProfile(user, playerId) {
        const coach = await this._coachForUser(user);
        await this._assertPlayerAccess(user, coach, playerId);
        const [categories, values] = await Promise.all([
            this.listCategories(user, { targetModule: 'player_profile' }),
            this.repo.getPlayerValues(playerId),
        ]);
        const valueByField = new Map(values.map((value) => [value.field_id, value]));
        return {
            categories,
            values: values.map((value) => ({
                ...value,
                value: this._valueForResponse(value),
            })),
            missingRequiredFieldIds: this._missingRequiredFields(categories, valueByField),
        };
    }

    _missingRequiredFields(categories, valueByField) {
        const missing = [];
        for (const category of categories) {
            if (!category.is_active) continue;
            for (const field of category.fields || []) {
                if (!field.is_active || !field.is_required) continue;
                const existing = valueByField.get(field.id);
                if (!existing || !this._storedValueIsPresent(existing)) missing.push(field.id);
            }
        }
        return missing;
    }

    async savePlayerValues(user, playerId, values = [], { markProfileComplete = false } = {}) {
        const coach = await this._coachForUser(user);
        await this._assertPlayerAccess(user, coach, playerId);
        const categories = await this.listCategories(user, { targetModule: 'player_profile' });
        const fields = categories.flatMap((category) => category.fields || []);
        const fieldById = new Map(fields.map((field) => [field.id, field]));
        const submittedFieldIds = new Set();

        await this.repo.db.transaction(async (trx) => {
            let mainPositionValue;
            for (const item of values) {
                const field = fieldById.get(item.fieldId);
                if (!field || !field.is_active) throw new ForbiddenError('Cannot write to this custom field');
                if (submittedFieldIds.has(item.fieldId)) throw new ConflictError('Duplicate custom field value in request');
                submittedFieldIds.add(item.fieldId);
                const serialized = await this._serializeValue(field, item.value);
                if (toSnakeLikeKey(field.key || field.label) === 'main_position') {
                    mainPositionValue = await this._displayValueForStoredValue(trx, serialized);
                }
                await trx('player_custom_values')
                    .insert({
                        academy_id: user.academyId,
                        player_id: playerId,
                        field_id: item.fieldId,
                        ...serialized,
                        created_by_id: user.userId,
                        updated_by_id: user.userId,
                    })
                    .onConflict(['player_id', 'field_id'])
                    .merge({
                        ...serialized,
                        updated_by_id: user.userId,
                        updated_at: new Date(),
                    });
            }

            if (mainPositionValue !== undefined) {
                await trx('player_profiles')
                    .where({ id: playerId, academy_id: user.academyId })
                    .update({
                        position: mainPositionValue,
                        updated_at: new Date(),
                    });
            }

            if (markProfileComplete) {
                const existingRows = await trx('player_custom_values').where({ player_id: playerId });
                const valueByField = new Map(existingRows.map((value) => [value.field_id, value]));
                const missing = this._missingRequiredFields(categories, valueByField);
                if (missing.length) {
                    throw new BadRequestError('Player custom profile is missing required fields');
                }
                await trx('player_profiles').where({ id: playerId, academy_id: user.academyId }).update({
                    profile_status: 'complete',
                    profile_completed_at: new Date(),
                    updated_at: new Date(),
                });
            }
        });

        return this.getPlayerProfile(user, playerId);
    }
}

module.exports = CustomDataService;
