exports.up = async function up(knex) {
  await knex.raw("ALTER TYPE coach_assignment_file_type ADD VALUE IF NOT EXISTS 'word'");

  const hasCoachAssignments = await knex.schema.hasTable("coach_assignments");
  if (hasCoachAssignments) {
    await knex.raw(`
      ALTER TABLE coach_assignments
      ALTER COLUMN accepted_file_types SET DEFAULT '["pdf","word","image"]'::jsonb
    `);
    await knex.raw(`
      UPDATE coach_assignments
      SET accepted_file_types = (
        SELECT jsonb_agg(DISTINCT value)
        FROM jsonb_array_elements_text(accepted_file_types || '["word"]'::jsonb) AS values(value)
      )
      WHERE NOT jsonb_exists(accepted_file_types, 'word')
    `);
  }

  const hasAssignments = await knex.schema.hasTable("player_assignments");
  if (!hasAssignments) {
    await knex.schema.createTable("player_assignments", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("academy_id").notNullable().references("id").inTable("academy_academies").onDelete("CASCADE");
      t.uuid("created_by_coach_id").notNullable().references("id").inTable("coach_profiles").onDelete("CASCADE");
      t.uuid("created_by_user_id").references("id").inTable("auth_users").onDelete("SET NULL");
      t.string("title", 255).notNullable();
      t.text("description");
      t.timestamp("open_at");
      t.timestamp("due_at");
      t.string("status", 20).notNullable().defaultTo("active");
      t.jsonb("accepted_file_types").notNullable().defaultTo(knex.raw(`'["pdf","word","image"]'::jsonb`));
      t.timestamps(true, true);
      t.timestamp("deleted_at");
      t.index("academy_id");
      t.index("created_by_coach_id");
      t.index("status");
      t.index("open_at");
      t.index("due_at");
    });

    await knex.raw(`
      ALTER TABLE player_assignments
      ADD CONSTRAINT player_assignments_status_check
      CHECK (status IN ('active', 'closed', 'cancelled'))
    `);
  }

  const hasAssignmentGroups = await knex.schema.hasTable("player_assignment_groups");
  if (!hasAssignmentGroups) {
    await knex.schema.createTable("player_assignment_groups", (t) => {
      t.uuid("assignment_id").notNullable().references("id").inTable("player_assignments").onDelete("CASCADE");
      t.uuid("group_id").notNullable().references("id").inTable("academy_groups").onDelete("CASCADE");
      t.primary(["assignment_id", "group_id"]);
      t.index("group_id");
    });
  }

  const hasSubmissions = await knex.schema.hasTable("player_assignment_submissions");
  if (!hasSubmissions) {
    await knex.schema.createTable("player_assignment_submissions", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("assignment_id").notNullable().references("id").inTable("player_assignments").onDelete("CASCADE");
      t.uuid("player_id").notNullable().references("id").inTable("player_profiles").onDelete("CASCADE");
      t.uuid("submitted_by_user_id").references("id").inTable("auth_users").onDelete("SET NULL");
      t.text("notes");
      t.timestamp("submitted_at").notNullable().defaultTo(knex.fn.now());
      t.timestamps(true, true);
      t.unique(["assignment_id", "player_id"]);
      t.index("assignment_id");
      t.index("player_id");
    });
  }

  const hasFiles = await knex.schema.hasTable("player_assignment_files");
  if (!hasFiles) {
    await knex.schema.createTable("player_assignment_files", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("submission_id").notNullable().references("id").inTable("player_assignment_submissions").onDelete("CASCADE");
      t.uuid("uploaded_by").references("id").inTable("auth_users").onDelete("SET NULL");
      t.string("file_type", 20).notNullable();
      t.string("file_name", 255).notNullable();
      t.text("file_url").notNullable();
      t.string("mime_type", 120);
      t.bigInteger("size_bytes");
      t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      t.index("submission_id");
      t.index("uploaded_by");
    });

    await knex.raw(`
      ALTER TABLE player_assignment_files
      ADD CONSTRAINT player_assignment_files_file_type_check
      CHECK (file_type IN ('pdf', 'word', 'image'))
    `);
  }

  const hasDailyInputs = await knex.schema.hasTable("player_daily_ai_inputs");
  if (!hasDailyInputs) {
    await knex.schema.createTable("player_daily_ai_inputs", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("academy_id").notNullable().references("id").inTable("academy_academies").onDelete("CASCADE");
      t.uuid("player_id").notNullable().references("id").inTable("player_profiles").onDelete("CASCADE");
      t.uuid("submitted_by_user_id").references("id").inTable("auth_users").onDelete("SET NULL");
      t.date("input_date").notNullable();
      t.smallint("sleep_hours").notNullable();
      t.smallint("trained_today").notNullable();
      t.smallint("meals_count").notNullable();
      t.smallint("daily_ai_score").notNullable();
      t.timestamp("submitted_at").notNullable().defaultTo(knex.fn.now());
      t.timestamps(true, true);
      t.unique(["player_id", "input_date"]);
      t.index("academy_id");
      t.index("input_date");
    });

    await knex.raw(`
      ALTER TABLE player_daily_ai_inputs
      ADD CONSTRAINT player_daily_ai_inputs_sleep_check CHECK (sleep_hours BETWEEN 0 AND 12),
      ADD CONSTRAINT player_daily_ai_inputs_trained_check CHECK (trained_today IN (0, 1)),
      ADD CONSTRAINT player_daily_ai_inputs_meals_check CHECK (meals_count BETWEEN 0 AND 8),
      ADD CONSTRAINT player_daily_ai_inputs_score_check CHECK (daily_ai_score BETWEEN 0 AND 100)
    `);
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("player_assignment_files");
  await knex.schema.dropTableIfExists("player_assignment_submissions");
  await knex.schema.dropTableIfExists("player_assignment_groups");
  await knex.schema.dropTableIfExists("player_assignments");
  await knex.schema.dropTableIfExists("player_daily_ai_inputs");
};
