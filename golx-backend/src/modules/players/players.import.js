const ExcelJS = require("exceljs");

const MAX_IMPORT_ROWS = 5000;

const GUARDIAN_RELATIONS = [
  ["Father", "father"],
  ["Mother", "mother"],
  ["Paternal Uncle", "paternal_uncle"],
  ["Maternal Uncle", "maternal_uncle"],
  ["Paternal Aunt", "paternal_aunt"],
  ["Maternal Aunt", "maternal_aunt"],
  ["Grandfather", "grandfather"],
  ["Grandmother", "grandmother"],
  ["Older Brother", "older_brother"],
  ["Older Sister", "older_sister"],
  ["Guardian", "guardian"],
  ["Legal Guardian", "legal_guardian"],
  ["Other", "other"],
];

const PLAYER_IMPORT_COLUMNS = [
  {
    header: "Full Name",
    field: "fullName",
    type: "text",
    required: "always",
    width: 28,
  },
  {
    header: "Birth Date",
    field: "birthDate",
    type: "date",
    required: "always",
    width: 16,
  },
  {
    header: "Height (cm)",
    field: "heightCm",
    type: "number",
    required: "create",
    width: 14,
  },
  {
    header: "Weight (kg)",
    field: "weightKg",
    type: "number",
    required: "create",
    width: 14,
  },
  {
    header: "Preferred Foot",
    field: "preferredFoot",
    type: "enum",
    required: "create",
    values: [
      ["Right", "right"],
      ["Left", "left"],
      ["Both", "both"],
    ],
    width: 18,
  },
  {
    header: "Date Joined",
    field: "dateJoined",
    type: "date",
    required: "create",
    width: 16,
  },
  {
    header: "Username",
    field: "username",
    type: "text",
    required: "always",
    width: 20,
  },
  {
    header: "Password",
    field: "password",
    type: "text",
    required: "create",
    width: 22,
  },
  {
    header: "Gender",
    field: "gender",
    type: "enum",
    required: "create",
    values: [
      ["Male", "male"],
      ["Female", "female"],
      ["Other", "other"],
    ],
    width: 14,
  },
  {
    header: "Nationality",
    field: "nationality",
    type: "text",
    required: "create",
    width: 18,
  },
  {
    header: "Phone Number",
    field: "phone",
    type: "phone",
    required: "create",
    width: 20,
  },
  {
    header: "Address",
    field: "address",
    type: "text",
    required: "create",
    width: 30,
  },
  {
    header: "Branch",
    field: "branchId",
    type: "branch",
    required: "always",
    width: 32,
  },
  {
    header: "Guardian Name",
    field: "guardianName",
    type: "text",
    required: "create",
    width: 24,
  },
  {
    header: "Guardian Phone",
    field: "guardianPhone",
    type: "phone",
    required: "create",
    width: 20,
  },
  {
    header: "Guardian Relation",
    field: "guardianRelation",
    type: "enum",
    required: "create",
    values: GUARDIAN_RELATIONS,
    width: 22,
  },
  {
    header: "Status",
    field: "isActive",
    type: "enum",
    values: [
      ["Active", true],
      ["Inactive", false],
    ],
    width: 14,
  },
];

const COLUMN_BY_FIELD = new Map(
  PLAYER_IMPORT_COLUMNS.map((column) => [column.field, column]),
);

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeEnumValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const cellPrimitiveValue = (cell) => {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date || typeof value !== "object") return value;
  if (Object.prototype.hasOwnProperty.call(value, "result")) return value.result;
  if (Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text || "").join("");
  }
  return cell.text || "";
};

const displayValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return "";
  return String(value);
};

const formatDate = (date) =>
  [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");

const parseStrictDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Math.round((value - 25569) * 86400 * 1000);
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : formatDate(date);
  }

  const text = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return text;
};

const errorFor = (row, column, value, message) => ({
  row,
  column: column.header,
  field: column.field,
  value: column.field === "password" ? "[redacted]" : displayValue(value),
  message,
});

const parseColumnValue = (column, rawValue, rowNumber) => {
  const isBlank =
    rawValue === null ||
    rawValue === undefined ||
    (typeof rawValue === "string" && rawValue.trim() === "");

  if (isBlank && column.required === "always") {
    return {
      error: errorFor(
        rowNumber,
        column,
        rawValue,
        `${column.header} is required.`,
      ),
    };
  }
  if (isBlank) return { value: null };

  if (column.type === "date") {
    const date = parseStrictDate(rawValue);
    return date
      ? { value: date }
      : {
          error: errorFor(
            rowNumber,
            column,
            rawValue,
            "Use a real date in YYYY-MM-DD format.",
          ),
        };
  }

  if (column.type === "number") {
    const numericValue =
      typeof rawValue === "number"
        ? rawValue
        : Number(String(rawValue).trim());
    return Number.isFinite(numericValue)
      ? { value: numericValue }
      : {
          error: errorFor(
            rowNumber,
            column,
            rawValue,
            `${column.header} must be a number.`,
          ),
        };
  }

  if (column.type === "enum") {
    const normalized = normalizeEnumValue(rawValue);
    const match = column.values.find(
      ([label, internalValue]) =>
        normalizeEnumValue(label) === normalized ||
        normalizeEnumValue(internalValue) === normalized,
    );
    return match
      ? { value: match[1] }
      : {
          error: errorFor(
            rowNumber,
            column,
            rawValue,
            `Choose one of: ${column.values.map(([label]) => label).join(", ")}.`,
          ),
        };
  }

  if (
    !["string", "number", "boolean"].includes(typeof rawValue) &&
    !(rawValue instanceof Date)
  ) {
    return {
      error: errorFor(
        rowNumber,
        column,
        rawValue,
        `${column.header} must be plain text.`,
      ),
    };
  }

  const text = String(rawValue).trim();
  return text
    ? { value: text }
    : {
        error: errorFor(
          rowNumber,
          column,
          rawValue,
          `${column.header} is required.`,
        ),
      };
};

async function parsePlayerImportWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet =
    workbook.getWorksheet("Players") || workbook.worksheets[0] || null;

  if (!worksheet) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          column: "Worksheet",
          field: "worksheet",
          value: "",
          message: 'The workbook must contain a sheet named "Players".',
        },
      ],
    };
  }

  const expectedByHeader = new Map(
    PLAYER_IMPORT_COLUMNS.map((column) => [
      normalizeHeader(column.header),
      column,
    ]),
  );
  const indexesByField = new Map();
  const errors = [];
  const seenHeaders = new Set();

  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, columnIndex) => {
    const rawHeader = String(cellPrimitiveValue(cell) || "").trim();
    const normalized = normalizeHeader(rawHeader);
    const column = expectedByHeader.get(normalized);
    if (!column) {
      errors.push({
        row: 1,
        column: rawHeader || `Column ${columnIndex}`,
        field: "template",
        value: rawHeader,
        message: "This column is not part of the player import template.",
      });
      return;
    }
    if (seenHeaders.has(normalized)) {
      errors.push({
        row: 1,
        column: column.header,
        field: column.field,
        value: rawHeader,
        message: "This column appears more than once.",
      });
      return;
    }
    seenHeaders.add(normalized);
    indexesByField.set(column.field, columnIndex);
  });

  for (const column of PLAYER_IMPORT_COLUMNS) {
    if (!indexesByField.has(column.field)) {
      errors.push({
        row: 1,
        column: column.header,
        field: column.field,
        value: "",
        message: `Missing required column: ${column.header}.`,
      });
    }
  }

  if (errors.length) return { rows: [], errors };

  const rows = [];
  const lastRow = Math.min(worksheet.actualRowCount, MAX_IMPORT_ROWS + 1);
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const worksheetRow = worksheet.getRow(rowNumber);
    const rawValues = PLAYER_IMPORT_COLUMNS.map((column) =>
      cellPrimitiveValue(worksheetRow.getCell(indexesByField.get(column.field))),
    );
    const hasData = rawValues.some(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== "",
    );
    if (!hasData) continue;

    const data = {};
    rawValues.forEach((rawValue, index) => {
      const column = PLAYER_IMPORT_COLUMNS[index];
      const parsed = parseColumnValue(column, rawValue, rowNumber);
      if (parsed.error) errors.push(parsed.error);
      else data[column.field] = parsed.value;
    });
    rows.push({ rowNumber, data });
  }

  if (worksheet.actualRowCount > MAX_IMPORT_ROWS + 1) {
    errors.push({
      row: MAX_IMPORT_ROWS + 2,
      column: "Workbook",
      field: "rows",
      value: worksheet.actualRowCount - 1,
      message: `A maximum of ${MAX_IMPORT_ROWS} player rows can be imported at once.`,
    });
  }

  if (!rows.length && !errors.length) {
    errors.push({
      row: 2,
      column: "Workbook",
      field: "rows",
      value: "",
      message: "Add at least one player row before uploading the file.",
    });
  }

  return { rows, errors };
}

const worksheetValue = (column, value, branchById) => {
  if (value === null || value === undefined || value === "") return null;
  if (column.type === "enum") {
    const match = column.values.find(
      ([, internalValue]) => internalValue === value,
    );
    return match?.[0] || value;
  }
  if (column.type === "branch") {
    const branch = branchById.get(String(value));
    return branch ? `${branch.name} [${branch.id}]` : value;
  }
  return value;
};

const samplePlayerRows = (branches) => {
  const branchId = branches[0]?.id || "";
  return [
    {
      fullName: "Omar Hassan",
      birthDate: "2012-03-14",
      heightCm: 152,
      weightKg: 43,
      preferredFoot: "right",
      dateJoined: "2026-07-01",
      username: "sample.player01",
      password: "Goalix#2026",
      gender: "male",
      nationality: "Egyptian",
      phone: "01000001001",
      address: "Cairo",
      branchId,
      guardianName: "Hassan Ali",
      guardianPhone: "01000002001",
      guardianRelation: "father",
      isActive: true,
    },
    {
      fullName: "Lina Ahmed",
      birthDate: "2013-08-22",
      heightCm: 147,
      weightKg: 39,
      preferredFoot: "left",
      dateJoined: "2026-07-01",
      username: "sample.player02",
      password: "Goalix#2026",
      gender: "female",
      nationality: "Egyptian",
      phone: "01000001002",
      address: "Giza",
      branchId,
      guardianName: "Ahmed Mahmoud",
      guardianPhone: "01000002002",
      guardianRelation: "father",
      isActive: true,
    },
    {
      fullName: "Youssef Adel",
      birthDate: "2011-11-05",
      heightCm: 160,
      weightKg: 48,
      preferredFoot: "both",
      dateJoined: "2026-07-01",
      username: "sample.player03",
      password: "Goalix#2026",
      gender: "male",
      nationality: "Egyptian",
      phone: "01000001003",
      address: "Alexandria",
      branchId,
      guardianName: "Adel Samir",
      guardianPhone: "01000002003",
      guardianRelation: "father",
      isActive: true,
    },
  ];
};

async function buildPlayerImportTemplate(
  branches,
  { rows = [], mode = "empty" } = {},
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Goalix";
  workbook.created = new Date();

  const playersSheet = workbook.addWorksheet("Players", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const referenceSheet = workbook.addWorksheet("Reference Data");
  const instructionsSheet = workbook.addWorksheet("Instructions");

  playersSheet.columns = PLAYER_IMPORT_COLUMNS.map((column) => ({
    header: column.header,
    key: column.field,
    width: column.width,
    style: { alignment: { vertical: "middle" } },
  }));
  playersSheet.autoFilter = {
    from: "A1",
    to: `${playersSheet.getColumn(PLAYER_IMPORT_COLUMNS.length).letter}1`,
  };
  playersSheet.getRow(1).height = 28;
  playersSheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF166534" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  rows.forEach((row) => {
    playersSheet.addRow(
      Object.fromEntries(
        PLAYER_IMPORT_COLUMNS.map((column) => [
          column.field,
          worksheetValue(column, row[column.field], branchById),
        ]),
      ),
    );
  });

  const branchLabels = branches.map(
    (branch) => `${branch.name} [${branch.id}]`,
  );
  referenceSheet.columns = [
    { header: "Branches", key: "branches", width: 42 },
    { header: "Gender", key: "gender", width: 18 },
    { header: "Preferred Foot", key: "preferredFoot", width: 18 },
    { header: "Guardian Relation", key: "guardianRelation", width: 24 },
    { header: "Status", key: "status", width: 16 },
  ];
  const referenceLength = Math.max(
    branchLabels.length,
    3,
    GUARDIAN_RELATIONS.length,
  );
  for (let index = 0; index < referenceLength; index += 1) {
    referenceSheet.addRow({
      branches: branchLabels[index] || null,
      gender: ["Male", "Female", "Other"][index] || null,
      preferredFoot: ["Right", "Left", "Both"][index] || null,
      guardianRelation: GUARDIAN_RELATIONS[index]?.[0] || null,
      status: ["Active", "Inactive"][index] || null,
    });
  }
  referenceSheet.getRow(1).font = { bold: true };
  referenceSheet.views = [{ state: "frozen", ySplit: 1 }];

  const branchColumn = COLUMN_BY_FIELD.get("branchId");
  const validationRanges = {
    branchId: branchLabels.length
      ? `'Reference Data'!$A$2:$A$${branchLabels.length + 1}`
      : null,
    gender: "'Reference Data'!$B$2:$B$4",
    preferredFoot: "'Reference Data'!$C$2:$C$4",
    guardianRelation: `'Reference Data'!$D$2:$D$${GUARDIAN_RELATIONS.length + 1}`,
    isActive: "'Reference Data'!$E$2:$E$3",
  };

  for (let rowNumber = 2; rowNumber <= MAX_IMPORT_ROWS + 1; rowNumber += 1) {
    for (const column of PLAYER_IMPORT_COLUMNS) {
      const cell = playersSheet.getCell(
        rowNumber,
        PLAYER_IMPORT_COLUMNS.indexOf(column) + 1,
      );
      if (column.type === "date") {
        cell.numFmt = "yyyy-mm-dd";
        cell.dataValidation = {
          type: "date",
          operator: "between",
          allowBlank: column.required !== "always",
          formulae: [new Date("1900-01-01"), new Date("2100-12-31")],
          showErrorMessage: true,
          errorTitle: "Invalid date",
          error: "Enter a real date using YYYY-MM-DD.",
        };
      } else if (column.type === "number") {
        cell.numFmt = "0.00";
        cell.dataValidation = {
          type: "decimal",
          operator: "greaterThan",
          allowBlank: column.required !== "always",
          formulae: [0],
          showErrorMessage: true,
          errorTitle: "Invalid number",
          error: "Enter a positive number.",
        };
      } else if (validationRanges[column.field]) {
        cell.dataValidation = {
          type: "list",
          allowBlank: column.required !== "always",
          formulae: [validationRanges[column.field]],
          showErrorMessage: true,
          errorTitle: "Invalid selection",
          error: "Choose a value from the dropdown list.",
        };
      }
      if (["phone", "text", "branch"].includes(column.type)) {
        cell.numFmt = "@";
      }
    }
  }

  if (!branchLabels.length) {
    const branchIndex = PLAYER_IMPORT_COLUMNS.indexOf(branchColumn) + 1;
    playersSheet.getCell(2, branchIndex).note =
      "No accessible branches were found. Ask an administrator to configure branch access before importing.";
  }

  instructionsSheet.columns = [
    { header: "Player Import Instructions", width: 95 },
  ];
  [
    "Use the Players sheet only. Do not rename, remove, duplicate, or add columns.",
    mode === "full"
      ? "This file contains the players visible to your account. Password cells are intentionally blank."
      : mode === "sample"
        ? "The sample rows are tutorials. Delete them before adding your real players."
        : "Add player rows below the header. Do not change the column structure.",
    "New players must include every manual creation field and a valid password. Existing players may leave Password blank to keep it unchanged.",
    "Use the dropdown values supplied by the template for branch, gender, preferred foot, guardian relation, and status.",
    "Dates must be real dates displayed as YYYY-MM-DD.",
    "Username is the unique matching key. Player names are not used to detect duplicates.",
    "The whole file is validated first. If any row has an error, no player is created or updated.",
    `Maximum rows per file: ${MAX_IMPORT_ROWS}.`,
    "Passwords are sensitive. Keep the completed workbook secure and delete it after a successful import.",
  ].forEach((instruction) => instructionsSheet.addRow([instruction]));
  instructionsSheet.getRow(1).font = {
    bold: true,
    size: 14,
    color: { argb: "FFFFFFFF" },
  };
  instructionsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF166534" },
  };
  instructionsSheet.getColumn(1).alignment = {
    vertical: "top",
    wrapText: true,
  };
  instructionsSheet.eachRow((row, index) => {
    row.height = index === 1 ? 28 : 32;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = {
  COLUMN_BY_FIELD,
  MAX_IMPORT_ROWS,
  PLAYER_IMPORT_COLUMNS,
  buildPlayerImportTemplate,
  parsePlayerImportWorkbook,
  samplePlayerRows,
};
