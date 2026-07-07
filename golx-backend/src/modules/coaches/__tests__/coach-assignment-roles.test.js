const {
  ASSIGNABLE_COACH_ACCESS_ROLE_VALUES,
  PERMISSIONS,
  getAssignmentRole,
  normalizeAssignmentRole,
  permissionColumnsForRole,
  publicRoleCatalog,
} = require("../coach-assignment-roles");

describe("coach assignment role catalog", () => {
  test("publishes one complete permission matrix for every role", () => {
    const catalog = publicRoleCatalog();

    expect(catalog).toHaveLength(ASSIGNABLE_COACH_ACCESS_ROLE_VALUES.length);
    expect(catalog.map((role) => role.value)).toEqual(
      ASSIGNABLE_COACH_ACCESS_ROLE_VALUES,
    );
    catalog.forEach((role) => {
      expect(role.permissions).toHaveLength(PERMISSIONS.length);
      expect(role.permissions.every((permission) =>
        typeof permission.granted === "boolean")).toBe(true);
    });
  });

  test("uses least privilege for specialized roles", () => {
    expect(getAssignmentRole("physiotherapist").permissions).toMatchObject({
      record_measurements: true,
      manage_injury_risk: true,
      manage_players: false,
      create_training: false,
      take_attendance: false,
      evaluate_players: false,
      manage_matches: false,
    });
    expect(getAssignmentRole("performance_analyst").permissions).toMatchObject({
      evaluate_players: true,
      create_training: false,
      take_attendance: false,
      manage_groups: false,
      manage_matches: false,
    });
  });

  test("keeps legacy stored roles compatible without granting unknown roles", () => {
    expect(normalizeAssignmentRole("head")).toBe("head_coach");
    expect(permissionColumnsForRole("assistant")).toMatchObject({
      can_create_training: true,
      can_take_attendance: true,
      can_evaluate_players: true,
      can_manage_players: false,
      can_manage_groups: false,
      can_manage_matches: false,
    });
    expect(permissionColumnsForRole("unknown_role")).toBeNull();
  });
});
