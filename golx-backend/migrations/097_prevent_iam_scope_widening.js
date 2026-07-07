/**
 * A deleted branch/group must remove its scoped role assignments.
 * SET NULL would silently widen the role to academy scope.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable("iam_user_roles", (table) => {
    table.dropForeign("scope_branch_id");
    table.dropForeign("scope_group_id");
  });

  await knex.schema.alterTable("iam_user_roles", (table) => {
    table
      .foreign("scope_branch_id")
      .references("id")
      .inTable("academy_branches")
      .onDelete("CASCADE");
    table
      .foreign("scope_group_id")
      .references("id")
      .inTable("academy_groups")
      .onDelete("CASCADE");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("iam_user_roles", (table) => {
    table.dropForeign("scope_branch_id");
    table.dropForeign("scope_group_id");
  });

  await knex.schema.alterTable("iam_user_roles", (table) => {
    table
      .foreign("scope_branch_id")
      .references("id")
      .inTable("academy_branches")
      .onDelete("SET NULL");
    table
      .foreign("scope_group_id")
      .references("id")
      .inTable("academy_groups")
      .onDelete("SET NULL");
  });
};
