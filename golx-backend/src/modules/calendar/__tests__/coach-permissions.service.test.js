require("dotenv").config();
const CalendarService = require("../calendar.service");

describe("CalendarService coach effective permissions", () => {
  test("returns the persisted aggregate for the authenticated coach", async () => {
    const permissions = {
      can_create_training: false,
      can_take_attendance: true,
      can_evaluate_players: false,
    };
    const repo = {
      findCoachByUserId: jest.fn().mockResolvedValue({
        id: "coach-1",
        academy_id: "academy-1",
      }),
      findCoachEffectivePermissions: jest.fn().mockResolvedValue(permissions),
    };
    const service = new CalendarService(repo);

    await expect(
      service.coachGetPermissions("user-1", "academy-1"),
    ).resolves.toEqual(permissions);
    expect(repo.findCoachEffectivePermissions).toHaveBeenCalledWith(
      "coach-1",
      "academy-1",
    );
  });
});
