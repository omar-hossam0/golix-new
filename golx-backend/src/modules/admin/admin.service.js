const bcrypt = require('bcrypt');
const env = require('../../config/env');
const { BadRequestError, ConflictError, NotFoundError } = require('../../shared/errors');

const ADMIN_PORTAL_PERMISSION_CODES = [
    'access_admin_dashboard',
    'admin.dashboard.access',
    'manage_users',
    'admin.user.create',
    'admin.user.update',
    'manage_teams',
    'admin.group.manage',
    'manage_coaches',
    'coach.read.branch',
    'coach.read.academy',
    'coach.create',
    'coach.update',
    'manage_players',
    'player.read.branch',
    'player.read.academy',
    'player.create',
    'player.update',
    'manage_schedules',
    'calendar.manage.academy',
    'manage_attendance',
    'attendance.view.branch',
    'attendance.view.academy',
    'attendance.export',
    'ranking.read.branch',
    'ranking.read.academy',
    'view_financial_reports',
    'payment.read.academy',
    'payment.export',
    'manage_subscriptions',
    'manage_payments',
    'manage_academy_settings',
    'admin.settings.update',
    'manage_roles',
    'manage_permissions',
    'admin.role.manage',
];

const COACH_PORTAL_PERMISSION_CODES = [
    'access_coach_dashboard',
    'view_assigned_players',
    'manage_training_sessions',
    'mark_attendance',
    'view_team_schedule',
    'player.read.team',
    'coach.read.team',
    'ranking.read.team',
    'attendance.view.team',
    'attendance.mark.team',
    'evaluation.create',
    'evaluation.update',
    'evaluation.publish',
    'evaluation.read.team',
];

const PARENT_PORTAL_PERMISSION_CODES = [
    'child:read',
    'view_own_profile',
    'view_own_schedule',
    'view_own_attendance',
    'view_own_payments',
    'player.read.self',
    'attendance.view.self',
    'evaluation.read.self',
    'ranking.read.self',
    'payment.read.self',
];

const PLAYER_PORTAL_PERMISSION_CODES = [
    'access_player_dashboard',
];

class AdminService {
    constructor(adminRepository) {
        this.repo = adminRepository;
    }

    async getDashboard(academyId) {
        const [kpis, attendanceTrend, revenueTrend, topPlayers, recentAlerts, weeklyMatches] = await Promise.all([
            this.repo.getKPIs(academyId),
            this.repo.getAttendanceTrend(academyId),
            this.repo.getRevenueTrend(academyId),
            this.repo.getTopPlayers(academyId),
            this.repo.getRecentAlerts(academyId),
            this.repo.getWeeklyMatches(academyId),
        ]);

        return { kpis, attendanceTrend, revenueTrend, topPlayers, recentAlerts, weeklyMatches };
    }

    async getReportsOverview(academyId, filters = {}) {
        if (!academyId) throw new BadRequestError('Academy context is required');

        const today = new Date();
        const defaultFrom = new Date(today);
        defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 89);
        const toDate = (value) => value.toISOString().slice(0, 10);

        return this.repo.getReportsOverview(academyId, {
            branchId: filters.branchId || null,
            dateFrom: filters.dateFrom || toDate(defaultFrom),
            dateTo: filters.dateTo || toDate(today),
        });
    }

    async listPasswordResetRequests(academyId) {
        if (!academyId) throw new BadRequestError('Academy context is required');
        return this.repo.listPasswordResetRequests(academyId);
    }

    async getAccessControl(academyId) {
        if (!academyId) throw new BadRequestError('Academy context is required');
        return this.repo.getAccessControl(academyId);
    }

    async createAccessUser(academyId, actorUserId, data) {
        if (!academyId) throw new BadRequestError('Academy context is required');
        if (data.accountRole !== 'admin') {
            throw new BadRequestError('Roles settings can only create admin/staff users. Use the dedicated coach, parent, or player pages.');
        }

        const normalizedUsername = data.username.trim().toLowerCase();
        const normalizedEmail = data.email ? data.email.trim().toLowerCase() : null;
        const phone = data.phone.trim();

        try {
            const conflict = await this.repo.findIdentityConflict({
                email: normalizedEmail,
                phone,
                username: normalizedUsername,
            });
            if (conflict) {
                throw new ConflictError(`${conflict.field} is already used by another user. Choose a different ${conflict.field}.`);
            }

            if (data.roleId) {
                await this.validateRoleAccountCompatibility(data.roleId, academyId, data.accountRole);
            }

            const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);
            const created = await this.repo.createAccessUser({
                academyId,
                actorUserId,
                fullName: data.fullName.trim(),
                accountRole: data.accountRole,
                email: normalizedEmail,
                phone,
                username: normalizedUsername,
                passwordHash,
                address: data.address || null,
                jobTitle: data.jobTitle || null,
                department: data.department || null,
                notes: data.notes || null,
                roleId: data.roleId || null,
            });

            const accessControl = await this.repo.getAccessControl(academyId);
            return {
                message: created.assignment ? 'User created and role assigned' : 'User created',
                user: accessControl.users.find((user) => user.id === created.user.id) || created.user,
                users: accessControl.users,
                roles: accessControl.roles,
            };
        } catch (err) {
            if (err.code === '23505') {
                throw new ConflictError('User with this email, username, or phone already exists');
            }
            throw err;
        }
    }

    async validateRoleAccountCompatibility(roleId, academyId, accountRole) {
        const [
            hasAdminPortalPermission,
            hasCoachPortalPermission,
            hasParentPortalPermission,
            hasPlayerPortalPermission,
        ] = await Promise.all([
            this.repo.roleHasAnyPermission(roleId, academyId, ADMIN_PORTAL_PERMISSION_CODES),
            this.repo.roleHasAnyPermission(roleId, academyId, COACH_PORTAL_PERMISSION_CODES),
            this.repo.roleHasAnyPermission(roleId, academyId, PARENT_PORTAL_PERMISSION_CODES),
            this.repo.roleHasAnyPermission(roleId, academyId, PLAYER_PORTAL_PERMISSION_CODES),
        ]);

        if (hasPlayerPortalPermission) {
            throw new BadRequestError('Player roles must be created and managed from the Players page.');
        }

        if (hasAdminPortalPermission && accountRole !== 'admin') {
            throw new BadRequestError('This role opens admin pages, so choose Staff/Admin Login.');
        }

        if (!hasAdminPortalPermission && hasCoachPortalPermission) {
            throw new BadRequestError('Coach roles are assigned from the coach assignment page.');
        }

        if (
            !hasAdminPortalPermission
            && !hasCoachPortalPermission
            && hasParentPortalPermission
        ) {
            throw new BadRequestError('Parent roles are managed from Parents, not Roles settings.');
        }
    }

    async createRole(academyId, userId, data) {
        if (!academyId) throw new BadRequestError('Academy context is required');
        try {
            const created = await this.repo.createAcademyRole(academyId, userId, data);
            const accessControl = await this.repo.getAccessControl(academyId);
            return accessControl.roles.find((role) => role.id === created.id) || created;
        } catch (err) {
            if (err.code === '23505') {
                throw new ConflictError('A role with this code already exists in this academy');
            }
            throw err;
        }
    }

    async updateRole(roleId, academyId, userId, data) {
        if (!academyId) throw new BadRequestError('Academy context is required');
        try {
            const role = await this.repo.updateAcademyRole(roleId, academyId, userId, data);
            if (!role) throw new NotFoundError('Editable role', roleId);
            const accessControl = await this.repo.getAccessControl(academyId);
            return accessControl.roles.find((item) => item.id === role.id) || role;
        } catch (err) {
            if (err.code === '23505') {
                throw new ConflictError('A role with this code already exists in this academy');
            }
            throw err;
        }
    }

    async deleteRole(roleId, academyId, userId) {
        if (!academyId) throw new BadRequestError('Academy context is required');
        const accessControl = await this.repo.getAccessControl(academyId);
        const role = accessControl.roles.find((item) => item.id === roleId);
        if (!role || role.isSystem) throw new NotFoundError('Editable role', roleId);
        if (role.userCount > 0) {
            throw new BadRequestError('Cannot delete a role while active users are assigned to it');
        }

        const deleted = await this.repo.softDeleteAcademyRole(roleId, academyId, userId);
        if (!deleted) throw new NotFoundError('Editable role', roleId);
        return { message: 'Role deleted' };
    }

    async assignRoleToUser(roleId, targetUserId, academyId, actorUserId) {
        if (!academyId) throw new BadRequestError('Academy context is required');
        if (targetUserId === actorUserId) {
            throw new BadRequestError('You cannot change your own role assignments from this screen');
        }

        const targetUser = await this.repo.db('auth_users')
            .where({ id: targetUserId, academy_id: academyId })
            .whereNull('deleted_at')
            .first('role');
        if (!targetUser) throw new NotFoundError('User', targetUserId);
        if (targetUser.role === 'parent') {
            throw new BadRequestError('Parent accounts are managed from the Parents page.');
        }
        await this.validateRoleAccountCompatibility(roleId, academyId, targetUser.role);

        const assignment = await this.repo.assignRoleToUser({
            academyId,
            roleId,
            targetUserId,
            grantedBy: actorUserId,
        });
        if (!assignment) throw new NotFoundError('Role or user', `${roleId}:${targetUserId}`);

        const accessControl = await this.repo.getAccessControl(academyId);
        return {
            message: 'Role assigned',
            users: accessControl.users,
            roles: accessControl.roles,
        };
    }

    async revokeRoleFromUser(roleId, targetUserId, academyId, actorUserId) {
        if (!academyId) throw new BadRequestError('Academy context is required');
        if (targetUserId === actorUserId) {
            throw new BadRequestError('You cannot change your own role assignments from this screen');
        }

        const revoked = await this.repo.revokeRoleFromUser({
            academyId,
            roleId,
            targetUserId,
            revokedBy: actorUserId,
        });
        if (!revoked) throw new NotFoundError('Role assignment', `${roleId}:${targetUserId}`);

        const accessControl = await this.repo.getAccessControl(academyId);
        return {
            message: 'Role revoked',
            users: accessControl.users,
            roles: accessControl.roles,
        };
    }

}

module.exports = AdminService;
