const BaseRepository = require('../../shared/base.repository');
const { getAgeCategory, buildPlayerCode } = require('../../shared/player-code.helper');

class PlayersRepository extends BaseRepository {
    constructor(db) {
        super('player_profiles', db);
    }

    async findAuthUserByCredentials({ username, phone }, db = this.db) {
        return db('auth_users')
            .whereNull('deleted_at')
            .where((q) => {
                if (username) q.orWhere('username', username);
                if (phone) q.orWhere('phone', phone);
            })
            .first();
    }

    async findCoachProfileByUserId(userId, db = this.db) {
        return db('coach_profiles')
            .where({ user_id: userId })
            .whereNull('deleted_at')
            .first();
    }

    async findPlayers({
        academyId,
        branchId,
        groupId,
        level,
        isActive,
        search,
        coachId,
        playerUserId,
        linkedPlayerId,
        linkedPlayerIds,
        page = 1,
        limit = 20,
    }) {
        const scopedLinkedPlayerIds = [...new Set((linkedPlayerIds || []).filter(Boolean))];
        const query = this.db('player_profiles')
            .whereNull('player_profiles.deleted_at')
            .modify((q) => {
                if (academyId) q.where('player_profiles.academy_id', academyId);
                if (branchId) q.where('player_profiles.branch_id', branchId);
                if (playerUserId) q.where('player_profiles.user_id', playerUserId);
                if (linkedPlayerId) q.where('player_profiles.id', linkedPlayerId);
                if (scopedLinkedPlayerIds.length) q.whereIn('player_profiles.id', scopedLinkedPlayerIds);
                if (Array.isArray(linkedPlayerIds) && scopedLinkedPlayerIds.length === 0) q.whereRaw('1 = 0');
                if (coachId) {
                    q.whereIn('player_profiles.id',
                        this.db('player_group_assignments as pga')
                            .join('coach_group_assignments as cga', 'pga.group_id', 'cga.group_id')
                            .where('cga.coach_id', coachId)
                            .whereNull('pga.left_at')
                            .select('pga.player_id'));
                }
                if (groupId) q.whereIn('player_profiles.id',
                        this.db('player_group_assignments').where({ group_id: groupId }).whereNull('left_at').select('player_id'));
                if (level) q.where('player_profiles.level', level);
                if (isActive !== undefined) q.where('player_profiles.is_active', isActive);
                if (search) {
                    q.where((searchQuery) => {
                        searchQuery
                            .where('player_profiles.full_name', 'ilike', `%${search}%`)
                            .orWhere('player_profiles.player_code', 'ilike', `%${search}%`);
                    });
                }
            });

        const [{ count }] = await query.clone().count('player_profiles.id as count');
        const data = await query
            .select(
                'player_profiles.id', 'player_profiles.full_name', 'player_profiles.date_of_birth',
                'player_profiles.player_code',
                'player_profiles.level',
                this.db.raw(`
                    COALESCE(
                        (
                            SELECT COALESCE(
                                cfo.label,
                                cfo_text.label,
                                pcv.value_text,
                                pcv.value_long_text,
                                json_options.labels
                            )
                            FROM player_custom_values pcv
                            JOIN custom_fields cf ON pcv.field_id = cf.id
                            LEFT JOIN custom_field_options cfo ON cfo.id = pcv.value_option_id
                            LEFT JOIN custom_field_options cfo_text
                                ON cfo_text.field_id = cf.id
                                AND cfo_text.id::text = pcv.value_text
                            LEFT JOIN LATERAL (
                                SELECT string_agg(
                                    COALESCE(cfo_json.label, option_id),
                                    ', '
                                    ORDER BY option_id
                                ) as labels
                                FROM jsonb_array_elements_text(
                                    CASE
                                        WHEN jsonb_typeof(pcv.value_json) = 'array' THEN pcv.value_json
                                        WHEN jsonb_typeof(pcv.value_json) = 'string'
                                            THEN jsonb_build_array(pcv.value_json #>> '{}')
                                        ELSE '[]'::jsonb
                                    END
                                ) as option_values(option_id)
                                LEFT JOIN custom_field_options cfo_json
                                    ON cfo_json.field_id = cf.id
                                    AND cfo_json.id::text = option_values.option_id
                            ) json_options ON true
                            WHERE pcv.player_id = player_profiles.id
                              AND regexp_replace(lower(cf.key), '[^a-z0-9]+', '_', 'g') = 'main_position'
                            ORDER BY pcv.updated_at DESC NULLS LAST
                            LIMIT 1
                        ),
                        player_profiles.position
                    ) as position
                `),
                'player_profiles.preferred_foot',
                'player_profiles.is_active', 'player_profiles.profile_status',
                'player_profiles.profile_completed_at', 'player_profiles.date_joined', 'player_profiles.created_at',
            )
            .orderBy('player_profiles.full_name', 'asc')
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total: +count, page, totalPages: Math.ceil(+count / limit) || 1 };
    }

    async findPlayerSummary(playerId) {
        return this.db('player_profiles')
            .where('player_profiles.id', playerId)
            .whereNull('player_profiles.deleted_at')
            .select('*')
            .first();
    }

    // ─── Measurements (owned by players module) ─────────────────────────
    async findMeasurements(playerId, { page = 1, limit = 20 } = {}) {
        const query = this.db('player_measurements')
            .where({ player_id: playerId });

        const [{ count }] = await query.clone().count('id as count');
        const data = await query
            .orderBy('measured_at', 'desc')
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total: +count, page, totalPages: Math.ceil(+count / limit) || 1 };
    }

    async addMeasurement(data) {
        const [row] = await this.db('player_measurements').insert(data).returning('*');
        return row;
    }

    // ─── Injuries (owned by players module) ─────────────────────────────
    async findInjuries(playerId, { page = 1, limit = 20 } = {}) {
        const query = this.db('player_injury_history')
            .where({ player_id: playerId });

        const [{ count }] = await query.clone().count('id as count');
        const data = await query
            .orderBy('injury_date', 'desc')
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total: +count, page, totalPages: Math.ceil(+count / limit) || 1 };
    }

    async addInjury(data) {
        const [row] = await this.db('player_injury_history').insert(data).returning('*');
        return row;
    }

    async recoverInjury(injuryId, recoveredAt) {
        const [row] = await this.db('player_injury_history')
            .where({ id: injuryId })
            .update({ recovery_date: recoveredAt })
            .returning('*');
        return row;
    }

    // ─── Group Assignments (owned by players module) ────────────────────
    async findGroupAssignments(playerId) {
        return this.db('player_group_assignments')
            .where({ player_id: playerId })
            .orderBy('joined_at', 'desc');
    }

    async findCurrentGroupAssignment(playerId, db = this.db) {
        return db('player_group_assignments')
            .where({ player_id: playerId })
            .whereNull('left_at')
            .orderBy('joined_at', 'desc')
            .first();
    }

    async coachCanAccessPlayer(coachId, playerId) {
        const groupAccess = await this.db('player_group_assignments as pga')
            .join('coach_group_assignments as cga', 'pga.group_id', 'cga.group_id')
            .where('cga.coach_id', coachId)
            .where('pga.player_id', playerId)
            .whereNull('pga.left_at')
            .first('pga.player_id');
        if (groupAccess) return groupAccess;

        return this.db('player_profiles as pp')
            .where('pp.id', playerId)
            .whereNull('pp.deleted_at')
            .whereExists((q) => {
                q.select(this.db.raw('1'))
                    .from('academy_birth_years as aby')
                    .whereRaw('aby.branch_id = pp.branch_id')
                    .whereNull('aby.deleted_at')
                    .whereRaw('EXTRACT(YEAR FROM pp.date_of_birth)::int BETWEEN aby.from_year AND aby.to_year')
                    .whereIn('aby.id', this._coachAccessibleBirthYearIdsQuery(coachId));
            })
            .first('pp.id as player_id');
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

    async findCoachBirthYearAccessForDate(coachId, branchId, birthYear, trx = this.db) {
        return trx('academy_birth_years as aby')
            .join('academy_branches as ab', 'aby.branch_id', 'ab.id')
            .where('aby.branch_id', branchId)
            .where('aby.from_year', '<=', birthYear)
            .where('aby.to_year', '>=', birthYear)
            .whereNull('aby.deleted_at')
            .whereNull('ab.deleted_at')
            .whereIn('aby.id', this._coachAccessibleBirthYearIdsQuery(coachId))
            .select('aby.*', 'ab.name as branch_name')
            .first();
    }

    async coachCanAccessGroup(coachId, groupId, db = this.db) {
        return db('coach_group_assignments')
            .where({ coach_id: coachId, group_id: groupId })
            .first('group_id');
    }

    async assignToGroup(playerId, groupId, db = this.db) {
        // Close previous assignment
        await db('player_group_assignments')
            .where({ player_id: playerId })
            .whereNull('left_at')
            .update({ left_at: new Date() });

        // Create new assignment
        const [row] = await db('player_group_assignments')
            .insert({ player_id: playerId, group_id: groupId, joined_at: new Date() })
            .returning('*');

        return row;
    }

    // ─── Parent-Player link (stubs — no parent_players table) ──────────
    async findChildrenByParent(parentUserId) {
        const linked = await this.db('parent_player_links as ppl')
            .join('player_profiles as pp', 'ppl.player_id', 'pp.id')
            .where('ppl.parent_user_id', parentUserId)
            .whereNull('ppl.deleted_at')
            .whereNull('pp.deleted_at')
            .select('pp.*', 'ppl.relation', 'ppl.is_primary');

        const legacy = await this.db('auth_users as au')
            .join('player_profiles as pp', 'au.linked_player_id', 'pp.id')
            .where('au.id', parentUserId)
            .where('au.role', 'parent')
            .whereNull('au.deleted_at')
            .whereNull('pp.deleted_at')
            .select('pp.*', this.db.raw("'guardian' as relation"), this.db.raw('true as is_primary'));

        const byId = new Map();
        [...linked, ...legacy].forEach((row) => {
            if (!byId.has(row.id)) byId.set(row.id, row);
        });
        return [...byId.values()];
    }

    async linkParentToPlayer(parentUserId, playerId) {
        const player = await this.findPlayerSummary(playerId);
        if (!player) return null;
        const [row] = await this.db('parent_player_links')
            .insert({
                academy_id: player.academy_id,
                parent_user_id: parentUserId,
                player_id: playerId,
                relation: 'guardian',
                is_primary: true,
                can_view_progress: true,
                can_view_payments: true,
                can_message_coach: true,
                created_by_user_id: parentUserId,
            })
            .onConflict(this.db.raw('(parent_user_id, player_id) where deleted_at is null'))
            .ignore()
            .returning('*');
        return row || this.db('parent_player_links')
            .where({ parent_user_id: parentUserId, player_id: playerId })
            .whereNull('deleted_at')
            .first();
    }

    async isParentOfPlayer(parentUserId, playerId) {
        const link = await this.db('parent_player_links')
            .where({ parent_user_id: parentUserId, player_id: playerId })
            .whereNull('deleted_at')
            .first();
        if (link) return true;
        const legacy = await this.db('auth_users')
            .where({ id: parentUserId, role: 'parent', linked_player_id: playerId })
            .whereNull('deleted_at')
            .first();
        return Boolean(legacy);
    }

    async findBranchByIdAndAcademy(branchId, academyId, db = this.db) {
        return db('academy_branches')
            .where({ id: branchId, academy_id: academyId })
            .whereNull('deleted_at')
            .first();
    }

    async findGroupByIdAndBranch(groupId, branchId, db = this.db) {
        return db('academy_groups as ag')
            .where('ag.id', groupId)
            .where('ag.branch_id', branchId)
            .whereNull('ag.deleted_at')
            .select('ag.*')
            .first();
    }

    async findAuthUserById(userId, db = this.db) {
        return db('auth_users')
            .where({ id: userId })
            .whereNull('deleted_at')
            .first('id', 'username', 'email', 'role', 'academy_id');
    }

    async findBranchesForImport(academyId, coachId = null) {
        const query = this.db('academy_branches as ab')
            .where('ab.academy_id', academyId)
            .whereNull('ab.deleted_at')
            .select('ab.id', 'ab.name')
            .distinct()
            .orderBy('ab.name', 'asc');

        if (coachId) {
            query
                .join('academy_birth_years as aby', 'aby.branch_id', 'ab.id')
                .whereNull('aby.deleted_at')
                .whereIn('aby.id', this._coachAccessibleBirthYearIdsQuery(coachId));
        }

        return query;
    }

    async findExistingImportUsers(usernames, phones, db = this.db) {
        if (!usernames.length && !phones.length) return [];
        return db('auth_users')
            .whereNull('deleted_at')
            .where((query) => {
                if (usernames.length) query.whereIn('username', usernames);
                if (phones.length) {
                    if (usernames.length) query.orWhereIn('phone', phones);
                    else query.whereIn('phone', phones);
                }
            })
            .select('id', 'username', 'phone', 'role', 'academy_id');
    }

    _scopeImportPlayers(query, coachId, db = this.db) {
        if (!coachId) return query;
        return query.where((access) => {
            access
                .whereExists((groupAccess) => {
                    groupAccess
                        .select(db.raw('1'))
                        .from('player_group_assignments as pga')
                        .join(
                            'coach_group_assignments as cga',
                            'pga.group_id',
                            'cga.group_id',
                        )
                        .whereRaw('pga.player_id = pp.id')
                        .where('cga.coach_id', coachId)
                        .whereNull('pga.left_at');
                })
                .orWhereExists((birthYearAccess) => {
                    birthYearAccess
                        .select(db.raw('1'))
                        .from('academy_birth_years as aby')
                        .whereRaw('aby.branch_id = pp.branch_id')
                        .whereNull('aby.deleted_at')
                        .whereRaw(
                            'EXTRACT(YEAR FROM pp.date_of_birth)::int BETWEEN aby.from_year AND aby.to_year',
                        )
                        .whereIn(
                            'aby.id',
                            this._coachAccessibleBirthYearIdsQuery(coachId),
                        );
                });
        });
    }

    _selectImportPlayerFields(query, db = this.db) {
        return query.select(
            'pp.*',
            'au.username',
            'au.phone as auth_phone',
            'au.is_active as auth_is_active',
            'ab.name as branch_name',
            db.raw(`(
                SELECT pm.height_cm
                FROM player_measurements pm
                WHERE pm.player_id = pp.id
                ORDER BY pm.measured_at DESC
                LIMIT 1
            ) as height_cm`),
            db.raw(`(
                SELECT pm.weight_kg
                FROM player_measurements pm
                WHERE pm.player_id = pp.id
                ORDER BY pm.measured_at DESC
                LIMIT 1
            ) as weight_kg`),
        );
    }

    async findImportPlayersByUsernames(
        academyId,
        usernames,
        coachId = null,
        db = this.db,
    ) {
        if (!usernames.length) return [];
        const query = db('player_profiles as pp')
            .join('auth_users as au', 'au.id', 'pp.user_id')
            .leftJoin('academy_branches as ab', 'ab.id', 'pp.branch_id')
            .where('pp.academy_id', academyId)
            .whereIn('au.username', usernames)
            .whereNull('pp.deleted_at')
            .whereNull('au.deleted_at');
        this._scopeImportPlayers(query, coachId, db);
        return this._selectImportPlayerFields(query, db);
    }

    async findPlayersForExport(academyId, coachId = null, db = this.db) {
        const query = db('player_profiles as pp')
            .join('auth_users as au', 'au.id', 'pp.user_id')
            .leftJoin('academy_branches as ab', 'ab.id', 'pp.branch_id')
            .where('pp.academy_id', academyId)
            .where('au.role', 'player')
            .whereNull('pp.deleted_at')
            .whereNull('au.deleted_at')
            .orderBy('pp.full_name', 'asc');
        this._scopeImportPlayers(query, coachId, db);
        return this._selectImportPlayerFields(query, db);
    }

    async createImportLog(data, db = this.db) {
        const [row] = await db('player_import_logs').insert(data).returning('*');
        return row;
    }

    async updateImportLog(id, data, db = this.db) {
        const [row] = await db('player_import_logs')
            .where({ id })
            .update({ ...data, updated_at: new Date() })
            .returning('*');
        return row;
    }

    async findAutoAssignableGroup(branchId, birthYear, trx = this.db) {
        return trx('academy_groups as ag')
            .join('group_birth_years as gby', 'gby.group_id', 'ag.id')
            .join('academy_birth_years as aby', 'aby.id', 'gby.birth_year_id')
            .leftJoin('player_group_assignments as pga', function joinCurrentPlayers() {
                this.on('pga.group_id', '=', 'ag.id').andOnNull('pga.left_at');
            })
            .where('ag.branch_id', branchId)
            .where('aby.from_year', '<=', birthYear)
            .where('aby.to_year', '>=', birthYear)
            .whereNull('ag.deleted_at')
            .whereNull('aby.deleted_at')
            .select(
                'ag.*',
                trx.raw('COUNT(DISTINCT pga.player_id)::int as player_count'),
            )
            .groupBy('ag.id')
            .havingRaw('(ag.max_players IS NULL OR COUNT(DISTINCT pga.player_id) < ag.max_players)')
            .orderBy('ag.created_at', 'asc')
            .first();
    }

    async findCoachAutoAssignableGroup(coachId, branchId, birthYear, trx = this.db) {
        return trx('academy_groups as ag')
            .join('coach_group_assignments as cga', 'cga.group_id', 'ag.id')
            .join('group_birth_years as gby', 'gby.group_id', 'ag.id')
            .join('academy_birth_years as aby', 'aby.id', 'gby.birth_year_id')
            .leftJoin('player_group_assignments as pga', function joinCurrentPlayers() {
                this.on('pga.group_id', '=', 'ag.id').andOnNull('pga.left_at');
            })
            .where('cga.coach_id', coachId)
            .where('ag.branch_id', branchId)
            .where('aby.from_year', '<=', birthYear)
            .where('aby.to_year', '>=', birthYear)
            .whereNull('ag.deleted_at')
            .whereNull('aby.deleted_at')
            .select(
                'ag.*',
                trx.raw('COUNT(DISTINCT pga.player_id)::int as player_count'),
            )
            .groupBy('ag.id')
            .havingRaw('(ag.max_players IS NULL OR COUNT(DISTINCT pga.player_id) < ag.max_players)')
            .orderBy('ag.created_at', 'asc')
            .first();
    }

    // ─── Player Code Generation ──────────────────────────────────────────
    /**
     * Atomically allocates the next sequential number for (category, year) and
     * returns the formatted player code string.
     *
     * Uses PostgreSQL's atomic INSERT … ON CONFLICT DO UPDATE … RETURNING
     * so that two concurrent inserts for the same (category, year) can never
     * receive the same sequence number — no explicit advisory locks needed.
     *
     * @param {string|Date} dateOfBirth  Used to derive the age category
     * @param {Knex.Transaction} [trx]   Pass the active transaction when creating
     *                                   a player profile so the counter increment
     *                                   and the profile insert are committed atomically
     * @returns {Promise<string>}  e.g. 'PLY-U14-2026-0003'
     */
    async generatePlayerCode(dateOfBirth, trx) {
        const db = trx || this.db;
        const category = getAgeCategory(dateOfBirth);
        const year = new Date().getFullYear();

        // Atomic upsert: insert the first row OR increment an existing one.
        // PostgreSQL guarantees this is serialisable — safe under concurrent load.
        const result = await db.raw(
            'INSERT INTO player_code_sequences (category, year, last_seq) VALUES (?, ?, 1) ON CONFLICT (category, year) DO UPDATE SET last_seq = player_code_sequences.last_seq + 1 RETURNING last_seq',
            [category, year],
        );

        const seq = result.rows[0].last_seq;
        return buildPlayerCode(category, year, seq);
    }
}

module.exports = PlayersRepository;
