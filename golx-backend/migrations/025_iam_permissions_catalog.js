/**
 * IAM — Step 2: Permission Catalog
 *
 * Atomic, immutable permissions table. Permissions are seeded by the
 * application (not user-editable) and grouped for UI convenience.
 *
 * Permission code convention: `<resource>.<action>[.<scope>]`
 *   examples: 'player.create', 'attendance.view.team',
 *             'admin.session.revoke', 'ranking.read.self'
 */

exports.up = async function up(knex) {
  await knex.schema.createTable("iam_permission_groups", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("code", 60).notNullable().unique();      // 'players','attendance','admin'
    t.string("name", 120).notNullable();
    t.text("description");
    t.integer("sort_order").notNullable().defaultTo(0);
    t.timestamps(true, true);
  });

  await knex.schema.createTable("iam_permissions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.string("code", 120).notNullable().unique();     // canonical permission key
    t.string("resource", 60).notNullable();           // 'player'
    t.string("action", 60).notNullable();             // 'create'
    t.string("scope", 40).notNullable().defaultTo("academy");
    t.text("description");

    t.uuid("group_id")
      .references("id")
      .inTable("iam_permission_groups")
      .onDelete("SET NULL");

    // Hard-coded permissions provided by the platform cannot be deleted by tenants.
    t.boolean("is_system").notNullable().defaultTo(true);

    t.timestamps(true, true);

    t.index("resource");
    t.index(["resource", "action"]);
    t.index("group_id");
  });

  await knex.raw(`
    ALTER TABLE iam_permissions
      ADD CONSTRAINT iam_permissions_scope_check
      CHECK (scope IN ('system','academy','branch','team','self'));
  `);

  await knex.raw(`
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON iam_permission_groups
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON iam_permissions
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP TRIGGER IF EXISTS set_updated_at ON iam_permissions;");
  await knex.raw("DROP TRIGGER IF EXISTS set_updated_at ON iam_permission_groups;");
  await knex.schema.dropTableIfExists("iam_permissions");
  await knex.schema.dropTableIfExists("iam_permission_groups");
};
