exports.up = async function up(knex) {
  const hasAssignments = await knex.schema.hasTable("player_assignments");
  if (hasAssignments) {
    const hasTargetType = await knex.schema.hasColumn("player_assignments", "target_type");
    if (!hasTargetType) {
      await knex.schema.alterTable("player_assignments", (t) => {
        t.string("target_type", 20).notNullable().defaultTo("group");
      });
      await knex.raw(`
        ALTER TABLE player_assignments
        ADD CONSTRAINT player_assignments_target_type_check
        CHECK (target_type IN ('group', 'birth_year'))
      `);
      await knex.schema.alterTable("player_assignments", (t) => {
        t.index("target_type");
      });
    }
  }

  const hasAssignmentBirthYears = await knex.schema.hasTable("player_assignment_birth_years");
  if (!hasAssignmentBirthYears) {
    await knex.schema.createTable("player_assignment_birth_years", (t) => {
      t.uuid("assignment_id").notNullable().references("id").inTable("player_assignments").onDelete("CASCADE");
      t.uuid("birth_year_id").notNullable().references("id").inTable("academy_birth_years").onDelete("CASCADE");
      t.primary(["assignment_id", "birth_year_id"]);
      t.index("birth_year_id");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("player_assignment_birth_years");
  const hasAssignments = await knex.schema.hasTable("player_assignments");
  if (!hasAssignments) return;
  const hasTargetType = await knex.schema.hasColumn("player_assignments", "target_type");
  if (hasTargetType) {
    await knex.raw("ALTER TABLE player_assignments DROP CONSTRAINT IF EXISTS player_assignments_target_type_check");
    await knex.schema.alterTable("player_assignments", (t) => {
      t.dropIndex("target_type");
      t.dropColumn("target_type");
    });
  }
};
