const { BadRequestError } = require('../../shared/errors');
const { ensureIamForAuthUser } = require('../../shared/iam-sync');
const AdminDashboardRepository = require('./repositories/dashboard.repository');

const PROTECTED_ROLE_CODES = new Set(['super_admin', 'academy_owner', 'player']);

class AdminRepository extends AdminDashboardRepository {
    constructor(db) {
        super(db);
    }
    // IAM roles, permissions, and academy access accounts.
    async getAccessControl(academyId) {
        const db = this.db;
        const [permissionRows, roleRows, userRows, userRoleRows] = await Promise.all([
            this.db('iam_permissions as p')
                .leftJoin('iam_permission_groups as pg', 'p.group_id', 'pg.id')
                .select(
                    'p.id',
                    'p.code',
                    'p.resource',
                    'p.action',
                    'p.scope',
                    'p.description',
                    'p.is_system as isSystem',
                    'pg.id as groupId',
                    'pg.code as groupCode',
                    'pg.name as groupName',
                    'pg.description as groupDescription',
                    'pg.sort_order as groupSortOrder',
                )
                .orderBy('pg.sort_order', 'asc')
                .orderBy('p.resource', 'asc')
                .orderBy('p.action', 'asc'),
            this.db('iam_roles as r')
                .leftJoin('iam_user_roles as ur', function joinAssignments() {
                    this.on('ur.role_id', '=', 'r.id')
                        .andOn('ur.academy_id', '=', db.raw('?', [academyId]))
                        .andOnNull('ur.revoked_at')
                        .andOn(function activeAssignment() {
                            this.onNull('ur.expires_at').orOn('ur.expires_at', '>', db.raw('now()'));
                        });
                })
                .whereNull('r.deleted_at')
                .where(function scopedRoles() {
                    this.whereNull('r.academy_id').orWhere('r.academy_id', academyId);
                })
                .select(
                    'r.id',
                    'r.academy_id as academyId',
                    'r.code',
                    'r.name',
                    'r.description',
                    'r.is_system as isSystem',
                    'r.is_active as isActive',
                    'r.priority',
                    'r.created_at as createdAt',
                    'r.updated_at as updatedAt',
                    this.db.raw('COUNT(DISTINCT ur.user_id)::int as "userCount"'),
                )
                .groupBy('r.id')
                .orderBy('r.is_system', 'desc')
                .orderBy('r.priority', 'asc')
                .orderBy('r.name', 'asc'),
            this.db('auth_users as au')
                .leftJoin('iam_users as iu', 'iu.id', 'au.id')
                .where('au.academy_id', academyId)
                .where('au.role', 'admin')
                .whereNull('au.deleted_at')
                .select(
                    'au.id',
                    'au.email',
                    'au.username',
                    'au.phone',
                    'au.role',
                    'au.is_active as isActive',
                    'iu.address',
                    'iu.job_title as jobTitle',
                    'iu.department',
                    'iu.notes',
                    this.db.raw('COALESCE(iu.full_name, au.username, au.email, au.phone, au.role::text) as "fullName"'),
                )
                .orderBy('fullName', 'asc'),
            this.db('iam_user_roles as ur')
                .join('iam_roles as r', 'ur.role_id', 'r.id')
                .where('ur.academy_id', academyId)
                .whereNull('ur.revoked_at')
                .where(function activeAssignment() {
                    this.whereNull('ur.expires_at').orWhere('ur.expires_at', '>', new Date());
                })
                .whereNull('r.deleted_at')
                .select(
                    'ur.id',
                    'ur.user_id as userId',
                    'ur.role_id as roleId',
                    'ur.scope_branch_id as scopeBranchId',
                    'ur.scope_group_id as scopeGroupId',
                    'ur.granted_at as grantedAt',
                    'ur.expires_at as expiresAt',
                ),
        ]);

        const permissionsByRole = await this.db('iam_role_permissions as rp')
            .join('iam_roles as r', 'rp.role_id', 'r.id')
            .whereNull('r.deleted_at')
            .where(function scopedRoles() {
                this.whereNull('r.academy_id').orWhere('r.academy_id', academyId);
            })
            .select(
                'rp.role_id as roleId',
                'rp.permission_id as permissionId',
                'rp.denied',
            );

        const permissionMap = permissionsByRole.reduce((acc, row) => {
            if (!acc.has(row.roleId)) acc.set(row.roleId, []);
            acc.get(row.roleId).push({
                permissionId: row.permissionId,
                denied: Boolean(row.denied),
            });
            return acc;
        }, new Map());

        const groups = new Map();
        for (const row of permissionRows) {
            const groupKey = row.groupId || 'ungrouped';
            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    id: row.groupId,
                    code: row.groupCode || 'ungrouped',
                    name: row.groupName || 'Ungrouped',
                    description: row.groupDescription || null,
                    sortOrder: Number(row.groupSortOrder || 999),
                    permissions: [],
                });
            }

            groups.get(groupKey).permissions.push({
                id: row.id,
                code: row.code,
                resource: row.resource,
                action: row.action,
                scope: row.scope,
                description: row.description,
                isSystem: Boolean(row.isSystem),
            });
        }

        return {
            permissionGroups: Array.from(groups.values()),
            roles: roleRows.map((role) => ({
                ...role,
                isSystem: Boolean(role.isSystem),
                isActive: Boolean(role.isActive),
                userCount: Number(role.userCount || 0),
                permissionAssignments: permissionMap.get(role.id) || [],
            })),
            users: userRows.map((user) => ({
                ...user,
                isActive: Boolean(user.isActive),
                roleAssignments: userRoleRows
                    .filter((assignment) => assignment.userId === user.id)
                    .map((assignment) => ({
                        id: assignment.id,
                        roleId: assignment.roleId,
                        scopeBranchId: assignment.scopeBranchId,
                        scopeGroupId: assignment.scopeGroupId,
                        grantedAt: assignment.grantedAt,
                        expiresAt: assignment.expiresAt,
                    })),
            })),
        };
    }

    async findAcademyUser(userId, academyId) {
        return this.db('auth_users')
            .where({ id: userId, academy_id: academyId })
            .whereNull('deleted_at')
            .first();
    }

    async findAssignableRole(roleId, academyId) {
        return this.db('iam_roles')
            .where({ id: roleId, is_active: true })
            .whereNull('deleted_at')
            .where(function scopedRole() {
                this.whereNull('academy_id').orWhere('academy_id', academyId);
            })
            .first();
    }

    async findIdentityConflict({ email, phone, username }) {
        const normalizedEmail = email ? email.toLowerCase() : null;
        const normalizedUsername = username ? username.toLowerCase() : null;

        const authUser = await this.db('auth_users')
            .whereNull('deleted_at')
            .where((query) => {
                if (normalizedUsername) query.orWhereRaw('lower(username) = ?', [normalizedUsername]);
                if (normalizedEmail) query.orWhereRaw('lower(email) = ?', [normalizedEmail]);
                if (phone) query.orWhere('phone', phone);
            })
            .first('id', 'username', 'email', 'phone', 'role');

        if (authUser) {
            if (normalizedUsername && authUser.username?.toLowerCase() === normalizedUsername) {
                return { field: 'username', value: username };
            }
            if (normalizedEmail && authUser.email?.toLowerCase() === normalizedEmail) {
                return { field: 'email', value: email };
            }
            if (phone && authUser.phone === phone) {
                return { field: 'phone', value: phone };
            }
            return { field: 'login details', value: null };
        }

        const hasIamUsers = await this.db.schema.hasTable('iam_users');
        if (!hasIamUsers) return null;

        const iamUser = await this.db('iam_users')
            .whereNull('deleted_at')
            .where((query) => {
                if (normalizedUsername) query.orWhereRaw('lower(username) = ?', [normalizedUsername]);
                if (normalizedEmail) query.orWhereRaw('lower(email) = ?', [normalizedEmail]);
                if (phone) query.orWhere('phone', phone);
            })
            .first('id', 'username', 'email', 'phone');

        if (!iamUser) return null;
        if (normalizedUsername && iamUser.username?.toLowerCase() === normalizedUsername) {
            return { field: 'username', value: username };
        }
        if (normalizedEmail && iamUser.email?.toLowerCase() === normalizedEmail) {
            return { field: 'email', value: email };
        }
        if (phone && iamUser.phone === phone) {
            return { field: 'phone', value: phone };
        }
        return { field: 'login details', value: null };
    }

    async roleHasAnyPermission(roleId, academyId, permissionCodes) {
        const row = await this.db('iam_roles as r')
            .join('iam_role_permissions as rp', 'rp.role_id', 'r.id')
            .join('iam_permissions as p', 'p.id', 'rp.permission_id')
            .where('r.id', roleId)
            .where('r.is_active', true)
            .whereNull('r.deleted_at')
            .where(function scopedRole() {
                this.whereNull('r.academy_id').orWhere('r.academy_id', academyId);
            })
            .where(function grantedPermission() {
                this.where('rp.denied', false).orWhereNull('rp.denied');
            })
            .whereIn('p.code', permissionCodes)
            .first('p.id');
        return Boolean(row);
    }

    splitFullName(fullName) {
        const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
        return {
            firstName: parts[0] || 'User',
            lastName: parts.slice(1).join(' ') || 'Account',
        };
    }

    async getDefaultBranchId(academyId, trx = this.db) {
        const branch = await trx('academy_branches')
            .where({ academy_id: academyId })
            .whereNull('deleted_at')
            .orderBy('created_at', 'asc')
            .first('id');
        return branch?.id || null;
    }

    async createCoachProfileForAccessUser(trx, { academyId, user, fullName, email, phone, username, jobTitle }) {
        const branchId = user.branch_id || await this.getDefaultBranchId(academyId, trx);
        if (!branchId) {
            throw new BadRequestError('A branch is required before creating a coach login user');
        }

        const existing = await trx('coach_profiles')
            .where({ user_id: user.id })
            .whereNull('deleted_at')
            .first('id');
        if (existing) return existing;

        const { firstName, lastName } = this.splitFullName(fullName);
        const coachRole = jobTitle || 'head_coach';
        const [coach] = await trx('coach_profiles')
            .insert({
                user_id: user.id,
                academy_id: academyId,
                branch_id: branchId,
                full_name: fullName,
                first_name: firstName,
                last_name: lastName,
                email: email || `${username}@goalix.local`,
                phone,
                role: coachRole,
                specialization: coachRole,
            })
            .returning('*');

        return coach;
    }

    async assignExclusiveRoleToUser(trx, { academyId, roleId, targetUserId, grantedBy, targetUser: providedTargetUser }) {
        const targetUser = providedTargetUser || await trx('auth_users')
            .where({ id: targetUserId, academy_id: academyId })
            .whereNull('deleted_at')
            .first();
        if (!targetUser) return null;
        if (targetUser.role === 'player') {
            throw new BadRequestError('Players are managed from the Players page and cannot be assigned here');
        }

        const role = await trx('iam_roles')
            .where({ id: roleId, is_active: true })
            .whereNull('deleted_at')
            .where(function scopedRole() {
                this.whereNull('academy_id').orWhere('academy_id', academyId);
            })
            .first();
        if (!role) return null;
        if (PROTECTED_ROLE_CODES.has(role.code)) {
            throw new BadRequestError(`${role.name} is a protected system role and cannot be assigned from this screen`);
        }

        const iamUser = await trx('iam_users')
            .where({ id: targetUser.id })
            .whereNull('deleted_at')
            .first('full_name as fullName');
        await ensureIamForAuthUser(trx, targetUser, {
            fullName: iamUser?.fullName,
            grantedBy,
            skipDefaultRole: true,
        });

        const existing = await trx('iam_user_roles')
            .where({
                user_id: targetUserId,
                role_id: roleId,
                academy_id: academyId,
            })
            .whereNull('scope_branch_id')
            .whereNull('scope_group_id')
            .whereNull('revoked_at')
            .first();

        const revokeQuery = trx('iam_user_roles')
            .where({
                user_id: targetUserId,
                academy_id: academyId,
            })
            .whereNull('revoked_at');

        if (existing) revokeQuery.whereNot('id', existing.id);

        await revokeQuery.update({
            revoked_at: trx.fn.now(),
            revoked_by: grantedBy || null,
            revoke_reason: 'admin_role_replaced',
            updated_at: trx.fn.now(),
        });

        if (existing) {
            const [updated] = await trx('iam_user_roles')
                .where({ id: existing.id })
                .update({
                    expires_at: null,
                    revoked_at: null,
                    revoked_by: null,
                    revoke_reason: null,
                    updated_at: trx.fn.now(),
                })
                .returning('*');
            return updated;
        }

        const [created] = await trx('iam_user_roles')
            .insert({
                user_id: targetUserId,
                role_id: roleId,
                academy_id: academyId,
                granted_by: grantedBy || null,
            })
            .returning('*');
        return created;
    }

    async createAccessUser({
        academyId,
        actorUserId,
        fullName,
        accountRole,
        email,
        phone,
        username,
        passwordHash,
        address,
        jobTitle,
        department,
        notes,
        roleId,
    }) {
        return this.db.transaction(async (trx) => {
            if (accountRole !== 'admin') {
                throw new BadRequestError('Roles settings can only create admin/staff users');
            }

            const branchId = null;

            const [user] = await trx('auth_users')
                .insert({
                    username,
                    email: email || null,
                    phone,
                    password_hash: passwordHash,
                    role: accountRole,
                    academy_id: academyId,
                    branch_id: branchId,
                    is_active: true,
                    is_verified: true,
                })
                .returning('*');

            await ensureIamForAuthUser(trx, user, {
                fullName,
                grantedBy: actorUserId,
                skipDefaultRole: true,
                address,
                jobTitle,
                department,
                notes,
            });

            const assignment = roleId
                ? await this.assignExclusiveRoleToUser(trx, {
                    academyId,
                    roleId,
                    targetUserId: user.id,
                    grantedBy: actorUserId,
                    targetUser: user,
                })
                : null;

            return { user, assignment };
        });
    }

    async assignRoleToUser({ academyId, roleId, targetUserId, grantedBy }) {
        return this.db.transaction(async (trx) => {
            const targetUser = await trx('auth_users')
                .where({ id: targetUserId, academy_id: academyId })
                .whereNull('deleted_at')
                .first();
            if (!targetUser) return null;

            return this.assignExclusiveRoleToUser(trx, {
                academyId,
                roleId,
                targetUserId,
                grantedBy,
                targetUser,
            });
        });
    }

    async revokeRoleFromUser({ academyId, roleId, targetUserId, revokedBy }) {
        const [revoked] = await this.db('iam_user_roles')
            .where({
                user_id: targetUserId,
                role_id: roleId,
                academy_id: academyId,
            })
            .whereNull('scope_branch_id')
            .whereNull('scope_group_id')
            .whereNull('revoked_at')
            .update({
                revoked_at: new Date(),
                revoked_by: revokedBy || null,
                revoke_reason: 'admin_role_management',
                updated_at: new Date(),
            })
            .returning('*');
        return revoked;
    }

    async createAcademyRole(academyId, userId, data) {
        return this.db.transaction(async (trx) => {
            const [role] = await trx('iam_roles')
                .insert({
                    academy_id: academyId,
                    code: data.code,
                    name: data.name,
                    description: data.description || null,
                    is_system: false,
                    is_active: data.isActive !== undefined ? data.isActive : true,
                    priority: 100,
                    created_by: userId,
                    updated_by: userId,
                })
                .returning('*');

            await this.replaceRolePermissions(role.id, data.permissionIds || [], userId, trx);
            return role;
        });
    }

    async findAcademyEditableRole(roleId, academyId) {
        return this.db('iam_roles')
            .where({ id: roleId, academy_id: academyId, is_system: false })
            .whereNull('deleted_at')
            .first();
    }

    async updateAcademyRole(roleId, academyId, userId, data) {
        return this.db.transaction(async (trx) => {
            const role = await trx('iam_roles')
                .where({ id: roleId, academy_id: academyId, is_system: false })
                .whereNull('deleted_at')
                .forUpdate()
                .first();
            if (!role) return null;

            const updateData = {};
            if (data.name !== undefined) updateData.name = data.name;
            if (data.code !== undefined) updateData.code = data.code;
            if (data.description !== undefined) updateData.description = data.description || null;
            if (data.isActive !== undefined) updateData.is_active = data.isActive;

            let updated = role;
            if (Object.keys(updateData).length) {
                [updated] = await trx('iam_roles')
                    .where({ id: roleId })
                    .update({
                        ...updateData,
                        updated_by: userId,
                        updated_at: new Date(),
                    })
                    .returning('*');
            }

            if (data.permissionIds !== undefined) {
                await this.replaceRolePermissions(roleId, data.permissionIds, userId, trx);
            }

            return updated;
        });
    }

    async softDeleteAcademyRole(roleId, academyId, userId) {
        const [row] = await this.db('iam_roles')
            .where({ id: roleId, academy_id: academyId, is_system: false })
            .whereNull('deleted_at')
            .update({
                deleted_at: new Date(),
                deleted_by: userId,
                is_active: false,
                updated_by: userId,
                updated_at: new Date(),
            })
            .returning('*');
        return row;
    }

    async replaceRolePermissions(roleId, permissionIds, userId, trx = this.db) {
        const uniqueIds = [...new Set(permissionIds || [])];
        if (uniqueIds.length) {
            const existingRows = await trx('iam_permissions').whereIn('id', uniqueIds).select('id');
            const existingIds = new Set(existingRows.map((row) => row.id));
            const missingIds = uniqueIds.filter((id) => !existingIds.has(id));
            if (missingIds.length) {
                throw new BadRequestError('One or more selected permissions no longer exist');
            }
        }

        await trx('iam_role_permissions').where({ role_id: roleId }).del();
        if (!uniqueIds.length) return;

        await trx('iam_role_permissions').insert(
            uniqueIds.map((permissionId) => ({
                role_id: roleId,
                permission_id: permissionId,
                denied: false,
                granted_by: userId,
            })),
        );
    }

    // ─── Recent Admin Notifications ──────────────────────────────────────
    async getRecentAlerts(academyId, limit = 5) {
        const q = this.db('notification_inbox as ni')
            .join('auth_users as u', 'ni.user_id', 'u.id')
            .where('u.role', 'admin')
            .orderBy('ni.created_at', 'desc')
            .limit(limit)
            .select(
                'ni.id',
                'ni.title',
                'ni.body',
                'ni.type',
                'ni.is_read as isRead',
                'ni.created_at as createdAt',
            );
        if (academyId) q.where('u.academy_id', academyId);
        return q;
    }

    async listPasswordResetRequests(academyId) {
        return this.db('auth_password_resets as apr')
            .join('auth_users as au', 'apr.user_id', 'au.id')
            .leftJoin('iam_users as iu', 'au.id', 'iu.id')
            .leftJoin('player_profiles as pp', 'pp.user_id', 'au.id')
            .leftJoin('coach_profiles as cp', 'cp.user_id', 'au.id')
            .where('au.academy_id', academyId)
            .whereNull('au.deleted_at')
            .select(
                'apr.id',
                'apr.user_id as userId',
                'apr.expires_at as expiresAt',
                'apr.is_used as isUsed',
                'apr.created_at as createdAt',
                'apr.updated_at as updatedAt',
                'au.role',
                'au.username',
                'au.email',
                'au.phone',
                'pp.id as playerId',
                'pp.full_name as playerName',
                'cp.id as coachId',
                'cp.full_name as coachName',
                this.db.raw("COALESCE(pp.full_name, cp.full_name, iu.full_name, au.username, au.email, au.phone, 'User') as \"displayName\""),
                this.db.raw(`
                    CASE
                        WHEN apr.is_used = true THEN 'resolved'
                        WHEN apr.expires_at <= now() THEN 'expired'
                        ELSE 'pending'
                    END as status
                `),
            )
            .orderBy('apr.created_at', 'desc')
            .limit(100);
    }

}

module.exports = AdminRepository;
