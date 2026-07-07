const permissionColumns = [
  "can_create_training",
  "can_take_attendance",
  "can_evaluate_players",
  "can_record_measurements",
  "can_manage_player_assignments",
  "can_manage_groups",
  "can_manage_matches",
  "can_manage_injury_risk",
];

const grantedRoles = {
  can_create_training: [
    "academy_director",
    "head_coach",
    "head",
    "assistant_coach",
    "assistant",
    "goalkeeping_coach",
    "goalkeeping",
    "fitness_coach",
    "technical_coach",
    "tactical_coach",
    "rehabilitation_coach",
    "youth_coach",
    "conditioning_coach",
  ],
  can_take_attendance: [
    "academy_director",
    "head_coach",
    "head",
    "assistant_coach",
    "assistant",
    "goalkeeping_coach",
    "goalkeeping",
    "fitness_coach",
    "technical_coach",
    "goalkeeping_assistant",
    "team_manager",
    "rehabilitation_coach",
    "youth_coach",
    "conditioning_coach",
  ],
  can_evaluate_players: [
    "academy_director",
    "head_coach",
    "head",
    "assistant_coach",
    "assistant",
    "goalkeeping_coach",
    "goalkeeping",
    "fitness_coach",
    "technical_coach",
    "tactical_coach",
    "goalkeeping_assistant",
    "performance_analyst",
    "scout",
    "youth_coach",
    "conditioning_coach",
  ],
  can_record_measurements: [
    "academy_director",
    "head_coach",
    "head",
    "assistant_coach",
    "assistant",
    "goalkeeping_coach",
    "goalkeeping",
    "fitness_coach",
    "technical_coach",
    "goalkeeping_assistant",
    "physiotherapist",
    "rehabilitation_coach",
    "youth_coach",
    "conditioning_coach",
  ],
  can_manage_player_assignments: [
    "academy_director",
    "head_coach",
    "head",
    "assistant_coach",
    "assistant",
    "technical_coach",
    "tactical_coach",
    "team_manager",
    "youth_coach",
  ],
  can_manage_groups: ["academy_director", "head_coach", "head"],
  can_manage_matches: [
    "academy_director",
    "head_coach",
    "head",
    "tactical_coach",
    "team_manager",
  ],
  can_manage_injury_risk: [
    "academy_director",
    "fitness_coach",
    "physiotherapist",
    "rehabilitation_coach",
    "conditioning_coach",
  ],
};

const addMissingBooleanColumns = async (knex, table, columns) => {
  for (const column of columns) {
    if (!(await knex.schema.hasColumn(table, column))) {
      await knex.schema.alterTable(table, (builder) => {
        builder.boolean(column).notNullable().defaultTo(false);
      });
    }
  }
};

const backfillRolePermissions = async (knex, table) => {
  for (const column of permissionColumns) {
    await knex(table).update({
      [column]: knex.raw("role = ANY(?::text[])", [grantedRoles[column]]),
    });
  }
};

exports.up = async function up(knex) {
  await addMissingBooleanColumns(
    knex,
    "coach_branch_access_rules",
    permissionColumns,
  );
  await addMissingBooleanColumns(knex, "coach_group_assignments", [
    "can_record_measurements",
    "can_manage_player_assignments",
    "can_manage_groups",
    "can_manage_matches",
    "can_manage_injury_risk",
  ]);

  for (const column of [
    "can_create_training",
    "can_take_attendance",
    "can_evaluate_players",
  ]) {
    await knex.raw(
      `ALTER TABLE coach_group_assignments ALTER COLUMN ${column} SET DEFAULT false`,
    );
  }

  await backfillRolePermissions(knex, "coach_branch_access_rules");
  await backfillRolePermissions(knex, "coach_group_assignments");
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("coach_branch_access_rules", (table) => {
    permissionColumns.forEach((column) => table.dropColumn(column));
  });
  await knex.schema.alterTable("coach_group_assignments", (table) => {
    [
      "can_record_measurements",
      "can_manage_player_assignments",
      "can_manage_groups",
      "can_manage_matches",
      "can_manage_injury_risk",
    ].forEach((column) => table.dropColumn(column));
  });
  for (const column of [
    "can_create_training",
    "can_take_attendance",
    "can_evaluate_players",
  ]) {
    await knex.raw(
      `ALTER TABLE coach_group_assignments ALTER COLUMN ${column} SET DEFAULT true`,
    );
  }
};
