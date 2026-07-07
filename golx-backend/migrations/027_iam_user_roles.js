/**
 * IAM — Step 4: User ↔ Role Assignment
 *
 * One user can hold MULTIPLE roles per academy, optionally narrowed to a
 * branch or group. Examples:
 *   - User A is `academy_admin` in academy X (academy-wide).
 *   - User B is `head_coach` in academy X, scoped to branch Y, group Z.
 *   - User C is `assistant_coach` in academy X, group Z (no branch scope).
 *
 * Supports temporary roles via `expires_at`.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable("iam_user_roles", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("iam_users")
      .onDelete("CASCADE");

    // CASCADE (not RESTRICT) so deleting a role or its parent academy doesn't
    // collide with the academy-cascade path through iam_user_roles.
    t.uuid("role_id")
      .notNullable()
      .references("id")
      .inTable("iam_roles")
      .onDelete("CASCADE");

    t.uuid("academy_id")
      .notNullable()
      .references("id")
      .inTable("academy_academies")
      .onDelete("CASCADE");

    // Optional scope narrowing (NULL = role applies academy-wide).
    // SET NULL on branch/group deletion: the role widens to academy scope
    // instead of silently disappearing.
    t.uuid("scope_branch_id")
      .references("id")
      .inTable("academy_branches")
      .onDelete("SET NULL");

    t.uuid("scope_group_id")
      .references("id")
      .inTable("academy_groups")
      .onDelete("SET NULL");

    t.timestamp("granted_at").notNullable().defaultTo(knex.fn.now());
    t.uuid("granted_by");
    t.timestamp("expires_at"); // NULL = permanent
    t.timestamp("revoked_at");
    t.uuid("revoked_by");
    t.string("revoke_reason", 120);

    t.timestamps(true, true);

    t.index(["academy_id", "user_id"]);
    t.index(["academy_id", "role_id"]);
    t.index(["user_id", "expires_at"]);
    t.index("scope_branch_id");
    t.index("scope_group_id");
  });

  // Prevent duplicate assignments at the same scope.
  // We use COALESCE on UUID columns to allow uniqueness with NULL scopes.
  await knex.raw(`
    CREATE UNIQUE INDEX iam_user_roles_unique_assignment
      ON iam_user_roles (
        user_id,
        role_id,
        academy_id,
        COALESCE(scope_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(scope_group_id,  '00000000-0000-0000-0000-000000000000'::uuid)
      )
      WHERE revoked_at IS NULL;
  `);

  await knex.raw(`
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON iam_user_roles
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP TRIGGER IF EXISTS set_updated_at ON iam_user_roles;");
  await knex.schema.dropTableIfExists("iam_user_roles");
};
