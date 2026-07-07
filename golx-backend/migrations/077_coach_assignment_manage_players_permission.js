const grantedRoles = [
  "academy_director",
  "head_coach",
  "team_manager",
  "youth_coach",
];

const addPermission = async (knex, table) => {
  if (!(await knex.schema.hasColumn(table, "can_manage_players"))) {
    await knex.schema.alterTable(table, (builder) => {
      builder
        .boolean("can_manage_players")
        .notNullable()
        .defaultTo(false);
    });
  }
  await knex(table).update({
    can_manage_players: knex.raw("role = ANY(?::text[])", [grantedRoles]),
  });
};

exports.up = async function up(knex) {
  await addPermission(knex, "coach_branch_access_rules");
  await addPermission(knex, "coach_group_assignments");
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("coach_branch_access_rules", (table) => {
    table.dropColumn("can_manage_players");
  });
  await knex.schema.alterTable("coach_group_assignments", (table) => {
    table.dropColumn("can_manage_players");
  });
};
