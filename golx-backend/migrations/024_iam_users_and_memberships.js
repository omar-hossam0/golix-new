/**
 * IAM — Step 1: Identity & Tenant Membership
 *
 * Introduces a new identity layer that will eventually replace `auth_users`.
 * Strategy: dual-write. `iam_users.id` is NOT a foreign key to `auth_users(id)`
 * but is intended to hold the SAME UUIDs (backfilled in a later data
 * migration). This keeps existing code paths that reference `auth_users`
 * working unchanged.
 *
 * `iam_user_academies` replaces the single-tenant pointer
 * (`auth_users.academy_id` / `branch_id`) with a many-to-many membership,
 * unlocking multi-academy admins, contractors, and super-admins.
 */

exports.up = async function up(knex) {
  // --- iam_users -----------------------------------------------------------
  await knex.schema.createTable("iam_users", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    // Identity (uniqueness enforced via partial indexes below so soft-deleted
    // rows can free up an email/username/phone for re-use after GDPR erasure).
    t.string("email", 255);
    t.string("username", 60);
    t.string("phone", 20);
    t.string("password_hash", 255).notNullable();
    t.string("full_name", 200).notNullable();
    t.string("avatar_url", 500);

    // Status flags
    t.boolean("is_active").notNullable().defaultTo(true);
    t.boolean("is_verified").notNullable().defaultTo(false);
    t.boolean("is_anonymized").notNullable().defaultTo(false); // GDPR erasure

    // 2FA (kept here so identity is self-contained; encrypt at rest at app level)
    t.boolean("totp_enabled").notNullable().defaultTo(false);
    t.text("totp_secret");
    t.timestamp("totp_verified_at");

    // Brute-force / lockout
    t.integer("failed_login_attempts").notNullable().defaultTo(0);
    t.timestamp("last_failed_login_at");
    t.timestamp("locked_until");
    t.timestamp("last_login_at");

    // Standard audit columns. created_by/updated_by/deleted_by are UUIDs
    // WITHOUT an FK to iam_users to avoid the self-reference chicken-and-egg
    // problem during seeding/migration.
    t.timestamps(true, true);
    t.timestamp("deleted_at");
    t.uuid("deleted_by");
    t.uuid("created_by");
    t.uuid("updated_by");

    // No plain unique() on email/username/phone — the partial unique indexes
    // below are the canonical uniqueness constraints.
  });

  // Partial unique indexes: ignore soft-deleted rows so an email can be reused
  // after a user is purged (GDPR).
  await knex.raw(`
    CREATE UNIQUE INDEX iam_users_email_active_unique
      ON iam_users (lower(email))
      WHERE deleted_at IS NULL AND email IS NOT NULL;
    CREATE UNIQUE INDEX iam_users_username_active_unique
      ON iam_users (lower(username))
      WHERE deleted_at IS NULL AND username IS NOT NULL;
    CREATE UNIQUE INDEX iam_users_phone_active_unique
      ON iam_users (phone)
      WHERE deleted_at IS NULL AND phone IS NOT NULL;
  `);

  // --- iam_user_academies (membership) -------------------------------------
  await knex.schema.createTable("iam_user_academies", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("iam_users")
      .onDelete("CASCADE");

    t.uuid("academy_id")
      .notNullable()
      .references("id")
      .inTable("academy_academies")
      .onDelete("RESTRICT");

    t.uuid("branch_id")
      .references("id")
      .inTable("academy_branches")
      .onDelete("SET NULL");

    t.string("status", 20).notNullable().defaultTo("active");
    t.timestamp("joined_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("revoked_at");
    t.uuid("revoked_by");
    t.string("revoke_reason", 120);

    t.timestamps(true, true);
    t.timestamp("deleted_at");
    t.uuid("deleted_by");

    t.unique(["user_id", "academy_id"]);
    t.index(["academy_id", "status"]);
    t.index(["academy_id", "branch_id"]);
    t.index("user_id");
  });

  await knex.raw(`
    ALTER TABLE iam_user_academies
      ADD CONSTRAINT iam_user_academies_status_check
      CHECK (status IN ('active','suspended','invited','revoked'));
  `);

  // --- Updated_at triggers (uses the project's existing function defined in
  //     migration 011_shared_tables.js: trigger_set_updated_at()) -----------
  await knex.raw(`
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON iam_users
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON iam_user_academies
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  `);
};

exports.down = async function down(knex) {
  // Triggers are dropped automatically with their tables, but be explicit.
  await knex.raw("DROP TRIGGER IF EXISTS set_updated_at ON iam_user_academies;");
  await knex.raw("DROP TRIGGER IF EXISTS set_updated_at ON iam_users;");
  await knex.schema.dropTableIfExists("iam_user_academies");
  await knex.schema.dropTableIfExists("iam_users");
};
