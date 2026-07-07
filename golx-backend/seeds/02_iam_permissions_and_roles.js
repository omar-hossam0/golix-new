/**
 * IAM Seed — Permission Catalog + System Roles
 *
 * Strategy:
 *   - UPSERT permissions and groups by their `code` (immutable reference data;
 *     re-running the seed is safe and self-healing if codes drift).
 *   - UPSERT system roles by (academy_id IS NULL, code).
 *   - For role↔permission mappings, REPLACE the mapping for system roles only
 *     (delete then re-insert): system roles are owned by the platform and
 *     should always reflect this file. Tenant-defined roles are never touched.
 *
 * This seed is idempotent: run it any number of times.
 */

// ---------------------------------------------------------------------------
//  PERMISSION GROUPS
// ---------------------------------------------------------------------------
const GROUPS = [
  { code: "dashboards",      name: "Dashboards",     sort_order: 5 },
  { code: "players",        name: "Players",        sort_order: 10 },
  { code: "coaches",        name: "Coaches",        sort_order: 20 },
  { code: "attendance",     name: "Attendance",     sort_order: 30 },
  { code: "schedules",      name: "Schedules",      sort_order: 35 },
  { code: "evaluation",     name: "Evaluations",    sort_order: 40 },
  { code: "ranking",        name: "Rankings",       sort_order: 50 },
  { code: "payment",        name: "Payments",       sort_order: 60 },
  { code: "notification",   name: "Notifications",  sort_order: 70 },
  { code: "admin",          name: "Administration", sort_order: 80 },
];

// ---------------------------------------------------------------------------
//  PERMISSION CATALOG
//  Format: { code, group, resource, action, scope, description }
// ---------------------------------------------------------------------------
const PERMISSIONS = [
  // ---- PRODUCT-LEVEL PERMISSIONS -------------------------------------
  ["access_admin_dashboard",   "dashboards", "dashboard", "access", "academy", "Open admin dashboard"],
  ["access_coach_dashboard",   "dashboards", "dashboard", "access", "team",    "Open coach dashboard"],
  ["access_player_dashboard",  "dashboards", "dashboard", "access", "self",    "Open player dashboard"],

  ["manage_users",            "admin",      "user",       "manage", "academy", "Manage user accounts"],
  ["manage_players",          "players",    "player",     "manage", "academy", "Manage player records"],
  ["manage_coaches",          "coaches",    "coach",      "manage", "academy", "Manage coach records"],
  ["manage_teams",            "admin",      "team",       "manage", "academy", "Manage teams and groups"],
  ["manage_schedules",        "schedules",  "schedule",   "manage", "academy", "Manage schedules and calendar events"],
  ["manage_attendance",       "attendance", "attendance", "manage", "academy", "Manage attendance operations"],
  ["manage_subscriptions",    "payment",    "subscription","manage","academy", "Manage subscriptions"],
  ["manage_payments",         "payment",    "payment",    "manage", "academy", "Manage payments"],
  ["view_financial_reports",  "payment",    "report",     "read",   "academy", "View financial reports"],
  ["manage_academy_settings", "admin",      "settings",   "manage", "academy", "Manage academy settings"],
  ["manage_roles",            "admin",      "role",       "manage", "academy", "Manage role records"],
  ["manage_permissions",      "admin",      "permission", "manage", "academy", "Manage permission grants"],

  ["view_assigned_players",   "players",    "player",     "read",   "team",    "View assigned players"],
  ["manage_training_sessions","schedules",  "training",   "manage", "team",    "Manage training sessions"],
  ["mark_attendance",         "attendance", "attendance", "mark",   "team",    "Mark attendance"],
  ["view_team_schedule",      "schedules",  "schedule",   "read",   "team",    "View assigned team schedule"],

  ["view_own_profile",        "players",    "profile",    "read",   "self",    "View own profile"],
  ["view_own_schedule",       "schedules",  "schedule",   "read",   "self",    "View own schedule"],
  ["view_own_attendance",     "attendance", "attendance", "read",   "self",    "View own attendance"],
  ["view_own_payments",       "payment",    "payment",    "read",   "self",    "View own payments"],

  // ---- PLAYERS --------------------------------------------------------
  ["player.create",           "players", "player", "create",  "academy", "Create new player profiles"],
  ["player.read.self",        "players", "player", "read",    "self",    "Read own player profile"],
  ["player.read.team",        "players", "player", "read",    "team",    "Read player profiles in assigned teams"],
  ["player.read.branch",      "players", "player", "read",    "branch",  "Read player profiles in a branch"],
  ["player.read.academy",     "players", "player", "read",    "academy", "Read all player profiles in academy"],
  ["player.update",           "players", "player", "update",  "academy", "Edit player profiles"],
  ["player.delete",           "players", "player", "delete",  "academy", "Soft-delete player profiles"],
  ["player.export",           "players", "player", "export",  "academy", "Export player data (CSV/PDF)"],

  // ---- COACHES --------------------------------------------------------
  ["coach.create",            "coaches", "coach",  "create",  "academy", "Create coach profiles"],
  ["coach.read.team",         "coaches", "coach",  "read",    "team",    "Read coach data within own teams"],
  ["coach.read.branch",       "coaches", "coach",  "read",    "branch",  "Read coach data within a branch"],
  ["coach.read.academy",      "coaches", "coach",  "read",    "academy", "Read all coaches in academy"],
  ["coach.update",            "coaches", "coach",  "update",  "academy", "Edit coach profiles & assignments"],
  ["coach.delete",            "coaches", "coach",  "delete",  "academy", "Soft-delete coach profiles"],

  // ---- ATTENDANCE -----------------------------------------------------
  ["attendance.mark.team",    "attendance", "attendance", "mark", "team",    "Mark attendance for own teams"],
  ["attendance.view.self",    "attendance", "attendance", "view", "self",    "View own attendance history"],
  ["attendance.view.team",    "attendance", "attendance", "view", "team",    "View attendance of own teams"],
  ["attendance.view.branch",  "attendance", "attendance", "view", "branch",  "View attendance for a branch"],
  ["attendance.view.academy", "attendance", "attendance", "view", "academy", "View attendance across the academy"],
  ["attendance.export",       "attendance", "attendance", "export","academy","Export attendance reports"],

  // ---- EVALUATIONS ----------------------------------------------------
  ["evaluation.create",         "evaluation", "evaluation", "create",  "team",    "Create player evaluations"],
  ["evaluation.read.self",      "evaluation", "evaluation", "read",    "self",    "Read own evaluations"],
  ["evaluation.read.team",      "evaluation", "evaluation", "read",    "team",    "Read evaluations of own teams"],
  ["evaluation.read.branch",    "evaluation", "evaluation", "read",    "branch",  "Read evaluations across a branch"],
  ["evaluation.read.academy",   "evaluation", "evaluation", "read",    "academy", "Read all evaluations in academy"],
  ["evaluation.update",         "evaluation", "evaluation", "update",  "team",    "Edit evaluations before publish"],
  ["evaluation.publish",        "evaluation", "evaluation", "publish", "team",    "Publish evaluations to players/parents"],
  ["evaluation.delete",         "evaluation", "evaluation", "delete",  "academy", "Delete evaluations (admin only)"],

  // ---- RANKINGS -------------------------------------------------------
  ["ranking.read.self",       "ranking", "ranking", "read",      "self",    "View own ranking history"],
  ["ranking.read.team",       "ranking", "ranking", "read",      "team",    "View rankings of own teams"],
  ["ranking.read.branch",     "ranking", "ranking", "read",      "branch",  "View rankings of a branch"],
  ["ranking.read.academy",    "ranking", "ranking", "read",      "academy", "View rankings across the academy"],
  ["ranking.recompute",       "ranking", "ranking", "recompute", "academy", "Trigger a manual ranking recompute"],

  // ---- PAYMENTS -------------------------------------------------------
  ["payment.read.self",       "payment", "payment", "read",   "self",    "View own / linked-children payment history"],
  ["payment.read.academy",    "payment", "payment", "read",   "academy", "View all payments in academy"],
  ["payment.create",          "payment", "payment", "create", "academy", "Create invoices / subscriptions"],
  ["payment.refund",          "payment", "payment", "refund", "academy", "Issue payment refunds"],
  ["payment.export",          "payment", "payment", "export", "academy", "Export payment reports"],

  // ---- NOTIFICATIONS --------------------------------------------------
  ["notification.send.team",     "notification", "notification", "send", "team",    "Send notifications to own teams"],
  ["notification.send.branch",   "notification", "notification", "send", "branch",  "Send notifications branch-wide"],
  ["notification.send.academy",  "notification", "notification", "send", "academy", "Send academy-wide notifications"],
  ["notification.read.self",     "notification", "notification", "read", "self",    "Read own inbox"],

  // ---- ADMINISTRATION -------------------------------------------------
  ["admin.user.read",         "admin", "user",     "read",   "academy", "View user accounts"],
  ["admin.user.create",       "admin", "user",     "create", "academy", "Create new user accounts"],
  ["admin.user.update",       "admin", "user",     "update", "academy", "Edit user accounts"],
  ["admin.user.delete",       "admin", "user",     "delete", "academy", "Disable / soft-delete users"],

  ["admin.role.read",         "admin", "role",     "read",   "academy", "View roles & permissions"],
  ["admin.role.manage",       "admin", "role",     "manage", "academy", "Create/edit roles and grant permissions"],

  ["admin.session.read",      "admin", "session",  "read",   "academy", "View active sessions"],
  ["admin.session.revoke",    "admin", "session",  "revoke", "academy", "Revoke a user's sessions/devices"],

  ["admin.audit.read",        "admin", "audit",    "read",   "academy", "View audit log entries"],
  ["admin.audit.export",      "admin", "audit",    "export", "academy", "Export audit logs"],

  ["admin.settings.read",     "admin", "settings", "read",   "academy", "View academy settings"],
  ["admin.settings.update",   "admin", "settings", "update", "academy", "Edit academy settings"],

  ["admin.branch.manage",     "admin", "branch",   "manage", "academy", "Create/edit/delete branches"],
  ["admin.group.manage",      "admin", "group",    "manage", "academy", "Create/edit/delete groups"],
  ["admin.academy.manage",    "admin", "academy",  "manage", "system",  "Manage academies (super-admin)"],
];

// ---------------------------------------------------------------------------
//  SYSTEM ROLES
// ---------------------------------------------------------------------------
const ADMIN_PRODUCT_PERMISSIONS = [
  "access_admin_dashboard",
  "manage_users",
  "manage_players",
  "manage_coaches",
  "manage_teams",
  "manage_schedules",
  "manage_attendance",
  "manage_subscriptions",
  "manage_payments",
  "view_financial_reports",
  "manage_academy_settings",
  "manage_roles",
  "manage_permissions",
];

const COACH_PRODUCT_PERMISSIONS = [
  "access_coach_dashboard",
  "view_assigned_players",
  "manage_training_sessions",
  "mark_attendance",
  "view_team_schedule",
];

const PLAYER_PRODUCT_PERMISSIONS = [
  "access_player_dashboard",
  "view_own_profile",
  "view_own_schedule",
  "view_own_attendance",
  "view_own_payments",
];

const ROLES = [
  {
    code: "super_admin",
    name: "Super Admin",
    description: "Platform-level administrator. Has every permission across every academy.",
    priority: 10,
    // Special: gets ALL permission codes (computed below).
    permissions: "ALL",
  },
  {
    code: "academy_owner",
    name: "Academy Owner",
    description: "Full control over a single academy. Holds every academy-level capability including role management, settings, and refunds.",
    priority: 20,
    permissions: [
      ...ADMIN_PRODUCT_PERMISSIONS,
      // full read across academy
      "player.read.academy", "coach.read.academy", "attendance.view.academy",
      "evaluation.read.academy", "ranking.read.academy", "payment.read.academy",

      // write
      "player.create", "player.update", "player.delete", "player.export",
      "coach.create",  "coach.update",  "coach.delete",
      "attendance.export",

      // evaluations — owner gets the full lifecycle so they can recover from
      // coach absences (create/update/publish) and clean up data (delete).
      "evaluation.create", "evaluation.update", "evaluation.publish", "evaluation.delete",

      "ranking.recompute",
      "payment.create", "payment.refund", "payment.export",

      // notifications
      "notification.send.academy", "notification.send.branch", "notification.send.team",
      "notification.read.self",

      // admin
      "admin.user.read", "admin.user.create", "admin.user.update", "admin.user.delete",
      "admin.role.read", "admin.role.manage",
      "admin.session.read", "admin.session.revoke",
      "admin.audit.read", "admin.audit.export",
      "admin.settings.read", "admin.settings.update",
      "admin.branch.manage", "admin.group.manage",
    ],
  },
  {
    code: "academy_admin",
    name: "Academy Admin",
    description:
      "Day-to-day administrator. Same as owner minus: admin.role.manage, " +
      "admin.settings.update, admin.user.delete, admin.session.revoke, " +
      "admin.audit.export, payment.refund, evaluation.delete.",
    priority: 30,
    permissions: [
      ...ADMIN_PRODUCT_PERMISSIONS,
      "player.read.academy", "coach.read.academy", "attendance.view.academy",
      "evaluation.read.academy", "ranking.read.academy", "payment.read.academy",

      "player.create", "player.update", "player.export",
      "coach.create",  "coach.update",
      "attendance.export",

      // evaluations — admin can run the full coach-facing lifecycle but
      // cannot hard-delete records (preserved for owner only).
      "evaluation.create", "evaluation.update", "evaluation.publish",

      "ranking.recompute",
      "payment.create", "payment.export",

      "notification.send.academy", "notification.send.branch", "notification.send.team",
      "notification.read.self",

      "admin.user.read", "admin.user.create", "admin.user.update",
      "admin.role.read",
      "admin.session.read",
      "admin.audit.read",
      "admin.settings.read",
      "admin.branch.manage", "admin.group.manage",
    ],
  },
  {
    code: "branch_manager",
    name: "Branch Manager",
    description:
      "Manages players, coaches, and operations within a single branch. " +
      "Cannot export academy-wide data (export perms are academy-scoped and " +
      "intentionally withheld).",
    priority: 40,
    permissions: [
      "player.read.branch", "coach.read.branch", "attendance.view.branch",
      "evaluation.read.branch", "ranking.read.branch",

      "player.update",

      "notification.send.branch", "notification.send.team",
      "notification.read.self",

      "admin.user.read",
      "admin.group.manage",
    ],
  },
  {
    code: "head_coach",
    name: "Head Coach",
    description: "Lead coach of one or more groups. Marks attendance, evaluates players.",
    priority: 50,
    permissions: [
      ...COACH_PRODUCT_PERMISSIONS,
      "player.read.team", "coach.read.team",
      "attendance.mark.team", "attendance.view.team",
      "evaluation.create", "evaluation.read.team", "evaluation.update", "evaluation.publish",
      "ranking.read.team",
      "notification.send.team",
      "notification.read.self",
    ],
  },
  {
    code: "assistant_coach",
    name: "Assistant Coach",
    description: "Supports the head coach. Can mark attendance and view evaluations.",
    priority: 60,
    permissions: [
      "access_coach_dashboard", "view_assigned_players", "mark_attendance", "view_team_schedule",
      "player.read.team",
      "attendance.mark.team", "attendance.view.team",
      "evaluation.read.team",
      "ranking.read.team",
      "notification.read.self",
    ],
  },
  {
    code: "player",
    name: "Player",
    description: "Athlete account. Read-only access to own data.",
    priority: 90,
    permissions: [
      ...PLAYER_PRODUCT_PERMISSIONS,
      "player.read.self",
      "attendance.view.self",
      "evaluation.read.self",
      "ranking.read.self",
      "notification.read.self",
    ],
  },
  {
    code: "parent",
    name: "Parent / Guardian",
    description:
      "Guardian account. Read-only access to linked children + payments. " +
      "NOTE: middleware must interpret '*.read.self' permissions as " +
      "'own profile OR linked children via guardian_player_links'.",
    priority: 95,
    permissions: [
      "view_own_profile", "view_own_schedule", "view_own_attendance", "view_own_payments",
      "player.read.self",
      "attendance.view.self",
      "evaluation.read.self",
      "ranking.read.self",
      "payment.read.self",
      "notification.read.self",
    ],
  },
];

// ---------------------------------------------------------------------------
//  SEED ENTRYPOINT
// ---------------------------------------------------------------------------
exports.seed = async function seed(knex) {
  await knex.transaction(async (trx) => {
    // 1. Upsert permission groups -----------------------------------------
    for (const g of GROUPS) {
      await trx("iam_permission_groups")
        .insert(g)
        .onConflict("code")
        .merge(["name", "sort_order", "updated_at"]);
    }

    const groupRows = await trx("iam_permission_groups").select("id", "code");
    const groupIdByCode = Object.fromEntries(groupRows.map((r) => [r.code, r.id]));

    // 2. Upsert permissions ------------------------------------------------
    for (const [code, group, resource, action, scope, description] of PERMISSIONS) {
      const groupId = groupIdByCode[group];
      if (!groupId) {
        throw new Error(`Permission "${code}" references unknown group "${group}"`);
      }
      await trx("iam_permissions")
        .insert({
          code,
          resource,
          action,
          scope,
          description,
          group_id: groupId,
          is_system: true,
        })
        .onConflict("code")
        .merge(["resource", "action", "scope", "description", "group_id", "is_system", "updated_at"]);
    }

    const permRows = await trx("iam_permissions").select("id", "code");
    const permIdByCode = Object.fromEntries(permRows.map((r) => [r.code, r.id]));
    const ALL_PERMISSION_IDS = permRows.map((r) => r.id);

    // 3. Upsert system roles ----------------------------------------------
    //    System roles have academy_id = NULL. The unique index defined in
    //    migration 026 uses COALESCE(academy_id, '00000...') so we cannot
    //    rely on .onConflict for NULL — do a manual lookup-or-insert.
    const systemRoleIdByCode = {};
    for (const role of ROLES) {
      const existing = await trx("iam_roles")
        .where({ code: role.code, is_system: true })
        .whereNull("academy_id")
        .whereNull("deleted_at")
        .first("id");

      if (existing) {
        await trx("iam_roles")
          .where({ id: existing.id })
          .update({
            name: role.name,
            description: role.description,
            priority: role.priority,
            is_active: true,
            updated_at: trx.fn.now(),
          });
        systemRoleIdByCode[role.code] = existing.id;
      } else {
        const [inserted] = await trx("iam_roles")
          .insert({
            academy_id: null,
            code: role.code,
            name: role.name,
            description: role.description,
            is_system: true,
            is_active: true,
            priority: role.priority,
          })
          .returning("id");
        systemRoleIdByCode[role.code] = inserted.id ?? inserted;
      }
    }

    // 4. Replace role↔permission mappings (system roles only) -------------
    //    Tenant-created roles are never touched.
    for (const role of ROLES) {
      const roleId = systemRoleIdByCode[role.code];

      const permissionIds =
        role.permissions === "ALL"
          ? ALL_PERMISSION_IDS
          : role.permissions.map((code) => {
              const id = permIdByCode[code];
              if (!id) {
                throw new Error(
                  `Role "${role.code}" references unknown permission "${code}"`
                );
              }
              return id;
            });

      // Wipe existing mappings for this system role, then re-insert.
      await trx("iam_role_permissions").where({ role_id: roleId }).delete();

      if (permissionIds.length > 0) {
        await trx("iam_role_permissions").insert(
          permissionIds.map((permission_id) => ({
            role_id: roleId,
            permission_id,
            denied: false,
          }))
        );
      }
    }

    // 5. Safe legacy auth_users -> IAM sync -------------------------------
    const tableExists = async (name) => {
      const result = await trx.raw("SELECT to_regclass(?) AS table_name", [`public.${name}`]);
      return Boolean(result.rows?.[0]?.table_name);
    };

    if (await tableExists("auth_users")) {
      const authUsers = await trx("auth_users")
        .whereNull("deleted_at")
        .select(
          "id",
          "email",
          "username",
          "phone",
          "password_hash",
          "role",
          "academy_id",
          "branch_id",
          "is_active",
          "is_verified",
          "totp_enabled",
          "totp_secret",
          "totp_verified_at",
          "failed_login_attempts",
          "last_failed_login_at",
          "locked_until",
          "last_login_at",
          "created_at",
        );

      const legacyRoleMap = {
        admin: "academy_owner",
        coach: "head_coach",
        player: "player",
        parent: "parent",
      };

      for (const user of authUsers) {
        await trx("iam_users")
          .insert({
            id: user.id,
            email: user.email || null,
            username: user.username || null,
            phone: user.phone || null,
            password_hash: user.password_hash,
            full_name: user.username || user.email || user.phone || `${user.role} account`,
            is_active: user.is_active !== false,
            is_verified: Boolean(user.is_verified),
            totp_enabled: Boolean(user.totp_enabled),
            totp_secret: user.totp_secret || null,
            totp_verified_at: user.totp_verified_at || null,
            failed_login_attempts: user.failed_login_attempts || 0,
            last_failed_login_at: user.last_failed_login_at || null,
            locked_until: user.locked_until || null,
            last_login_at: user.last_login_at || null,
            created_at: user.created_at || trx.fn.now(),
            updated_at: trx.fn.now(),
          })
          .onConflict("id")
          .merge({
            email: user.email || null,
            username: user.username || null,
            phone: user.phone || null,
            password_hash: user.password_hash,
            full_name: user.username || user.email || user.phone || `${user.role} account`,
            is_active: user.is_active !== false,
            is_verified: Boolean(user.is_verified),
            totp_enabled: Boolean(user.totp_enabled),
            totp_secret: user.totp_secret || null,
            totp_verified_at: user.totp_verified_at || null,
            failed_login_attempts: user.failed_login_attempts || 0,
            last_failed_login_at: user.last_failed_login_at || null,
            locked_until: user.locked_until || null,
            last_login_at: user.last_login_at || null,
            updated_at: trx.fn.now(),
          });

        if (!user.academy_id) continue;

        await trx("iam_user_academies")
          .insert({
            user_id: user.id,
            academy_id: user.academy_id,
            branch_id: user.branch_id || null,
            status: "active",
          })
          .onConflict(["user_id", "academy_id"])
          .merge({
            branch_id: user.branch_id || null,
            status: "active",
            revoked_at: null,
            revoke_reason: null,
            updated_at: trx.fn.now(),
          });

        const roleId = systemRoleIdByCode[legacyRoleMap[user.role]];
        if (roleId) {
          const existingAssignment = await trx("iam_user_roles")
            .where({
              user_id: user.id,
              role_id: roleId,
              academy_id: user.academy_id,
            })
            .whereNull("scope_branch_id")
            .whereNull("scope_group_id")
            .whereNull("revoked_at")
            .first("id");

          if (!existingAssignment) {
            await trx("iam_user_roles").insert({
              user_id: user.id,
              role_id: roleId,
              academy_id: user.academy_id,
            });
          }
        }

        if (user.role === "admin" && await tableExists("admin_accounts")) {
          await trx("admin_accounts")
            .insert({
              user_id: user.id,
              academy_id: user.academy_id,
              admin_type: "academy_admin",
              is_active: true,
            })
            .onConflict("user_id")
            .merge({
              academy_id: user.academy_id,
              is_active: true,
              disabled_at: null,
              disabled_reason: null,
              updated_at: trx.fn.now(),
            });
        }

        if (user.role === "admin" && await tableExists("admin_profiles")) {
          await trx("admin_profiles")
            .insert({
              user_id: user.id,
              job_title: "Administrator",
              department: "Operations",
            })
            .onConflict("user_id")
            .merge({
              job_title: "Administrator",
              department: "Operations",
              updated_at: trx.fn.now(),
            });
        }
      }
    }
  });

  console.log(
    `[seed] IAM catalog ready — ${GROUPS.length} groups, ${PERMISSIONS.length} permissions, ${ROLES.length} system roles`
  );
};
