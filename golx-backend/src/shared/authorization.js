const legacyPermissions = {
    admin: ['*'],
    coach: [
        'players:read',
        'players:write',
        'attendance:read',
        'attendance:write',
        'evaluations:read',
        'evaluations:write',
        'measurements:read',
        'measurements:write',
        'schedule:read',
        'schedule:write',
        'sessions:read',
        'sessions:write',
        'rankings:read',
        'groups:read',
        'coaches:read',
        'nutrition:read',
        'nutrition:write',
        'matches:read',
        'matches:write',
    ],
    player: [
        'profile:read',
        'progress:read',
        'training:read',
        'attendance:read',
        'rankings:read',
        'measurements:read',
        'nutrition:read',
        'evaluations:read',
    ],
    parent: [
        'child:read',
        'payments:read',
        'notifications:read',
        'attendance:read',
        'measurements:read',
        'nutrition:read',
        'schedule:read',
    ],
};

const permissionAliases = {
    // Product-level permissions requested by the academy admin surface.
    access_admin_dashboard: ['access_admin_dashboard', 'admin.dashboard.access'],
    manage_users: ['manage_users', 'admin.user.create', 'admin.user.update', 'admin.user.delete'],
    manage_players: ['manage_players', 'player.create', 'player.update', 'player.delete'],
    manage_coaches: ['manage_coaches', 'coach.create', 'coach.update', 'coach.delete'],
    manage_teams: ['manage_teams', 'admin.group.manage'],
    manage_schedules: ['manage_schedules', 'calendar.manage.academy'],
    manage_attendance: ['manage_attendance', 'attendance.mark.team', 'attendance.export'],
    manage_subscriptions: ['manage_subscriptions', 'payment.create'],
    manage_payments: ['manage_payments', 'payment.create', 'payment.refund'],
    view_financial_reports: ['view_financial_reports', 'payment.read.academy', 'payment.export'],
    manage_academy_settings: ['manage_academy_settings', 'admin.settings.update'],
    manage_roles: ['manage_roles', 'admin.role.manage'],
    manage_permissions: ['manage_permissions', 'admin.role.manage'],

    access_coach_dashboard: ['access_coach_dashboard'],
    view_assigned_players: ['view_assigned_players', 'player.read.team'],
    manage_training_sessions: ['manage_training_sessions', 'evaluation.create'],
    mark_attendance: ['mark_attendance', 'attendance.mark.team'],
    view_team_schedule: ['view_team_schedule'],

    access_player_dashboard: ['access_player_dashboard'],
    view_own_profile: ['view_own_profile', 'player.read.self'],
    view_own_schedule: ['view_own_schedule'],
    view_own_attendance: ['view_own_attendance', 'attendance.view.self'],
    view_own_payments: ['view_own_payments', 'payment.read.self'],

    // Legacy API contract aliases. These keep old routes working while the
    // codebase moves toward product permission names.
    'players:read': ['manage_players', 'view_assigned_players', 'view_own_profile', 'player.read.self', 'player.read.team', 'player.read.branch', 'player.read.academy'],
    'players:write': ['manage_players', 'player.create', 'player.update'],
    'attendance:read': ['manage_attendance', 'view_own_attendance', 'attendance.view.self', 'attendance.view.team', 'attendance.view.branch', 'attendance.view.academy'],
    'attendance:write': ['manage_attendance', 'mark_attendance', 'attendance.mark.team'],
    'evaluations:read': ['evaluation.read.self', 'evaluation.read.team', 'evaluation.read.branch', 'evaluation.read.academy'],
    'evaluations:write': ['evaluation.create', 'evaluation.update', 'evaluation.publish'],
    'measurements:read': ['manage_players', 'view_assigned_players', 'view_own_profile', 'player.read.self', 'player.read.team', 'player.read.branch', 'player.read.academy'],
    'measurements:write': ['manage_players', 'player.update'],
    'schedule:read': ['view_team_schedule', 'view_own_schedule'],
    'schedule:write': ['manage_schedules'],
    'sessions:read': ['manage_training_sessions', 'attendance.view.team', 'attendance.view.branch', 'attendance.view.academy'],
    'sessions:write': ['manage_training_sessions', 'attendance.mark.team'],
    'rankings:read': ['ranking.read.self', 'ranking.read.team', 'ranking.read.branch', 'ranking.read.academy'],
    'rankings:write': ['ranking.recompute'],
    'groups:read': ['manage_teams', 'admin.group.manage', 'player.read.team', 'player.read.branch', 'player.read.academy'],
    'coaches:read': ['manage_coaches', 'coach.read.team', 'coach.read.branch', 'coach.read.academy'],
    'nutrition:read': ['player.read.self', 'player.read.team', 'player.read.branch', 'player.read.academy'],
    'nutrition:write': ['evaluation.create'],
    'matches:read': ['ranking.read.self', 'ranking.read.team', 'ranking.read.branch', 'ranking.read.academy'],
    'matches:write': ['evaluation.create'],
    'payments:read': ['view_financial_reports', 'view_own_payments', 'payment.read.self', 'payment.read.academy'],
};

function acceptedPermissionCodes(required) {
    if (required === '*') return ['*'];
    return permissionAliases[required] || [required];
}

function hasLegacyPermission(user, required) {
    const userPerms = legacyPermissions[user.role] || [];
    return userPerms.includes('*') || userPerms.includes(required);
}

async function getIamPermissionCodes(user, db) {
    let iamUser;
    try {
        iamUser = await db('iam_users')
            .where({ id: user.userId, is_active: true })
            .whereNull('deleted_at')
            .first('id');
    } catch (err) {
        if (err.code === '42P01') return null;
        throw err;
    }

    if (!iamUser) return null;

    const query = db('iam_user_roles as ur')
        .join('iam_roles as r', 'ur.role_id', 'r.id')
        .join('iam_role_permissions as rp', 'r.id', 'rp.role_id')
        .join('iam_permissions as p', 'rp.permission_id', 'p.id')
        .where('ur.user_id', user.userId)
        .whereNull('ur.revoked_at')
        .where(function activeRole() {
            this.whereNull('ur.expires_at').orWhere('ur.expires_at', '>', new Date());
        })
        .where('r.is_active', true)
        .whereNull('r.deleted_at')
        .select('p.code', 'rp.denied');

    if (user.academyId) {
        query.where('ur.academy_id', user.academyId);
    }

    const rows = await query;
    const grants = new Set();
    const denies = new Set();
    if (user.role === 'admin') {
        grants.add('access_admin_dashboard');
        grants.add('admin.dashboard.access');
    }
    for (const row of rows) {
        if (row.denied) denies.add(row.code);
        else grants.add(row.code);
    }
    for (const code of denies) grants.delete(code);

    return grants;
}

async function hasPermission(user, required, db) {
    if (required === '*') return true;

    const iamPerms = await getIamPermissionCodes(user, db);
    if (iamPerms) {
        return acceptedPermissionCodes(required).some((code) => iamPerms.has(code));
    }

    return hasLegacyPermission(user, required);
}

function createAbility(user, db) {
    return {
        ...user,
        can(permission) {
            return hasPermission(this, permission, db);
        },
    };
}

module.exports = {
    acceptedPermissionCodes,
    createAbility,
    getIamPermissionCodes,
    hasPermission,
    legacyPermissions,
};
