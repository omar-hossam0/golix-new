const PERMISSIONS = Object.freeze([
  {
    key: "create_training",
    column: "can_create_training",
    label: "Create and manage training",
  },
  {
    key: "take_attendance",
    column: "can_take_attendance",
    label: "Record attendance",
  },
  {
    key: "evaluate_players",
    column: "can_evaluate_players",
    label: "Evaluate players and record match stats",
  },
  {
    key: "record_measurements",
    column: "can_record_measurements",
    label: "Record player measurements",
  },
  {
    key: "manage_player_assignments",
    column: "can_manage_player_assignments",
    label: "Create and review player assignments",
  },
  {
    key: "manage_players",
    column: "can_manage_players",
    label: "Create and complete player profiles",
  },
  {
    key: "manage_groups",
    column: "can_manage_groups",
    label: "Create and manage groups and birth years",
  },
  {
    key: "manage_matches",
    column: "can_manage_matches",
    label: "Plan and operate matches",
  },
  {
    key: "view_injury_risk",
    column: "can_view_injury_risk",
    label: "View injury-risk inputs and predictions",
  },
  {
    key: "run_injury_risk",
    column: "can_run_injury_risk",
    label: "Run and save injury-risk predictions",
  },
  {
    key: "manage_injury_risk",
    column: "can_manage_injury_risk",
    label: "Record injury-risk health inputs",
  },
]);

const permissionSet = (...keys) =>
  Object.freeze(
    Object.fromEntries(PERMISSIONS.map(({ key }) => [key, keys.includes(key)])),
  );

const roles = [
  {
    value: "academy_director",
    label: "Academy director",
    description: "Full operational control inside the assigned scope.",
    permissions: permissionSet(...PERMISSIONS.map(({ key }) => key)),
  },
  {
    value: "head_coach",
    label: "Head coach",
    description: "Leads teams, training, evaluations, assignments, groups, and matches.",
    permissions: permissionSet(
      "create_training",
      "take_attendance",
      "evaluate_players",
      "record_measurements",
      "manage_player_assignments",
      "manage_players",
      "manage_groups",
      "manage_matches",
      "view_injury_risk",
      "run_injury_risk",
      "manage_injury_risk",
    ),
  },
  {
    value: "assistant_coach",
    label: "Assistant coach",
    description: "Supports day-to-day coaching without structural or match control.",
    permissions: permissionSet(
      "create_training",
      "take_attendance",
      "evaluate_players",
      "record_measurements",
      "manage_player_assignments",
      "view_injury_risk",
    ),
  },
  {
    value: "goalkeeping_coach",
    label: "Goalkeeping coach",
    description: "Runs goalkeeper training, attendance, evaluation, and measurements.",
    permissions: permissionSet(
      "create_training",
      "take_attendance",
      "evaluate_players",
      "record_measurements",
      "view_injury_risk",
    ),
  },
  {
    value: "fitness_coach",
    label: "Fitness coach",
    description: "Manages physical training, measurements, and injury-risk inputs.",
    permissions: permissionSet(
      "create_training",
      "take_attendance",
      "evaluate_players",
      "record_measurements",
      "view_injury_risk",
      "run_injury_risk",
      "manage_injury_risk",
    ),
  },
  {
    value: "technical_coach",
    label: "Technical coach",
    description: "Runs technical sessions and player development work.",
    permissions: permissionSet(
      "create_training",
      "take_attendance",
      "evaluate_players",
      "record_measurements",
      "manage_player_assignments",
    ),
  },
  {
    value: "tactical_coach",
    label: "Tactical coach",
    description: "Runs tactical sessions, evaluations, assignments, and match plans.",
    permissions: permissionSet(
      "create_training",
      "evaluate_players",
      "manage_player_assignments",
      "manage_matches",
      "view_injury_risk",
    ),
  },
  {
    value: "goalkeeping_assistant",
    label: "Goalkeeping assistant",
    description: "Supports goalkeeper attendance, evaluation, and measurements.",
    permissions: permissionSet(
      "take_attendance",
      "evaluate_players",
      "record_measurements",
    ),
  },
  {
    value: "performance_analyst",
    label: "Performance analyst",
    description: "Records evaluations and match performance data.",
    permissions: permissionSet(
      "evaluate_players",
      "view_injury_risk",
      "run_injury_risk",
    ),
  },
  {
    value: "team_manager",
    label: "Team manager",
    description: "Handles attendance, player tasks, squads, and match operations.",
    permissions: permissionSet(
      "take_attendance",
      "manage_player_assignments",
      "manage_players",
      "manage_matches",
      "view_injury_risk",
    ),
  },
  {
    value: "physiotherapist",
    label: "Physiotherapist",
    description: "Records physical measurements and manages injury-risk workflows.",
    permissions: permissionSet(
      "record_measurements",
      "view_injury_risk",
      "run_injury_risk",
      "manage_injury_risk",
    ),
  },
  {
    value: "rehabilitation_coach",
    label: "Rehabilitation coach",
    description: "Runs recovery sessions and manages measurements and injury risk.",
    permissions: permissionSet(
      "create_training",
      "take_attendance",
      "record_measurements",
      "view_injury_risk",
      "run_injury_risk",
      "manage_injury_risk",
    ),
  },
  {
    value: "scout",
    label: "Scout",
    description: "Can evaluate assigned players without operational controls.",
    permissions: permissionSet("evaluate_players"),
  },
  {
    value: "youth_coach",
    label: "Youth coach",
    description: "Runs youth development training, attendance, and player work.",
    permissions: permissionSet(
      "create_training",
      "take_attendance",
      "evaluate_players",
      "record_measurements",
      "manage_player_assignments",
      "manage_players",
      "view_injury_risk",
    ),
  },
  {
    value: "conditioning_coach",
    label: "Conditioning coach",
    description: "Runs conditioning work and manages physical and injury-risk data.",
    permissions: permissionSet(
      "create_training",
      "take_attendance",
      "evaluate_players",
      "record_measurements",
      "view_injury_risk",
      "run_injury_risk",
      "manage_injury_risk",
    ),
  },
];

const legacyRoleMap = Object.freeze({
  head: "head_coach",
  assistant: "assistant_coach",
  goalkeeping: "goalkeeping_coach",
});

const ROLE_DEFINITIONS = Object.freeze(
  roles.map((role) => Object.freeze(role)),
);
const ROLE_BY_VALUE = new Map(
  ROLE_DEFINITIONS.map((role) => [role.value, role]),
);
const COACH_ASSIGNMENT_ROLE_VALUES = Object.freeze(
  ROLE_DEFINITIONS.map((role) => role.value),
);
const ASSIGNABLE_COACH_ACCESS_ROLE_VALUES = Object.freeze([
  "head_coach",
  "assistant_coach",
]);
const PERMISSION_COLUMNS = Object.freeze(
  PERMISSIONS.map(({ column }) => column),
);

const normalizeAssignmentRole = (role) =>
  legacyRoleMap[role] || role || "assistant_coach";

const getAssignmentRole = (role) =>
  ROLE_BY_VALUE.get(normalizeAssignmentRole(role)) || null;

const permissionColumnsForRole = (role) => {
  const definition = getAssignmentRole(role);
  if (!definition) return null;
  return Object.fromEntries(
    PERMISSIONS.map(({ key, column }) => [
      column,
      definition.permissions[key] === true,
    ]),
  );
};

const publicRoleCatalog = () =>
  ROLE_DEFINITIONS
    .filter((role) => ASSIGNABLE_COACH_ACCESS_ROLE_VALUES.includes(role.value))
    .map((role) => ({
    value: role.value,
    label: role.label,
    description: role.description,
    permissions: PERMISSIONS.map(({ key, label }) => ({
      key,
      label,
      granted: role.permissions[key] === true,
    })),
  }));

module.exports = {
  ASSIGNABLE_COACH_ACCESS_ROLE_VALUES,
  COACH_ASSIGNMENT_ROLE_VALUES,
  PERMISSIONS,
  PERMISSION_COLUMNS,
  ROLE_DEFINITIONS,
  getAssignmentRole,
  normalizeAssignmentRole,
  permissionColumnsForRole,
  publicRoleCatalog,
};
