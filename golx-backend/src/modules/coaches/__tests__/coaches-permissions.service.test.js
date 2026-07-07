require("dotenv").config();
const CoachesService = require("../coaches.service");

describe("CoachesService assignment permissions", () => {
  test("derives persisted permissions from the selected role", async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({
        id: "coach-1",
        academy_id: "academy-1",
        branch_id: null,
      }),
      verifyBranchOwnership: jest.fn().mockResolvedValue({ id: "branch-1" }),
      findGroupsByIdsInBranch: jest
        .fn()
        .mockResolvedValue([{ id: "group-1", branch_id: "branch-1" }]),
      replaceCoachAccessRule: jest.fn().mockImplementation(
        async (_coachId, branchId, data) => ({ id: "rule-1", branch_id: branchId, ...data }),
      ),
      updateCoachBranch: jest.fn().mockResolvedValue({}),
      findCoachAccessRules: jest.fn().mockResolvedValue([
        {
          id: "rule-1",
          coach_id: "coach-1",
          branch_id: "branch-1",
          access_type: "groups",
          role: "physiotherapist",
          all_groups: false,
          all_birth_years: false,
          groups: [],
          birthYears: [],
          assignedGroups: [],
        },
      ]),
    };
    const service = new CoachesService(repo, {});

    await service.upsertCoachAccess(
      "coach-1",
      "academy-1",
      "admin-1",
      {
        branchId: "branch-1",
        role: "physiotherapist",
        allGroups: false,
        allBirthYears: false,
        groupIds: ["group-1"],
        birthYearIds: [],
      },
    );

    expect(repo.replaceCoachAccessRule).toHaveBeenCalledWith(
      "coach-1",
      "branch-1",
      expect.objectContaining({
        role: "physiotherapist",
        permissions: expect.objectContaining({
          can_record_measurements: true,
          can_manage_injury_risk: true,
          can_create_training: false,
          can_take_attendance: false,
          can_manage_players: false,
          can_manage_matches: false,
        }),
      }),
    );
  });

  test("denies actions outside the granted group scope", async () => {
    const repo = {
      findCoachPermissionScopes: jest.fn().mockResolvedValue({
        groups: [{ group_id: "group-1", branch_id: "branch-1" }],
        branches: [{ branch_id: "branch-1" }],
      }),
    };
    const service = new CoachesService(repo, {});
    const coach = { id: "coach-1" };

    await expect(
      service._assertCoachPermission(
        coach,
        "academy-1",
        "can_take_attendance",
        { groupIds: ["group-1"] },
      ),
    ).resolves.toBeUndefined();

    await expect(
      service._assertCoachPermission(
        coach,
        "academy-1",
        "can_take_attendance",
        { groupIds: ["group-2"] },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
