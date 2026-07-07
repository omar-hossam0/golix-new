/**
 * IAM — Step 5: Devices & Sessions
 *
 * `iam_devices` binds a user to a recognized device fingerprint so we can:
 *   - Detect suspicious logins from new devices.
 *   - Let admins revoke a single device's access without affecting others.
 *
 * `iam_sessions` represents one active access-token issuance. Every issued
 * JWT carries `jti = iam_sessions.jwt_id`; revocation = setting `revoked_at`.
 * This is the missing piece that lets admins forcibly log a user out
 * (`auth_refresh_tokens` only handles refresh, not access).
 */

exports.up = async function up(knex) {
  // --- Devices -------------------------------------------------------------
  await knex.schema.createTable("iam_devices", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("iam_users")
      .onDelete("CASCADE");

    // SHA-256 hex of (UA + screen + canvas + tz + ...). Hashed so we never
    // store raw fingerprints (privacy).
    t.string("fingerprint_hash", 64).notNullable();

    t.string("name", 120);                // 'Chrome on MacBook Pro'
    t.string("platform", 40);             // 'web' | 'ios' | 'android'
    t.string("os", 80);
    t.string("browser", 80);

    t.boolean("trusted").notNullable().defaultTo(false);
    t.timestamp("first_seen_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("last_seen_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("revoked_at");
    t.uuid("revoked_by");

    t.timestamps(true, true);

    t.unique(["user_id", "fingerprint_hash"]);
    t.index("user_id");
    t.index(["user_id", "revoked_at"]);
  });

  // --- Sessions ------------------------------------------------------------
  await knex.schema.createTable("iam_sessions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));

    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("iam_users")
      .onDelete("CASCADE");

    // Active tenant for this session (a multi-academy user picks one on login).
    t.uuid("academy_id")
      .notNullable()
      .references("id")
      .inTable("academy_academies")
      .onDelete("CASCADE");

    t.uuid("device_id")
      .references("id")
      .inTable("iam_devices")
      .onDelete("SET NULL");

    // JWT identifier (jti claim). Unique so a JWT can be presented only once.
    t.uuid("jwt_id").notNullable().unique();

    // SHA-256 hex of refresh token (never stored raw).
    t.string("refresh_token_hash", 64).notNullable();

    // Network metadata for forensics
    t.specificType("ip_address", "inet");
    t.text("user_agent");

    t.timestamp("issued_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("expires_at").notNullable();
    t.timestamp("last_seen_at");
    t.timestamp("revoked_at");
    t.uuid("revoked_by");
    t.string("revoke_reason", 60);  // 'logout','admin_revoke','password_change','suspicious','expired'

    t.timestamps(true, true);

    t.index(["user_id", "revoked_at"]);
    t.index(["academy_id", "user_id"]);
    t.index("expires_at");
    t.index("device_id");
  });

  // Fast lookup of "does this refresh token exist and is it active?"
  await knex.raw(`
    CREATE INDEX iam_sessions_refresh_active
      ON iam_sessions (refresh_token_hash)
      WHERE revoked_at IS NULL;
  `);

  await knex.raw(`
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON iam_devices
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON iam_sessions
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP TRIGGER IF EXISTS set_updated_at ON iam_sessions;");
  await knex.raw("DROP TRIGGER IF EXISTS set_updated_at ON iam_devices;");
  await knex.raw("DROP INDEX IF EXISTS iam_sessions_refresh_active;");
  await knex.schema.dropTableIfExists("iam_sessions");
  await knex.schema.dropTableIfExists("iam_devices");
};
