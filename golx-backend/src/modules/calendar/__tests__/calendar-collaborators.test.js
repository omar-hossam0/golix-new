require("dotenv").config();

const CalendarService = require("../calendar.service");
const CalendarRepository = require("../calendar.repository");
const ParentRepository = require("../repositories/parent.repository");
const InjuryRiskService = require("../services/injury-risk.service");
const PlayerAssignmentsService = require("../services/player-assignments.service");
const {
  sanitizeFileName,
} = require("../services/player-assignments.service");

describe("calendar domain collaborators", () => {
  test("CalendarRepository inherits the parent persistence contract", () => {
    const repository = new CalendarRepository(jest.fn());

    expect(repository).toBeInstanceOf(ParentRepository);
    expect(typeof repository.findParentLinkedPlayers).toBe("function");
    expect(typeof repository.createParentPlayerLink).toBe("function");
    expect(typeof repository.listCoachParentNotes).toBe("function");
  });

  test("player assignment shaping and score rules preserve the API contract", () => {
    const service = new PlayerAssignmentsService(
      {},
      { getPlayer: jest.fn() },
    );

    expect(
      service.dailyAiScore({
        sleepHours: 8,
        trainedToday: 1,
        mealsCount: 4,
      }),
    ).toBe(100);
    expect(
      service.shapeSubmission({
        id: "submission-1",
        assignment_id: "assignment-1",
        player_id: "player-1",
        files: [
          {
            id: "file-1",
            submission_id: "submission-1",
            file_type: "pdf",
            file_name: "task.pdf",
            file_url: "/uploads/task.pdf",
            size_bytes: "42",
          },
        ],
      }),
    ).toMatchObject({
      id: "submission-1",
      assignmentId: "assignment-1",
      reviewStatus: "pending",
      files: [{ id: "file-1", sizeBytes: 42 }],
    });
    expect(sanitizeFileName("report%2Fweek.pdf")).toBe("report-week.pdf");
  });

  test("injury risk input normalization is deterministic and injectable", async () => {
    const customProfiles = new Map([
      [
        "player-1",
        [{ key: "main_position", value: ["Right Winger"] }],
      ],
    ]);
    const service = new InjuryRiskService(
      {},
      {
        getCoach: jest.fn(),
        ensureCoachHasPermission: jest.fn(),
        ensureCoachCanAccessPlayers: jest.fn(),
        playerCustomProfilesByPlayer: jest
          .fn()
          .mockResolvedValue(customProfiles),
      },
      {
        now: () => new Date("2026-07-02T12:00:00.000Z"),
        modelVersion: "test-model",
        runPredictions: jest.fn(),
      },
    );

    const [player] = await service.playersWithMainPosition([
      {
        id: "player-1",
        full_name: "Player One",
        date_of_birth: "2010-07-03",
        position: "Midfielder",
      },
    ]);
    expect(player.injury_risk_position).toBe("Right Winger");
    expect(
      service.toModelInput(player, {
        attendance_rate: 85,
        training_sessions_week: "3",
        match_minutes_last_week: "70",
      }),
    ).toMatchObject({
      player_id: "player-1",
      age: 15,
      position: "Right Winger",
      attendance_rate: 0.85,
      training_sessions_per_week: 3,
      match_minutes_last_week: 70,
    });
  });

  test("CalendarService keeps controller-facing methods as stable delegates", async () => {
    const service = new CalendarService({});
    service.playerAssignments.listForPlayer = jest
      .fn()
      .mockResolvedValue({ data: [], total: 0 });
    service.injuryRisk.runModel = jest.fn().mockResolvedValue([]);

    await expect(
      service.playerListAssignments("user-1", "academy-1", { page: 2 }),
    ).resolves.toEqual({ data: [], total: 0 });
    await expect(
      service.coachRunInjuryRiskModel("coach-user-1", "academy-1"),
    ).resolves.toEqual([]);

    expect(service.playerAssignments.listForPlayer).toHaveBeenCalledWith(
      "user-1",
      "academy-1",
      { page: 2 },
    );
    expect(service.injuryRisk.runModel).toHaveBeenCalledWith(
      "coach-user-1",
      "academy-1",
    );
  });
});
