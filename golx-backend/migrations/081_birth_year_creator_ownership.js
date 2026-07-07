exports.up = async function up(knex) {
  const hasCreatedByRole = await knex.schema.hasColumn('academy_birth_years', 'created_by_role');
  const hasCreatedByUserId = await knex.schema.hasColumn('academy_birth_years', 'created_by_user_id');
  const hasCreatedByCoachId = await knex.schema.hasColumn('academy_birth_years', 'created_by_coach_id');

  await knex.schema.alterTable('academy_birth_years', (table) => {
    if (!hasCreatedByRole) table.string('created_by_role', 20).notNullable().defaultTo('admin');
    if (!hasCreatedByUserId) table.uuid('created_by_user_id').references('id').inTable('auth_users').onDelete('SET NULL');
    if (!hasCreatedByCoachId) table.uuid('created_by_coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
  });

  await knex.raw("UPDATE academy_birth_years SET created_by_role = COALESCE(created_by_role, 'admin')");
  await knex.raw('CREATE INDEX IF NOT EXISTS academy_birth_years_created_by_coach_id_idx ON academy_birth_years(created_by_coach_id)');
};

exports.down = async function down(knex) {
  const hasCreatedByCoachId = await knex.schema.hasColumn('academy_birth_years', 'created_by_coach_id');
  const hasCreatedByUserId = await knex.schema.hasColumn('academy_birth_years', 'created_by_user_id');
  const hasCreatedByRole = await knex.schema.hasColumn('academy_birth_years', 'created_by_role');

  await knex.schema.alterTable('academy_birth_years', (table) => {
    if (hasCreatedByCoachId) table.dropColumn('created_by_coach_id');
    if (hasCreatedByUserId) table.dropColumn('created_by_user_id');
    if (hasCreatedByRole) table.dropColumn('created_by_role');
  });
};
