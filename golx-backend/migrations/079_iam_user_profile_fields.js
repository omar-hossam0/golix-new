exports.up = async function up(knex) {
  const hasIamUsers = await knex.schema.hasTable('iam_users');
  if (!hasIamUsers) return;

  const columns = {
    address: await knex.schema.hasColumn('iam_users', 'address'),
    jobTitle: await knex.schema.hasColumn('iam_users', 'job_title'),
    department: await knex.schema.hasColumn('iam_users', 'department'),
    notes: await knex.schema.hasColumn('iam_users', 'notes'),
  };

  await knex.schema.alterTable('iam_users', (t) => {
    if (!columns.address) t.text('address');
    if (!columns.jobTitle) t.string('job_title', 120);
    if (!columns.department) t.string('department', 120);
    if (!columns.notes) t.text('notes');
  });
};

exports.down = async function down(knex) {
  const hasIamUsers = await knex.schema.hasTable('iam_users');
  if (!hasIamUsers) return;

  const columns = {
    address: await knex.schema.hasColumn('iam_users', 'address'),
    jobTitle: await knex.schema.hasColumn('iam_users', 'job_title'),
    department: await knex.schema.hasColumn('iam_users', 'department'),
    notes: await knex.schema.hasColumn('iam_users', 'notes'),
  };

  await knex.schema.alterTable('iam_users', (t) => {
    if (columns.notes) t.dropColumn('notes');
    if (columns.department) t.dropColumn('department');
    if (columns.jobTitle) t.dropColumn('job_title');
    if (columns.address) t.dropColumn('address');
  });
};
