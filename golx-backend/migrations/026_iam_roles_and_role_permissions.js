/**
 * IAM — Step 3: Dynamic Roles
 *
 * Roles are dynamic and can be:
 *   - System roles (academy_id IS NULL, is_system=true) — seeded defaults
 *     such as 'super_admin','academy_owner','head_coach','player','parent'.
 *   - Tenant-defined roles (academy_id IS NOT NULL) for custom workflows.
 *
 * Negative permissions are supported via the `denied` flag (deny beats
 * grant) — useful for emergency revocation without deleting a role.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable("iam_roles", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("academy_id")
      .references("id")
      .inTable("academy_academies")
      .onDelete("CASCADE"); // tenant-defined roles die with their academy

    t.string("code", 60).notNullable();                // 'head_coach'
    t.string("name", 120).notNullable();               // display name
    t.text("description");

    t.boolean("is_system").notNullable().defaultTo(false);
    t.boolean("is_active").notNullable().defaultTo(true);
    t.integer("priority").notNullable().defaultTo(100); // hierarchy / conflict resolution

    t.timestamps(true, true);
    t.timestamp("deleted_at");
    t.uuid("deleted_by");
    t.uuid("created_by");
    t.uuid("updated_by");

    t.index(["academy_id", "is_active"]);
    t.index("code");
  });

  // Tenant-scoped uniqueness: same code can exist as a system role (NULL academy)
  // AND as a tenant override. Active rows only.
  await knex.raw(`
    CREATE UNIQUE INDEX iam_roles_scope_code_unique
      ON iam_roles (COALESCE(academy_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
      WHERE deleted_at IS NULL;
  `);

  // ---------------------------------------------------------------------------

  await knex.schema.createTable("iam_role_permissions", (t) => {
    t.uuid("role_id")
      .notNullable()
      .references("id")
      .inTable("iam_roles")
      .onDelete("CASCADE");

    t.uuid("permission_id")
      .notNullable()
      .references("id")
      .inTable("iam_permissions")
      .onDelete("RESTRICT");

    // deny=true overrides grants from any other role the user holds.
    t.boolean("denied").notNullable().defaultTo(false);

    t.timestamp("granted_at").notNullable().defaultTo(knex.fn.now());
    t.uuid("granted_by");

    t.primary(["role_id", "permission_id"]);
    t.index("permission_id");
  });

  await knex.raw(`
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON iam_roles
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP TRIGGER IF EXISTS set_updated_at ON iam_roles;");
  await knex.schema.dropTableIfExists("iam_role_permissions");
  await knex.schema.dropTableIfExists("iam_roles");
};
