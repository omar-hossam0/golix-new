exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable("match_evaluation_edit_requests");
  if (exists) return;

  await knex.schema.createTable("match_evaluation_edit_requests", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("academy_id")
      .notNullable()
      .references("id")
      .inTable("academy_academies")
      .onDelete("CASCADE");
    t.uuid("match_id")
      .notNullable()
      .references("id")
      .inTable("matches")
      .onDelete("CASCADE");
    t.uuid("coach_id")
      .notNullable()
      .references("id")
      .inTable("coach_profiles")
      .onDelete("CASCADE");
    t.uuid("requested_by_user_id")
      .references("id")
      .inTable("auth_users")
      .onDelete("SET NULL");
    t.uuid("reviewed_by_admin_id")
      .references("id")
      .inTable("auth_users")
      .onDelete("SET NULL");
    t.string("status", 30).notNullable().defaultTo("pending");
    t.text("reason");
    t.text("admin_response");
    t.timestamp("approved_at");
    t.timestamp("expires_at");
    t.timestamp("consumed_at");
    t.timestamps(true, true);

    t.index(["academy_id", "status"]);
    t.index(["match_id", "coach_id"]);
    t.index("expires_at");
  });

  await knex.raw(`
    ALTER TABLE match_evaluation_edit_requests
    ADD CONSTRAINT match_evaluation_edit_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX match_evaluation_edit_requests_one_pending
    ON match_evaluation_edit_requests (match_id, coach_id)
    WHERE status = 'pending'
  `);
};

exports.down = async function down(knex) {
  await knex.raw(
    "DROP INDEX IF EXISTS match_evaluation_edit_requests_one_pending",
  );
  await knex.schema.dropTableIfExists("match_evaluation_edit_requests");
};
