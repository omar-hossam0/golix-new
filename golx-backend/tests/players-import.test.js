const ExcelJS = require("exceljs");
const {
  PLAYER_IMPORT_COLUMNS,
  buildPlayerImportTemplate,
  parsePlayerImportWorkbook,
} = require("../src/modules/players/players.import");

const branch = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Main Branch",
};

const validRow = {
  fullName: "Test Player",
  birthDate: "2012-05-10",
  heightCm: 150,
  weightKg: 42,
  preferredFoot: "Right",
  dateJoined: "2026-07-01",
  username: "test.player",
  password: "StrongPass1!",
  gender: "Male",
  nationality: "Egyptian",
  phone: "01000000001",
  address: "Cairo",
  branchId: branch.name,
  guardianName: "Test Guardian",
  guardianPhone: "01000000002",
  guardianRelation: "Father",
  isActive: "Active",
};

describe("player Excel imports", () => {
  test("builds a template that parses its user-facing values into system fields", async () => {
    const buffer = await buildPlayerImportTemplate([branch]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet("Players");

    PLAYER_IMPORT_COLUMNS.forEach((column, index) => {
      worksheet.getCell(2, index + 1).value = validRow[column.field];
    });

    const uploaded = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parsePlayerImportWorkbook(uploaded);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].data).toMatchObject({
      fullName: "Test Player",
      birthDate: "2012-05-10",
      heightCm: 150,
      preferredFoot: "right",
      gender: "male",
      guardianRelation: "father",
      isActive: true,
      branchId: branch.name,
    });
  });

  test("keeps passwords blank in full exports while preserving the import structure", async () => {
    const buffer = await buildPlayerImportTemplate([branch], {
      mode: "full",
      rows: [
        {
          ...validRow,
          branchId: branch.id,
          preferredFoot: "right",
          gender: "male",
          guardianRelation: "father",
          isActive: true,
          password: null,
        },
      ],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet("Players");
    const passwordColumn =
      PLAYER_IMPORT_COLUMNS.findIndex((column) => column.field === "password") +
      1;

    expect(worksheet.getRow(1).values.slice(1)).toEqual(
      PLAYER_IMPORT_COLUMNS.map((column) => column.header),
    );
    expect(worksheet.getCell(2, passwordColumn).value).toBeNull();

    const parsed = await parsePlayerImportWorkbook(buffer);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].data.password).toBeNull();
    expect(parsed.rows[0].data.branchId).toBe(branch.name);
  });

  test("reports missing template columns before reading player rows", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Players");
    worksheet.addRow(
      PLAYER_IMPORT_COLUMNS.filter((column) => column.field !== "phone").map(
        (column) => column.header,
      ),
    );

    const parsed = await parsePlayerImportWorkbook(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 1,
          column: "Phone Number",
          field: "phone",
          message: "Missing required column: Phone Number.",
        }),
      ]),
    );
  });

  test("reports invalid dates and dropdown values with row and column details", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Players");
    worksheet.addRow(PLAYER_IMPORT_COLUMNS.map((column) => column.header));
    worksheet.addRow(
      PLAYER_IMPORT_COLUMNS.map((column) => {
        if (column.field === "birthDate") return "2012-02-31";
        if (column.field === "gender") return "Unknown";
        return validRow[column.field];
      }),
    );

    const parsed = await parsePlayerImportWorkbook(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );

    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          column: "Birth Date",
          field: "birthDate",
          value: "2012-02-31",
        }),
        expect.objectContaining({
          row: 2,
          column: "Gender",
          field: "gender",
          value: "Unknown",
        }),
      ]),
    );
  });
});
