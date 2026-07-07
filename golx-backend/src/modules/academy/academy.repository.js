const BaseRepository = require('../../shared/base.repository');

class AcademyRepository extends BaseRepository {
    constructor(db) {
        super('academy_academies', db);
    }

    async findPublicAcademyProfile() {
        return this.db('academy_academies')
            .whereNull('deleted_at')
            .orderBy('created_at', 'asc')
            .first(
                'id',
                'name',
                'email',
                'phone',
                'address',
                'logo_url',
                'settings',
            );
    }

    // ─── Branches ───────────────────────────────────────────────────────
    async findBranches(academyId, { page = 1, limit = 20 } = {}) {
        const query = this.db('academy_branches')
            .where({ academy_id: academyId })
            .whereNull('deleted_at');

        const [{ count }] = await query.clone().count('id as count');
        const data = await query
            .select('*')
            .orderBy('name', 'asc')
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total: +count, page, totalPages: Math.ceil(+count / limit) || 1 };
    }

    async findBranchById(id) {
        return this.db('academy_branches').where({ id }).whereNull('deleted_at').first();
    }

    async createBranch(data) {
        const [row] = await this.db('academy_branches').insert(data).returning('*');
        return row;
    }

    async updateBranch(id, data) {
        const [row] = await this.db('academy_branches')
            .where({ id }).whereNull('deleted_at')
            .update({ ...data, updated_at: new Date() }).returning('*');
        return row;
    }

    async softDeleteBranch(id) {
        return this.db('academy_branches').where({ id }).update({ deleted_at: new Date() });
    }

    async getBranchActiveRelations(branchId) {
        const countId = (query) => query.count({ count: 'id' }).first();
        const countSessionId = (query) => query.count({ count: 's.id' }).first();
        const countMatchId = (query) => query.count({ count: 'm.id' }).first();

        const [birthYears, groups, coaches, players, sessions, matches] = await Promise.all([
            countId(this.db('academy_birth_years').where({ branch_id: branchId }).whereNull('deleted_at')),
            countId(this.db('academy_groups').where({ branch_id: branchId }).whereNull('deleted_at')),
            countId(this.db('coach_profiles').where({ branch_id: branchId }).whereNull('deleted_at')),
            countId(this.db('player_profiles').where({ branch_id: branchId }).whereNull('deleted_at')),
            countSessionId(
                this.db('attendance_sessions as s')
                    .join('academy_groups as ag', 's.group_id', 'ag.id')
                    .where('ag.branch_id', branchId),
            ),
            countMatchId(
                this.db('matches as m')
                    .leftJoin('academy_groups as team', 'm.team_id', 'team.id')
                    .leftJoin('academy_groups as age_group', 'm.age_group_id', 'age_group.id')
                    .where((q) => q.where('team.branch_id', branchId).orWhere('age_group.branch_id', branchId)),
            ),
        ]);

        return [
            { key: 'birthYears', label: 'birth years', count: Number(birthYears?.count || 0) },
            { key: 'groups', label: 'groups', count: Number(groups?.count || 0) },
            { key: 'coaches', label: 'coaches', count: Number(coaches?.count || 0) },
            { key: 'players', label: 'players', count: Number(players?.count || 0) },
            { key: 'sessions', label: 'attendance sessions', count: Number(sessions?.count || 0) },
            { key: 'matches', label: 'matches', count: Number(matches?.count || 0) },
        ].filter((relation) => relation.count > 0);
    }

    async branchHasActiveRelations(branchId) {
        const relations = await this.getBranchActiveRelations(branchId);
        return relations.length > 0;
    }

    // ─── Groups ─────────────────────────────────────────────────────────
    async findGroupsByBranch(branchId, { page = 1, limit = 20 } = {}) {
        const query = this.db('academy_groups as ag')
            .join('academy_branches as ab', 'ag.branch_id', 'ab.id')
            .leftJoin('group_birth_years as gby', 'gby.group_id', 'ag.id')
            .leftJoin('academy_birth_years as aby', function joinBirthYears() {
                this.on('aby.id', '=', 'gby.birth_year_id').andOnNull('aby.deleted_at');
            })
            .where('ag.branch_id', branchId)
            .whereNull('ag.deleted_at')
            .whereNull('ab.deleted_at');

        const [{ count }] = await query.clone().countDistinct('ag.id as count');
        const data = await query
            .leftJoin('player_group_assignments as pga', function joinCurrentPlayers() {
                this.on('pga.group_id', '=', 'ag.id').andOnNull('pga.left_at');
            })
            .leftJoin('player_profiles as pp', function joinPlayers() {
                this.on('pp.id', '=', 'pga.player_id').andOnNull('pp.deleted_at');
            })
            .leftJoin('coach_group_assignments as cga', 'cga.group_id', 'ag.id')
            .select(
                'ag.*',
                'ab.id as branch_id',
                'ab.name as branch_name',
                this.db.raw('COUNT(DISTINCT pga.player_id)::int as player_count'),
                this.db.raw('COUNT(DISTINCT cga.coach_id)::int as coach_count'),
                this.db.raw("COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', aby.id, 'label', aby.label, 'normalizedLabel', aby.normalized_label, 'fromYear', aby.from_year, 'toYear', aby.to_year)) FILTER (WHERE aby.id IS NOT NULL), '[]') as birth_years"),
                this.db.raw("COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', pp.id, 'fullName', pp.full_name, 'playerCode', pp.player_code, 'birthDate', pp.date_of_birth)) FILTER (WHERE pp.id IS NOT NULL), '[]') as players"),
            )
            .groupBy('ag.id', 'ab.id', 'ab.name')
            .orderBy('ag.name', 'asc')
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total: +count, page, totalPages: Math.ceil(+count / limit) || 1 };
    }

    async findBranchesForCoachUser(userId, academyId, { page = 1, limit = 20 } = {}) {
        const query = this.db('academy_branches as ab')
            .where('ab.academy_id', academyId)
            .whereNull('ab.deleted_at')
            .whereIn('ab.id', function assignedBranches() {
                this.select('branch_id')
                    .from(function branchUnion() {
                        this.select('cba.branch_id')
                            .from('coach_branch_assignments as cba')
                            .join('coach_profiles as cp', 'cba.coach_id', 'cp.id')
                            .where('cp.user_id', userId)
                            .union(function groupBranches() {
                                this.select('ag.branch_id')
                                    .from('coach_group_assignments as cga')
                                    .join('coach_profiles as cp2', 'cga.coach_id', 'cp2.id')
                                    .join('academy_groups as ag', 'cga.group_id', 'ag.id')
                                    .where('cp2.user_id', userId);
                            })
                            .as('coach_branch_scope');
                    });
            });

        const [{ count }] = await query.clone().countDistinct('ab.id as count');
        const data = await query
            .select('ab.*')
            .distinct()
            .orderBy('ab.name', 'asc')
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total: +count, page, totalPages: Math.ceil(+count / limit) || 1 };
    }

    async findGroups(academyId, { branchId, page = 1, limit = 50 } = {}) {
        const query = this.db('academy_groups as ag')
            .join('academy_branches as ab', 'ag.branch_id', 'ab.id')
            .leftJoin('group_birth_years as gby', 'gby.group_id', 'ag.id')
            .leftJoin('academy_birth_years as aby', function joinBirthYears() {
                this.on('aby.id', '=', 'gby.birth_year_id').andOnNull('aby.deleted_at');
            })
            .where('ab.academy_id', academyId)
            .whereNull('ag.deleted_at')
            .whereNull('ab.deleted_at')
            .modify((q) => {
                if (branchId) q.where('ab.id', branchId);
            });

        const [{ count }] = await query.clone().countDistinct('ag.id as count');
        const data = await query
            .leftJoin('player_group_assignments as pga', function joinCurrentPlayers() {
                this.on('pga.group_id', '=', 'ag.id').andOnNull('pga.left_at');
            })
            .leftJoin('player_profiles as pp', function joinPlayers() {
                this.on('pp.id', '=', 'pga.player_id').andOnNull('pp.deleted_at');
            })
            .leftJoin('coach_group_assignments as cga', 'cga.group_id', 'ag.id')
            .select(
                'ag.*',
                'ab.id as branch_id',
                'ab.name as branch_name',
                this.db.raw('COUNT(DISTINCT pga.player_id)::int as player_count'),
                this.db.raw('COUNT(DISTINCT cga.coach_id)::int as coach_count'),
                this.db.raw("COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', aby.id, 'label', aby.label, 'normalizedLabel', aby.normalized_label, 'fromYear', aby.from_year, 'toYear', aby.to_year)) FILTER (WHERE aby.id IS NOT NULL), '[]') as birth_years"),
                this.db.raw("COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', pp.id, 'fullName', pp.full_name, 'playerCode', pp.player_code, 'birthDate', pp.date_of_birth)) FILTER (WHERE pp.id IS NOT NULL), '[]') as players"),
            )
            .groupBy('ag.id', 'ab.id', 'ab.name')
            .orderBy('ab.name', 'asc')
            .orderBy('ag.name', 'asc')
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total: +count, page, totalPages: Math.ceil(+count / limit) || 1 };
    }

    async findGroupsForCoachUser(userId, academyId, { branchId, page = 1, limit = 50 } = {}) {
        const query = this.db('academy_groups as ag')
            .join('academy_branches as ab', 'ag.branch_id', 'ab.id')
            .join('coach_group_assignments as cga', 'cga.group_id', 'ag.id')
            .join('coach_profiles as cp', 'cga.coach_id', 'cp.id')
            .leftJoin('group_birth_years as gby', 'gby.group_id', 'ag.id')
            .leftJoin('academy_birth_years as aby', function joinBirthYears() {
                this.on('aby.id', '=', 'gby.birth_year_id').andOnNull('aby.deleted_at');
            })
            .where('cp.user_id', userId)
            .where('ab.academy_id', academyId)
            .whereNull('ag.deleted_at')
            .whereNull('ab.deleted_at')
            .modify((q) => {
                if (branchId) q.where('ab.id', branchId);
            });

        const [{ count }] = await query.clone().countDistinct('ag.id as count');
        const data = await query
            .leftJoin('player_group_assignments as pga', function joinCurrentPlayers() {
                this.on('pga.group_id', '=', 'ag.id').andOnNull('pga.left_at');
            })
            .leftJoin('player_profiles as pp', function joinPlayers() {
                this.on('pp.id', '=', 'pga.player_id').andOnNull('pp.deleted_at');
            })
            .select(
                'ag.*',
                'ab.id as branch_id',
                'ab.name as branch_name',
                this.db.raw('COUNT(DISTINCT pga.player_id)::int as player_count'),
                this.db.raw('1::int as coach_count'),
                this.db.raw("COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', aby.id, 'label', aby.label, 'normalizedLabel', aby.normalized_label, 'fromYear', aby.from_year, 'toYear', aby.to_year)) FILTER (WHERE aby.id IS NOT NULL), '[]') as birth_years"),
                this.db.raw("COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', pp.id, 'fullName', pp.full_name, 'playerCode', pp.player_code, 'birthDate', pp.date_of_birth)) FILTER (WHERE pp.id IS NOT NULL), '[]') as players"),
            )
            .groupBy('ag.id', 'ab.id', 'ab.name')
            .orderBy('ab.name', 'asc')
            .orderBy('ag.name', 'asc')
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total: +count, page, totalPages: Math.ceil(+count / limit) || 1 };
    }

    async findGroupById(id) {
        return this.db('academy_groups as ag')
            .join('academy_branches as ab', 'ag.branch_id', 'ab.id')
            .leftJoin('group_birth_years as gby', 'gby.group_id', 'ag.id')
            .leftJoin('academy_birth_years as aby', function joinBirthYears() {
                this.on('aby.id', '=', 'gby.birth_year_id').andOnNull('aby.deleted_at');
            })
            .leftJoin('player_group_assignments as pga', function joinCurrentPlayers() {
                this.on('pga.group_id', '=', 'ag.id').andOnNull('pga.left_at');
            })
            .leftJoin('player_profiles as pp', function joinPlayers() {
                this.on('pp.id', '=', 'pga.player_id').andOnNull('pp.deleted_at');
            })
            .where('ag.id', id)
            .whereNull('ag.deleted_at')
            .select(
                'ag.*',
                'ab.id as branch_id',
                'ab.academy_id',
                'ab.name as branch_name',
                this.db.raw("COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', aby.id, 'label', aby.label, 'normalizedLabel', aby.normalized_label, 'fromYear', aby.from_year, 'toYear', aby.to_year)) FILTER (WHERE aby.id IS NOT NULL), '[]') as birth_years"),
                this.db.raw("COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', pp.id, 'fullName', pp.full_name, 'playerCode', pp.player_code, 'birthDate', pp.date_of_birth)) FILTER (WHERE pp.id IS NOT NULL), '[]') as players"),
            )
            .groupBy('ag.id', 'ab.id', 'ab.academy_id', 'ab.name')
            .first();
    }

    async createGroup(data) {
        const [row] = await this.db('academy_groups').insert(data).returning('*');
        return row;
    }

    async updateGroup(id, data) {
        const [row] = await this.db('academy_groups')
            .where({ id }).whereNull('deleted_at')
            .update({ ...data, updated_at: new Date() }).returning('*');
        return row;
    }

    async softDeleteGroup(id) {
        return this.db('academy_groups').where({ id }).update({ deleted_at: new Date() });
    }

    // ─── Birth Years ────────────────────────────────────────────────────
    async findBirthYears(branchId) {
        return this.db('academy_birth_years as aby')
            .leftJoin('coach_profiles as creator_coach', 'aby.created_by_coach_id', 'creator_coach.id')
            .leftJoin('auth_users as creator_user', 'aby.created_by_user_id', 'creator_user.id')
            .where('aby.branch_id', branchId)
            .whereNull('aby.deleted_at')
            .select(
                'aby.*',
                this.db.raw("COALESCE(creator_coach.full_name, creator_user.username, creator_user.email) as created_by_name"),
            )
            .orderBy('normalized_label', 'asc')
            .orderBy('from_year', 'asc');
    }

    async createBirthYear(data) {
        const [row] = await this.db('academy_birth_years').insert(data).returning('*');
        return row;
    }

    async findBirthYearById(id) {
        return this.db('academy_birth_years')
            .where({ id })
            .whereNull('deleted_at')
            .first();
    }

    async findBirthYearDetail(id) {
        const birthYear = await this.db('academy_birth_years as aby')
            .join('academy_branches as ab', 'aby.branch_id', 'ab.id')
            .leftJoin('coach_profiles as creator_coach', 'aby.created_by_coach_id', 'creator_coach.id')
            .leftJoin('auth_users as creator_user', 'aby.created_by_user_id', 'creator_user.id')
            .where('aby.id', id)
            .whereNull('aby.deleted_at')
            .whereNull('ab.deleted_at')
            .select(
                'aby.*',
                'ab.name as branch_name',
                'ab.academy_id',
                this.db.raw("COALESCE(creator_coach.full_name, creator_user.username, creator_user.email) as created_by_name"),
            )
            .first();
        if (!birthYear) return null;

        const [groups, players, coaches] = await Promise.all([
            this.db('academy_groups as ag')
                .join('group_birth_years as gby', 'gby.group_id', 'ag.id')
                .where('gby.birth_year_id', id)
                .whereNull('ag.deleted_at')
                .select('ag.id', 'ag.name', 'ag.description', 'ag.max_players', 'ag.assignment_mode'),
            this.db('player_profiles')
                .where({ branch_id: birthYear.branch_id })
                .whereRaw('EXTRACT(YEAR FROM date_of_birth)::int BETWEEN ? AND ?', [birthYear.from_year, birthYear.to_year])
                .whereNull('deleted_at')
                .select('id', 'full_name', 'player_code', 'date_of_birth', 'phone', 'level', 'position')
                .orderBy('player_code', 'asc'),
            this.db('coach_profiles')
                .where({ branch_id: birthYear.branch_id })
                .whereNull('deleted_at')
                .select('id', 'first_name', 'last_name', 'full_name', 'email', 'phone', 'role', 'image', 'photo_url')
                .orderBy('first_name', 'asc'),
        ]);

        return { birthYear, groups, players, coaches };
    }

    async updateBirthYear(id, data) {
        const [row] = await this.db('academy_birth_years')
            .where({ id })
            .whereNull('deleted_at')
            .update({ ...data, updated_at: new Date() })
            .returning('*');
        return row;
    }

    async softDeleteBirthYear(id) {
        return this.db('academy_birth_years')
            .where({ id })
            .whereNull('deleted_at')
            .update({ deleted_at: new Date() });
    }

    async updateBirthYearRange(id, { fromYear, toYear }, trx = this.db) {
        const [row] = await trx('academy_birth_years')
            .where({ id })
            .whereNull('deleted_at')
            .update({
                from_year: fromYear,
                to_year: toYear,
                updated_at: new Date(),
            })
            .returning('*');
        return row;
    }

    async moveBirthYearGroupLinks(sourceBirthYearId, targetBirthYearId, trx = this.db) {
        const rows = await trx('group_birth_years')
            .where({ birth_year_id: sourceBirthYearId })
            .select('group_id');

        if (!rows.length) return;

        await trx('group_birth_years')
            .where({ birth_year_id: sourceBirthYearId })
            .del();

        const existingTargetRows = await trx('group_birth_years')
            .where({ birth_year_id: targetBirthYearId })
            .whereIn('group_id', rows.map((row) => row.group_id))
            .select('group_id');
        const existingTargetGroupIds = new Set(existingTargetRows.map((row) => row.group_id));
        const newRows = rows
            .filter((row) => !existingTargetGroupIds.has(row.group_id))
            .map((row) => ({
                group_id: row.group_id,
                birth_year_id: targetBirthYearId,
                created_at: new Date(),
            }));

        if (newRows.length) await trx('group_birth_years').insert(newRows);
    }

    async findBirthYearOverlap(branchId, fromYear, toYear, excludeId = null) {
        return this.db('academy_birth_years')
            .where({ branch_id: branchId })
            .whereNull('deleted_at')
            .modify((q) => {
                if (Array.isArray(excludeId) && excludeId.length) q.whereNotIn('id', excludeId);
                else if (excludeId) q.whereNot('id', excludeId);
            })
            .where('from_year', '<=', toYear)
            .andWhere('to_year', '>=', fromYear)
            .first();
    }

    async findBirthYearLabels(branchId, normalizedLabels) {
        return this.db('academy_birth_years')
            .where({ branch_id: branchId })
            .whereIn('normalized_label', normalizedLabels)
            .whereNull('deleted_at')
            .distinct('normalized_label');
    }

    async findBirthYearsByIds(branchId, birthYearIds) {
        if (!birthYearIds.length) return [];
        return this.db('academy_birth_years')
            .where({ branch_id: branchId })
            .whereIn('id', birthYearIds)
            .whereNull('deleted_at')
            .select('*');
    }

    async findBirthYearsByLabels(branchId, normalizedLabels) {
        if (!normalizedLabels.length) return [];
        return this.db('academy_birth_years')
            .where({ branch_id: branchId })
            .whereIn('normalized_label', normalizedLabels)
            .whereNull('deleted_at')
            .select('*');
    }

    async replaceGroupBirthYears(groupId, birthYearIds, trx = this.db) {
        await trx('group_birth_years').where({ group_id: groupId }).del();
        if (!birthYearIds.length) return;
        const rows = birthYearIds.map((birthYearId) => ({
            group_id: groupId,
            birth_year_id: birthYearId,
            created_at: new Date(),
        }));
        await trx('group_birth_years').insert(rows);
    }

    async findPlayersByIds(branchId, playerIds) {
        if (!playerIds.length) return [];
        return this.db('player_profiles')
            .where({ branch_id: branchId })
            .whereIn('id', playerIds)
            .whereNull('deleted_at')
            .select('id');
    }

    async findPlayersByCodeRange(branchId, fromCode, toCode) {
        if (!fromCode || !toCode) return [];
        const from = String(fromCode).trim().toUpperCase();
        const to = String(toCode).trim().toUpperCase();
        const [start, end] = from.localeCompare(to, undefined, { numeric: true }) <= 0
            ? [from, to]
            : [to, from];

        return this.db('player_profiles')
            .where({ branch_id: branchId })
            .whereNull('deleted_at')
            .whereNotNull('player_code')
            .whereRaw('UPPER(player_code) >= ?', [start])
            .whereRaw('UPPER(player_code) <= ?', [end])
            .orderBy('player_code', 'asc')
            .select('id', 'player_code');
    }

    async replaceGroupPlayers(groupId, playerIds, trx = this.db) {
        await trx('player_group_assignments')
            .where({ group_id: groupId })
            .whereNull('left_at')
            .update({ left_at: new Date() });

        if (!playerIds.length) return;

        await trx('player_group_assignments')
            .whereIn('player_id', playerIds)
            .whereNull('left_at')
            .update({ left_at: new Date() });

        await trx('player_group_assignments').insert(playerIds.map((playerId) => ({
            player_id: playerId,
            group_id: groupId,
            joined_at: new Date(),
        })));
    }

    async replaceGroupLabels(groupId, normalizedLabels, trx = this.db) {
        await trx('group_labels').where({ group_id: groupId }).del();
        if (!normalizedLabels.length) return;
        const rows = normalizedLabels.map((label) => ({
            group_id: groupId,
            normalized_label: label,
            created_at: new Date(),
        }));
        await trx('group_labels').insert(rows);
    }

    async clearGroupLabels(groupId) {
        return this.db('group_labels').where({ group_id: groupId }).del();
    }

    async groupHasActiveRelations(groupId) {
        const [players, sessions, matches, records] = await Promise.all([
            this.db('player_group_assignments').where({ group_id: groupId }).whereNull('left_at').first('id'),
            this.db('attendance_sessions').where({ group_id: groupId }).first('id'),
            this.db('matches')
                .where((q) => q.where({ team_id: groupId }).orWhere({ age_group_id: groupId }))
                .first('id'),
            this.db('match_records').where({ group_id: groupId }).first('id'),
        ]);
        return !!(players || sessions || matches || records);
    }

    async birthYearHasActiveRelations(branchId, normalizedLabel) {
        const groupIds = await this.db('academy_groups as ag')
            .join('group_birth_years as gby', 'gby.group_id', 'ag.id')
            .join('academy_birth_years as aby', 'aby.id', 'gby.birth_year_id')
            .where('ag.branch_id', branchId)
            .where('aby.normalized_label', normalizedLabel)
            .whereNull('ag.deleted_at')
            .select('ag.id');

        if (!groupIds.length) return false;
        const ids = groupIds.map((row) => row.id);

        const [players, sessions, matches, records] = await Promise.all([
            this.db('player_group_assignments').whereIn('group_id', ids).whereNull('left_at').first('id'),
            this.db('attendance_sessions').whereIn('group_id', ids).first('id'),
            this.db('matches')
                .where((q) => q.whereIn('team_id', ids).orWhereIn('age_group_id', ids))
                .first('id'),
            this.db('match_records').whereIn('group_id', ids).first('id'),
        ]);

        return !!(players || sessions || matches || records);
    }

    // ─── Schedules ──────────────────────────────────────────────────────
    async findSchedulesByGroup(groupId) {
        return this.db('academy_schedules')
            .where({ group_id: groupId })
            .orderBy('day_of_week', 'asc');
    }

    async createSchedule(data) {
        const [row] = await this.db('academy_schedules').insert(data).returning('*');
        return row;
    }

    async deleteSchedule(id) {
        return this.db('academy_schedules').where({ id }).del();
    }
}

module.exports = AcademyRepository;
