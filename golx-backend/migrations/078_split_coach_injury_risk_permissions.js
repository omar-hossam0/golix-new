const viewRoles = [
  "academy_director",
  "head_coach",
  "assistant_coach",
  "goalkeeping_coach",
  "fitness_coach",
  "tactical_coach",
  "performance_analyst",
  "team_manager",
  "physiotherapist",
  "rehabilitation_coach",
  "youth_coach",
  "conditioning_coach",
];

const runRoles = [
  "academy_director",
  "head_coach",
  "fitness_coach",
  "performance_analyst",
  "physiotherapist",
  "rehabilitation_coach",
  "conditioning_coach",
];

const manageRoles = [
  "academy_director",
  "head_coach",
  "fitness_coach",
  "physiotherapist",
  "rehabilitation_coach",
  "conditioning_coach",
];

const addPermission = async (knex, table, column, roles) => {
  if (!(await knex.schema.hasColumn(table, column))) {
    await knex.schema.alterTable(table, (builder) => {
      builder.boolean(column).notNullable().defaultTo(false);
    });
  }
  await knex(table).update({
    [column]: knex.raw("role = ANY(?::text[])", [roles]),
  });
};

exports.up = async function up(knex) {
  for (const table of [
    "coach_branch_access_rules",
    "coach_group_assignments",
  ]) {
    await addPermission(knex, table, "can_view_injury_risk", viewRoles);
    await addPermission(knex, table, "can_run_injury_risk", runRoles);
    await addPermission(knex, table, "can_manage_injury_risk", manageRoles);
  }
};

exports.down = async function down(knex) {
  for (const table of [
    "coach_branch_access_rules",
    "coach_group_assignments",
  ]) {
    await knex.schema.alterTable(table, (builder) => {
      builder.dropColumn("can_view_injury_risk");
      builder.dropColumn("can_run_injury_risk");
    });
  }
};
