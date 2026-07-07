process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgresql://goalix:goalix@localhost:5432/goalix_test";
process.env.REDIS_URL ||= "redis://localhost:6379";
process.env.JWT_SECRET ||= "test-access-secret-that-is-at-least-32-chars";
process.env.JWT_REFRESH_SECRET ||=
  "test-refresh-secret-that-is-different-and-long";

const bcrypt = require("bcrypt");
const ExcelJS = require("exceljs");
const PlayersService = require("../src/modules/players/players.service");
const {
  PLAYER_IMPORT_COLUMNS,
  buildPlayerImportTemplate,
} = require("../src/modules/players/players.import");

const academyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branch = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Main Branch",
};
const actor = {
  role: "admin",
  academyId,
  userId: "22222222-2222-4222-8222-222222222222",
};

const rowData = (overrides = {}) => ({
  fullName: "Player One",
  birthDate: "2012-05-10",
  heightCm: 150,
  weightKg: 42,
  preferredFoot: "Right",
  dateJoined: "2026-07-01",
  username: "player.one",
  password: "StrongPass1!",
  gender: "Male",
  nationality: "Egyptian",
  phone: "01000000001",
  address: "Cairo",
  branchId: `${branch.name} [${branch.id}]`,
  guardianName: "Guardian",
  guardianPhone: "01000000002",
  guardianRelation: "Father",
  isActive: "Active",
  ...overrides,
});

const existingPlayer = (overrides = {}) => ({
  id: "33333333-3333-4333-8333-333333333333",
  user_id: "44444444-4444-4444-8444-444444444444",
  academy_id: academyId,
  branch_id: branch.id,
  branch_name: branch.name,
  username: "player.one",
  full_name: "Player One",
  date_of_birth: "2012-05-10",
  height_cm: "150.00",
  weight_kg: "42.00",
  preferred_foot: "right",
  date_joined: "2026-07-01",
  gender: "male",
  nationality: "Egyptian",
  phone: "01000000001",
  address: "Cairo",
  guardian_name: "Guardian",
  guardian_phone: "01000000002",
  guardian_relation: "father",
  is_active: true,
  ...overrides,
});

async function workbookWithRows(rows) {
  const buffer = await buildPlayerImportTemplate([branch]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet("Players");
  rows.forEach((row, rowIndex) => {
    PLAYER_IMPORT_COLUMNS.forEach((column, columnIndex) => {
      worksheet.getCell(rowIndex + 2, columnIndex + 1).value =
        row[column.field];
    });
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("PlayersService Excel imports", () => {
  test("reports every duplicated username row and does not use player names as keys", async () => {
    const repo = {
      db: {},
      findBranchesForImport: jest.fn().mockResolvedValue([branch]),
      findBranchByIdAndAcademy: jest.fn().mockResolvedValue(branch),
      findExistingImportUsers: jest.fn().mockResolvedValue([]),
      findImportPlayersByUsernames: jest.fn().mockResolvedValue([]),
    };
    const service = new PlayersService(repo);
    const buffer = await workbookWithRows([
      rowData(),
      rowData({
        username: "player.one",
        phone: "01000000003",
        guardianPhone: "01000000004",
      }),
    ]);

    const result = await service.validatePlayerImport(buffer, actor);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          field: "username",
          message: expect.stringContaining("Also found in row 3"),
        }),
        expect.objectContaining({
          row: 3,
          field: "username",
          message: expect.stringContaining("Also found in row 2"),
        }),
      ]),
    );
    expect(
      result.errors.some((error) => error.field === "fullName"),
    ).toBe(false);
  });

  test("previews create, update, and skip actions by username", async () => {
    const existingOne = existingPlayer();
    const existingTwo = existingPlayer({
      id: "55555555-5555-4555-8555-555555555555",
      user_id: "66666666-6666-4666-8666-666666666666",
      username: "player.two",
      full_name: "Player Two",
      phone: "01000000003",
      guardian_phone: "01000000004",
    });
    const repo = {
      db: {},
      findBranchesForImport: jest.fn().mockResolvedValue([branch]),
      findBranchByIdAndAcademy: jest.fn().mockResolvedValue(branch),
      findExistingImportUsers: jest.fn().mockResolvedValue([
        {
          id: existingOne.user_id,
          username: existingOne.username,
          phone: existingOne.phone,
          role: "player",
          academy_id: academyId,
        },
        {
          id: existingTwo.user_id,
          username: existingTwo.username,
          phone: existingTwo.phone,
          role: "player",
          academy_id: academyId,
        },
      ]),
      findImportPlayersByUsernames: jest
        .fn()
        .mockResolvedValue([existingOne, existingTwo]),
    };
    const service = new PlayersService(repo);
    const buffer = await workbookWithRows([
      rowData({ password: null }),
      rowData({
        fullName: "Player Two",
        username: "player.two",
        password: null,
        phone: "01000000003",
        guardianPhone: "01000000004",
        weightKg: 44,
      }),
      rowData({
        fullName: "Player Three",
        username: "player.three",
        phone: "01000000005",
        guardianPhone: "01000000006",
      }),
    ]);

    const result = await service.validatePlayerImport(buffer, actor);

    expect(result).toMatchObject({
      valid: true,
      totalRows: 3,
      created: 1,
      updated: 1,
      skipped: 1,
      failed: 0,
    });
    expect(result.rows.map((row) => row.action)).toEqual([
      "skip",
      "update",
      "create",
    ]);
    expect(result.rows[1].data).toMatchObject({
      heightCm: 150,
      weightKg: 44,
    });
  });

  test("creates, updates, and skips inside one outer transaction", async () => {
    const transaction = {};
    const repo = {
      db: {
        transaction: jest.fn(async (callback) => callback(transaction)),
      },
      createImportLog: jest.fn().mockResolvedValue({ id: "log-1" }),
      updateImportLog: jest.fn().mockResolvedValue({ id: "log-1" }),
    };
    const service = new PlayersService(repo);
    const rows = [
      {
        rowNumber: 2,
        action: "create",
        data: { ...rowData(), branchId: branch.id },
        existingPlayer: null,
      },
      {
        rowNumber: 3,
        action: "update",
        data: { weightKg: 44, password: "ChangedPass1!" },
        existingPlayer: existingPlayer(),
      },
      {
        rowNumber: 4,
        action: "skip",
        data: {},
        existingPlayer: existingPlayer({
          id: "77777777-7777-4777-8777-777777777777",
        }),
      },
    ];
    jest.spyOn(service, "validatePlayerImport").mockResolvedValue({
      valid: true,
      totalRows: 3,
      created: 1,
      updated: 1,
      skipped: 1,
      failed: 0,
      status: "completed",
      errors: [],
      rows,
    });
    jest
      .spyOn(service, "createPlayer")
      .mockResolvedValue({ id: "player-1", player_code: "P1" });
    jest
      .spyOn(service, "updatePlayer")
      .mockResolvedValue({ id: rows[1].existingPlayer.id });
    jest.spyOn(service, "_publishPlayerCreated").mockImplementation(() => {});
    jest.spyOn(bcrypt, "hash").mockResolvedValue("password-hash");

    const result = await service.importPlayers(
      Buffer.from("xlsx"),
      "players.xlsx",
      actor,
    );

    expect(repo.db.transaction).toHaveBeenCalledTimes(1);
    expect(service.createPlayer).toHaveBeenCalledTimes(1);
    expect(service.updatePlayer).toHaveBeenCalledTimes(1);
    expect(service.updatePlayer).toHaveBeenCalledWith(
      rows[1].existingPlayer.id,
      academyId,
      rows[1].data,
      actor,
      expect.objectContaining({
        trx: transaction,
        passwordHash: "password-hash",
        publishEvent: false,
      }),
    );
    expect(repo.updateImportLog).toHaveBeenCalledWith(
      "log-1",
      expect.objectContaining({
        total_rows: 3,
        created_count: 1,
        updated_count: 1,
        skipped_count: 1,
        status: "completed",
      }),
      transaction,
    );
    expect(result).toMatchObject({
      totalRows: 3,
      created: 1,
      updated: 1,
      skipped: 1,
      failed: 0,
      status: "completed",
    });

    bcrypt.hash.mockRestore();
  });

  test("requires the current username before exporting full player data", async () => {
    const repo = {
      createImportLog: jest.fn().mockResolvedValue({ id: "log-1" }),
      updateImportLog: jest.fn().mockResolvedValue({ id: "log-1" }),
      findAuthUserById: jest.fn().mockResolvedValue({
        id: actor.userId,
        username: "admin.user",
      }),
    };
    const service = new PlayersService(repo);

    await expect(
      service.exportPlayers("full", "wrong.user", actor),
    ).rejects.toThrow("confirmation");
    expect(repo.updateImportLog).toHaveBeenLastCalledWith(
      "log-1",
      expect.objectContaining({
        status: "failed",
        failed_count: 1,
      }),
    );
  });
});
