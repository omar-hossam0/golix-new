const normalizeLegacyRoles = async (knex, table) => {
  await knex(table)
    .whereIn("role", ["head", "assistant", "goalkeeping"])
    .update({
      role: knex.raw(`
        CASE role
          WHEN 'head' THEN 'head_coach'
          WHEN 'assistant' THEN 'assistant_coach'
          WHEN 'goalkeeping' THEN 'goalkeeping_coach'
          ELSE role
        END
      `),
    });
};

exports.up = async function up(knex) {
  await normalizeLegacyRoles(knex, "coach_branch_access_rules");
  await normalizeLegacyRoles(knex, "coach_group_assignments");
};

exports.down = async function down() {
  // Modern role names existed before this migration, so reversing them would
  // corrupt assignments that were not created from legacy values.
};
