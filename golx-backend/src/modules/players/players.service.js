const eventBus = require("../../events/eventBus");
const PLAYERS_EVENTS = require("./players.events");
const {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} = require("../../shared/errors");
const bcrypt = require("bcrypt");
const env = require("../../config/env");
const { ensureIamForAuthUser } = require("../../shared/iam-sync");
const { auditAccessDenied } = require("../../shared/access-audit");
const { canAccessPlayerRecord } = require("../../shared/access-policy");
const {
  createPlayerSchema,
  updatePlayerSchema,
} = require("./players.schema");
const {
  COLUMN_BY_FIELD,
  PLAYER_IMPORT_COLUMNS,
  buildPlayerImportTemplate,
  parsePlayerImportWorkbook,
  samplePlayerRows,
} = require("./players.import");

const technicalSkillMap = {
  ballControl: "ball_control",
  firstTouch: "first_touch",
  passing: "passing",
  shooting: "shooting",
  dribbling: "dribbling",
  crossing: "crossing",
  heading: "heading",
  tackling: "tackling",
  weakFoot: "weak_foot",
  finishing: "finishing",
  longPassing: "long_passing",
  shortPassing: "short_passing",
};

const tacticalSkillMap = {
  positioning: "positioning",
  decisionMaking: "decision_making",
  offBallMovement: "off_ball_movement",
  pressing: "pressing",
  defensiveAwareness: "defensive_awareness",
  teamwork: "teamwork",
  gameReading: "game_reading",
  trackingBack: "tracking_back",
  creatingSpace: "creating_space",
  tacticalDiscipline: "tactical_discipline",
};

const physicalMap = {
  bmi: "bmi",
  sprintSpeed: "sprint_speed",
  stamina: "stamina",
  flexibility: "flexibility",
};

const trainingMap = {
  trainingSessionsCount: "training_sessions_count",
  attendanceCount: "attendance_count",
  absenceCount: "absence_count",
  lateArrivals: "late_arrivals",
  attendanceRate: "attendance_rate",
  trainingPerformanceRating: "training_performance_rating",
  coachNotes: "coach_notes",
  improvementNotes: "improvement_notes",
};

const matchSummaryMap = {
  matchesPlayed: "matches_played",
  minutesPlayed: "minutes_played",
  goals: "goals",
  assists: "assists",
  shots: "shots",
  shotsOnTarget: "shots_on_target",
  passAccuracy: "pass_accuracy",
  keyPasses: "key_passes",
  successfulDribbles: "successful_dribbles",
  tackles: "tackles",
  interceptions: "interceptions",
  fouls: "fouls",
  yellowCards: "yellow_cards",
  redCards: "red_cards",
  manOfTheMatchCount: "man_of_the_match_count",
  matchRating: "match_rating",
};

const healthMap = {
  medicalNotes: "medical_notes",
  injuryHistory: "injury_history",
  currentInjuryStatus: "current_injury_status",
  injuryType: "injury_type",
  injuryDate: "injury_date",
  recoveryDate: "recovery_date",
  fitnessStatus: "fitness_status",
  allergies: "allergies",
  chronicProblems: "chronic_problems",
};

const hasAnyValue = (data, fields) =>
  fields.some(
    (field) =>
      data[field] !== undefined && data[field] !== null && data[field] !== "",
  );

const pickMapped = (data, map) =>
  Object.entries(map).reduce((acc, [inputKey, dbKey]) => {
    if (
      data[inputKey] !== undefined &&
      data[inputKey] !== null &&
      data[inputKey] !== ""
    ) {
      acc[dbKey] = data[inputKey];
    }
    return acc;
  }, {});

const calculateBmi = (heightCm, weightKg) => {
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
};

const addPlanPeriod = (date, plan = "monthly") => {
  const next = new Date(date);
  const months = plan === "yearly" ? 12 : plan === "quarterly" ? 3 : 1;
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
};

const normalizeImportPhone = (value) =>
  String(value || "")
    .trim()
    .replace(/[\s()-]+/g, "");

const importDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const existingImportValue = (player, field) => {
  const values = {
    fullName: player.full_name,
    birthDate: importDateValue(player.date_of_birth),
    heightCm:
      player.height_cm === null || player.height_cm === undefined
        ? null
        : Number(player.height_cm),
    weightKg:
      player.weight_kg === null || player.weight_kg === undefined
        ? null
        : Number(player.weight_kg),
    preferredFoot: player.preferred_foot,
    dateJoined: importDateValue(player.date_joined),
    username: player.username,
    password: null,
    gender: player.gender,
    nationality: player.nationality,
    phone: player.phone,
    address: player.address,
    branchId: player.branch_id,
    guardianName: player.guardian_name,
    guardianPhone: player.guardian_phone,
    guardianRelation: player.guardian_relation,
    isActive: Boolean(player.is_active),
  };
  return values[field] ?? null;
};

const importValuesEqual = (field, left, right) => {
  if (["heightCm", "weightKg"].includes(field)) {
    if (left === null || left === undefined || left === "") {
      return right === null || right === undefined || right === "";
    }
    return Number(left) === Number(right);
  }
  if (field === "isActive") return Boolean(left) === Boolean(right);
  if (["birthDate", "dateJoined"].includes(field)) {
    return importDateValue(left) === importDateValue(right);
  }
  return String(left ?? "").trim() === String(right ?? "").trim();
};

const exportPlayerRow = (player) =>
  Object.fromEntries(
    PLAYER_IMPORT_COLUMNS.map((column) => [
      column.field,
      column.field === "password"
        ? null
        : existingImportValue(player, column.field),
    ]),
  );

const errorForImportRow = (row, field, message) => ({
  row: row.rowNumber,
  column: COLUMN_BY_FIELD.get(field)?.header || field,
  field,
  value: field === "password" ? "[redacted]" : row.data[field] ?? "",
  message,
});

class PlayersService {
  constructor(playersRepository) {
    this.repo = playersRepository;
  }

  async _scopeFiltersForUser(user, filters = {}) {
    if (user.role === "admin") return { academyId: user.academyId, ...filters };
    if (user.role === "coach") {
      const coach = await this.repo.findCoachProfileByUserId(user.userId);
      if (!coach)
        throw new ForbiddenError("Coach profile is not linked to this user");
      return { academyId: user.academyId, coachId: coach.id, ...filters };
    }
    if (user.role === "player")
      return {
        academyId: user.academyId,
        playerUserId: user.userId,
        ...filters,
      };
    if (user.role === "parent")
      return {
        academyId: user.academyId,
        ...filters,
        linkedPlayerIds: (await this.repo.findChildrenByParent(user.userId)).map(
          (child) => child.id,
        ),
      };
    throw new ForbiddenError("Unsupported role");
  }

  async _assertPlayerAccess(user, player, { write = false } = {}) {
    if (user.academyId && player.academy_id !== user.academyId)
      throw new NotFoundError("Player", player.id);
    if (canAccessPlayerRecord(user, player, { write })) return;
    if (user.role === "parent" && !write) {
      const parentCanAccess = await this.repo.isParentOfPlayer(
        user.userId,
        player.id,
      );
      if (canAccessPlayerRecord(user, player, { write, parentCanAccess }))
        return;
    }
    if (user.role === "coach") {
      const coach = await this.repo.findCoachProfileByUserId(user.userId);
      const coachCanAccess = coach
        ? await this.repo.coachCanAccessPlayer(coach.id, player.id)
        : false;
      if (canAccessPlayerRecord(user, player, { write, coachCanAccess }))
        return;
    }
    await auditAccessDenied(this.repo.db, user, {
      action: "player_access_denied",
      entityType: "player_profiles",
      entityId: player.id,
      reason: write ? "write_policy_denied" : "read_policy_denied",
    });
    throw new ForbiddenError("You cannot access this player");
  }

  async listPlayers(user, filters) {
    return this.repo.findPlayers(
      await this._scopeFiltersForUser(user, filters),
    );
  }

  async getPlayer(id, user) {
    const player = await this.repo.findById(id);
    if (!player) throw new NotFoundError("Player", id);
    await this._assertPlayerAccess(user, player);
    return player;
  }

  async getPlayerSummary(id, user) {
    const player = await this.repo.findPlayerSummary(id);
    if (!player) throw new NotFoundError("Player", id);
    await this._assertPlayerAccess(user, player);
    return player;
  }

  async _validatePlayerCreation(
    academyId,
    data,
    actor = {},
    db = this.repo.db,
    { checkCredentials = true } = {},
  ) {
    const branch = await this.repo.findBranchByIdAndAcademy(
      data.branchId,
      academyId,
      db,
    );
    if (!branch) throw new NotFoundError("Branch", data.branchId);

    const targetGroupId = data.groupId || null;
    const coachProfile =
      actor.role === "coach"
        ? await this.repo.findCoachProfileByUserId(actor.userId, db)
        : null;
    const playerBirthYear = data.birthDate
      ? new Date(`${data.birthDate}T00:00:00.000Z`).getUTCFullYear()
      : null;

    if (actor.role === "coach") {
      if (!coachProfile)
        throw new ForbiddenError("Coach profile is not linked to this user");
      if (!Number.isInteger(playerBirthYear)) {
        throw new BadRequestError("A valid player birth date is required");
      }
      const accessibleBirthYear =
        await this.repo.findCoachBirthYearAccessForDate(
          coachProfile.id,
          data.branchId,
          playerBirthYear,
          db,
        );
      if (!accessibleBirthYear) {
        throw new ForbiddenError(
          "Your coach account does not have access to this player birth year",
        );
      }
    }

    if (targetGroupId) {
      const group = await this.repo.findGroupByIdAndBranch(
        targetGroupId,
        data.branchId,
        db,
      );
      if (!group) throw new NotFoundError("Group", data.groupId);
      if (
        actor.role === "coach" &&
        !(await this.repo.coachCanAccessGroup(
          coachProfile.id,
          targetGroupId,
          db,
        ))
      ) {
        throw new ForbiddenError(
          "Your coach account cannot assign players to this group",
        );
      }
    }

    const normalizedUsername = data.username
      ? data.username.trim().toLowerCase()
      : null;
    const authPhone = data.phone || data.guardianPhone || null;
    if (checkCredentials && normalizedUsername) {
      const existing = await this.repo.findAuthUserByCredentials(
        {
          username: normalizedUsername,
          phone: authPhone,
        },
        db,
      );
      if (existing) {
        throw new ConflictError(
          "User with this username or phone already exists",
        );
      }
    }

    return {
      authPhone,
      branch,
      coachProfile,
      normalizedUsername,
      playerBirthYear,
      profileCompleteOnCreate: data.markProfileComplete === true,
      targetGroupId,
    };
  }

  _publishPlayerCreated(player, academyId, branchId, groupId) {
    eventBus.publish(PLAYERS_EVENTS.CREATED, {
      playerId: player.id,
      playerCode: player.player_code,
      academyId,
      branchId,
      groupId,
    });
  }

  async createPlayer(academyId, data, actor = {}, options = {}) {
    const passwordHash =
      options.passwordHash !== undefined
        ? options.passwordHash
        : data.password
          ? await bcrypt.hash(data.password, env.BCRYPT_ROUNDS)
          : null;

    const createWithinTransaction = async (trx) => {
      const context = await this._validatePlayerCreation(
        academyId,
        data,
        actor,
        trx,
      );
      let targetGroupId = context.targetGroupId;
      let userId = data.userId || null;

      if (
        context.profileCompleteOnCreate &&
        !targetGroupId &&
        data.birthDate
      ) {
        const autoGroup = Number.isInteger(context.playerBirthYear)
          ? actor.role === "coach"
            ? await this.repo.findCoachAutoAssignableGroup(
                context.coachProfile.id,
                data.branchId,
                context.playerBirthYear,
                trx,
              )
            : await this.repo.findAutoAssignableGroup(
                data.branchId,
                context.playerBirthYear,
                trx,
              )
          : null;
        targetGroupId = autoGroup?.id || null;
      }

      if (context.normalizedUsername && passwordHash) {
        const [user] = await trx("auth_users")
          .insert({
            username: context.normalizedUsername,
            email: null,
            phone: context.authPhone,
            password_hash: passwordHash,
            role: "player",
            academy_id: academyId,
            branch_id: data.branchId,
            is_active: data.isActive ?? true,
            is_verified: true,
          })
          .returning("*");

        await ensureIamForAuthUser(trx, user, {
          fullName: data.fullName,
          grantedBy: actor.userId || null,
        });
        userId = user.id;
      }

      const playerCode = await this.repo.generatePlayerCode(
        data.birthDate,
        trx,
      );
      const [player] = await trx("player_profiles")
        .insert({
          academy_id: academyId,
          branch_id: data.branchId,
          user_id: userId,
          full_name: data.fullName,
          date_of_birth: data.birthDate,
          date_joined: data.dateJoined || new Date().toISOString().slice(0, 10),
          player_code: playerCode,
          gender: data.gender || null,
          phone: data.phone || null,
          address: data.address || null,
          nationality: data.nationality || null,
          level: data.level || null,
          position: data.position || null,
          preferred_foot: data.preferredFoot || null,
          guardian_name: data.guardianName || null,
          guardian_phone: data.guardianPhone || null,
          guardian_relation: data.guardianRelation || null,
          notes: data.notes || null,
          is_active: data.isActive ?? true,
          ...(context.profileCompleteOnCreate
            ? {
                profile_status: "complete",
                profile_completed_at: new Date(),
              }
            : {}),
        })
        .returning("*");

      if (context.profileCompleteOnCreate && targetGroupId) {
        await trx("player_group_assignments").insert({
          player_id: player.id,
          group_id: targetGroupId,
          joined_at: data.dateJoined ? new Date(data.dateJoined) : new Date(),
        });
      }

      await this._saveExtendedPlayerData(
        trx,
        player,
        { ...data, groupId: targetGroupId },
        actor,
        context.coachProfile,
      );

      return { player, targetGroupId };
    };

    const result = options.trx
      ? await createWithinTransaction(options.trx)
      : await this.repo.db.transaction(createWithinTransaction);
    const shouldPublishEvent =
      options.publishEvent !== undefined
        ? options.publishEvent
        : !options.trx;
    if (shouldPublishEvent) {
      this._publishPlayerCreated(
        result.player,
        academyId,
        data.branchId,
        result.targetGroupId,
      );
    }
    return result.player;
  }

  async _getPlayerImportBranches(actor) {
    const coachProfile =
      actor.role === "coach"
        ? await this.repo.findCoachProfileByUserId(actor.userId)
        : null;
    if (actor.role === "coach" && !coachProfile) {
      throw new ForbiddenError("Coach profile is not linked to this user");
    }
    return this.repo.findBranchesForImport(
      actor.academyId,
      coachProfile?.id || null,
    );
  }

  async buildPlayerImportTemplate(actor, mode = "empty") {
    const branches = await this._getPlayerImportBranches(actor);
    const rows = mode === "sample" ? samplePlayerRows(branches) : [];
    return buildPlayerImportTemplate(branches, { rows, mode });
  }

  async _createPlayerOperationLog(actionType, fileName, actor) {
    return this.repo.createImportLog({
      academy_id: actor.academyId,
      uploaded_by_user_id: actor.userId || null,
      file_name: String(fileName || "players.xlsx").slice(0, 255),
      action_type: actionType,
      total_rows: 0,
      imported_rows: 0,
      created_count: 0,
      updated_count: 0,
      skipped_count: 0,
      failed_count: 0,
      status: "pending",
      error_details: null,
      completed_at: null,
    });
  }

  async exportPlayers(mode, confirmation, actor) {
    if (!["full", "sample", "empty"].includes(mode)) {
      throw new BadRequestError(
        "Export mode must be full, sample, or empty.",
      );
    }

    const fileName = `goalix-players-${mode}.xlsx`;
    const log = await this._createPlayerOperationLog(
      `export_${mode}`,
      fileName,
      actor,
    );

    try {
      await this.repo.updateImportLog(log.id, { status: "processing" });
      if (mode === "full") {
        const currentUser = await this.repo.findAuthUserById(actor.userId);
        const confirmationIdentity =
          currentUser?.username || currentUser?.email || "";
        if (
          !confirmationIdentity ||
          String(confirmation || "").trim().toLowerCase() !==
            confirmationIdentity.trim().toLowerCase()
        ) {
          throw new ForbiddenError(
            "The confirmation does not match your account username or email.",
          );
        }
      }

      const coachProfile =
        actor.role === "coach"
          ? await this.repo.findCoachProfileByUserId(actor.userId)
          : null;
      if (actor.role === "coach" && !coachProfile) {
        throw new ForbiddenError("Coach profile is not linked to this user");
      }
      const branches = await this._getPlayerImportBranches(actor);
      const rows =
        mode === "full"
          ? (
              await this.repo.findPlayersForExport(
                actor.academyId,
                coachProfile?.id || null,
              )
            ).map(exportPlayerRow)
          : mode === "sample"
            ? samplePlayerRows(branches)
            : [];
      const buffer = await buildPlayerImportTemplate(branches, { rows, mode });

      await this.repo.updateImportLog(log.id, {
        total_rows: rows.length,
        status: "completed",
        completed_at: new Date(),
      });
      return { buffer, fileName, totalRows: rows.length, logId: log.id };
    } catch (error) {
      await this.repo.updateImportLog(log.id, {
        status: "failed",
        failed_count: 1,
        error_details: [{ message: error.message || "Player export failed." }],
        completed_at: new Date(),
      });
      throw error;
    }
  }

  async validatePlayerImport(buffer, actor) {
    let parsed;
    try {
      parsed = await parsePlayerImportWorkbook(buffer);
    } catch {
      throw new BadRequestError(
        "The uploaded file is not a readable Goalix Excel workbook.",
      );
    }

    const errors = [...parsed.errors];
    const errorKeys = new Set(
      errors.map(
        (error) => `${error.row}|${error.field}|${error.message}`,
      ),
    );
    const addError = (error) => {
      const key = `${error.row}|${error.field}|${error.message}`;
      if (errorKeys.has(key)) return;
      errorKeys.add(key);
      errors.push(error);
    };
    const valueForError = (field, value) =>
      field === "password" ? "[redacted]" : value ?? "";
    const columnForField = (field) =>
      COLUMN_BY_FIELD.get(field)?.header || field || "Workbook";

    const branches = await this._getPlayerImportBranches(actor);
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    const branchByLabel = new Map(
      branches.map((branch) => [
        `${branch.name} [${branch.id}]`.toLowerCase(),
        branch,
      ]),
    );
    const branchesByName = new Map();
    for (const branch of branches) {
      const key = branch.name.trim().toLowerCase();
      const matches = branchesByName.get(key) || [];
      matches.push(branch);
      branchesByName.set(key, matches);
    }

    const usernames = [
      ...new Set(
        parsed.rows
          .map((row) =>
            String(row.data.username || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];
    const phones = [
      ...new Set(
        parsed.rows
          .map((row) => normalizeImportPhone(row.data.phone))
          .filter(Boolean),
      ),
    ];
    const coachProfile =
      actor.role === "coach"
        ? await this.repo.findCoachProfileByUserId(actor.userId)
        : null;
    const [existingUsers, existingPlayers] = await Promise.all([
      this.repo.findExistingImportUsers(usernames, phones),
      this.repo.findImportPlayersByUsernames(
        actor.academyId,
        usernames,
        coachProfile?.id || null,
      ),
    ]);
    const userByUsername = new Map(
      existingUsers
        .filter((user) => user.username)
        .map((user) => [user.username.trim().toLowerCase(), user]),
    );
    const userByPhone = new Map(
      existingUsers
        .filter((user) => normalizeImportPhone(user.phone))
        .map((user) => [normalizeImportPhone(user.phone), user]),
    );
    const playerByUsername = new Map(
      existingPlayers.map((player) => [
        player.username.trim().toLowerCase(),
        player,
      ]),
    );

    const duplicateFields = [
      {
        field: "username",
        normalize: (row) =>
          String(row.data.username || "")
            .trim()
            .toLowerCase(),
        message: "Duplicate username found in the uploaded Excel file.",
      },
      {
        field: "phone",
        normalize: (row) => normalizeImportPhone(row.data.phone),
        message: "Duplicate phone number found in the uploaded Excel file.",
      },
    ];
    for (const duplicateField of duplicateFields) {
      const groupedRows = new Map();
      for (const row of parsed.rows) {
        const key = duplicateField.normalize(row);
        if (!key) continue;
        const matches = groupedRows.get(key) || [];
        matches.push(row);
        groupedRows.set(key, matches);
      }
      for (const matches of groupedRows.values()) {
        if (matches.length < 2) continue;
        const allRows = matches.map((match) => match.rowNumber);
        for (const row of matches) {
          const otherRows = allRows.filter(
            (rowNumber) => rowNumber !== row.rowNumber,
          );
          addError({
            row: row.rowNumber,
            column: columnForField(duplicateField.field),
            field: duplicateField.field,
            value: valueForError(
              duplicateField.field,
              row.data[duplicateField.field],
            ),
            message: `${duplicateField.message} Also found in row${otherRows.length === 1 ? "" : "s"} ${otherRows.join(", ")}.`,
          });
        }
      }
    }

    const validRows = [];
    for (const row of parsed.rows) {
      const rowHadExistingErrors = errors.some(
        (error) => error.row === row.rowNumber,
      );
      const rowErrorCount = errors.length;
      const suppliedBranch = String(row.data.branchId || "").trim();
      const branch =
        branchById.get(suppliedBranch) ||
        branchByLabel.get(suppliedBranch.toLowerCase()) ||
        (branchesByName.get(suppliedBranch.toLowerCase())?.length === 1
          ? branchesByName.get(suppliedBranch.toLowerCase())[0]
          : null);

      if (!branch) {
        addError({
          row: row.rowNumber,
          column: "Branch",
          field: "branchId",
          value: suppliedBranch,
          message:
            "Choose an accessible branch from the template dropdown list.",
        });
      } else {
        row.data.branchId = branch.id;
      }

      const username = String(row.data.username || "")
        .trim()
        .toLowerCase();
      const existingUser = userByUsername.get(username) || null;
      const existingPlayer = playerByUsername.get(username) || null;
      if (existingUser && !existingPlayer) {
        addError({
          row: row.rowNumber,
          column: "Username",
          field: "username",
          value: row.data.username,
          message:
            "This username belongs to an account that cannot be updated as a player in your scope.",
        });
      }

      const phoneOwner = userByPhone.get(normalizeImportPhone(row.data.phone));
      if (phoneOwner && phoneOwner.id !== existingUser?.id) {
        addError({
          row: row.rowNumber,
          column: "Phone Number",
          field: "phone",
          value: row.data.phone,
          message: "This phone number already belongs to another account.",
        });
      }

      if (!existingPlayer) {
        for (const column of PLAYER_IMPORT_COLUMNS) {
          if (
            column.required === "create" &&
            (row.data[column.field] === null ||
              row.data[column.field] === undefined ||
              row.data[column.field] === "")
          ) {
            addError(
              errorForImportRow(
                row,
                column.field,
                `${column.header} is required for a new player.`,
              ),
            );
          }
        }
      } else {
        for (const column of PLAYER_IMPORT_COLUMNS) {
          if (
            column.required === "create" &&
            column.field !== "password" &&
            (row.data[column.field] === null ||
              row.data[column.field] === undefined ||
              row.data[column.field] === "") &&
            existingImportValue(existingPlayer, column.field) !== null
          ) {
            addError(
              errorForImportRow(
                row,
                column.field,
                `${column.header} cannot be blank for an existing player.`,
              ),
            );
          }
        }
      }

      const candidateData = Object.fromEntries(
        Object.entries(row.data).filter(
          ([, value]) => value !== null && value !== undefined,
        ),
      );
      let action = "create";
      let actionData = candidateData;
      if (existingPlayer) {
        actionData = {};
        for (const column of PLAYER_IMPORT_COLUMNS) {
          if (["username", "password"].includes(column.field)) continue;
          const nextValue = row.data[column.field];
          if (nextValue === null || nextValue === undefined) continue;
          if (
            !importValuesEqual(
              column.field,
              nextValue,
              existingImportValue(existingPlayer, column.field),
            )
          ) {
            actionData[column.field] = nextValue;
          }
        }
        if (row.data.password) actionData.password = row.data.password;
        if (
          actionData.heightCm !== undefined ||
          actionData.weightKg !== undefined
        ) {
          actionData.heightCm = row.data.heightCm;
          actionData.weightKg = row.data.weightKg;
        }
        action = Object.keys(actionData).length ? "update" : "skip";
      }

      const schemaResult = existingPlayer
        ? updatePlayerSchema.safeParse(actionData)
        : createPlayerSchema.safeParse(candidateData);
      if (!schemaResult.success) {
        for (const issue of schemaResult.error.issues) {
          const field = String(issue.path[0] || "row");
          addError({
            row: row.rowNumber,
            column: columnForField(field),
            field,
            value: valueForError(field, actionData[field] ?? row.data[field]),
            message: issue.message,
          });
        }
      }

      if (
        rowHadExistingErrors ||
        errors.length !== rowErrorCount ||
        !schemaResult.success
      ) {
        continue;
      }

      try {
        await this._validatePlayerCreation(
          actor.academyId,
          existingPlayer
            ? Object.fromEntries(
                PLAYER_IMPORT_COLUMNS.filter(
                  (column) =>
                    !["username", "password", "isActive"].includes(
                      column.field,
                    ),
                ).map((column) => [
                  column.field,
                  row.data[column.field] ??
                    existingImportValue(existingPlayer, column.field),
                ]),
              )
            : schemaResult.data,
          actor,
          this.repo.db,
          { checkCredentials: false },
        );
        validRows.push({
          rowNumber: row.rowNumber,
          action,
          data: schemaResult.data,
          existingPlayer,
        });
      } catch (error) {
        const message = error.message || "Player data is not valid.";
        const field =
          message.toLowerCase().includes("birth year")
            ? "birthDate"
            : message.toLowerCase().includes("branch")
              ? "branchId"
              : message.toLowerCase().includes("group")
                ? "groupId"
                : "row";
        addError({
          row: row.rowNumber,
          column: columnForField(field),
          field,
          value: valueForError(field, schemaResult.data[field]),
          message,
        });
      }
    }

    errors.sort((left, right) => {
      const rowDifference = Number(left.row || 0) - Number(right.row || 0);
      return rowDifference || left.column.localeCompare(right.column);
    });

    const actionCounts = validRows.reduce(
      (counts, row) => {
        counts[row.action] += 1;
        return counts;
      },
      { create: 0, update: 0, skip: 0 },
    );
    return {
      valid: errors.length === 0,
      totalRows: parsed.rows.length,
      created: actionCounts.create,
      updated: actionCounts.update,
      skipped: actionCounts.skip,
      failed: new Set(errors.map((error) => error.row).filter(Boolean)).size,
      status: errors.length ? "failed" : "completed",
      errors,
      rows: validRows,
    };
  }

  async validatePlayerImportWithLog(buffer, fileName, actor) {
    const log = await this._createPlayerOperationLog(
      "import_validate",
      fileName,
      actor,
    );
    try {
      await this.repo.updateImportLog(log.id, { status: "processing" });
      const validation = await this.validatePlayerImport(buffer, actor);
      await this.repo.updateImportLog(log.id, {
        total_rows: validation.totalRows,
        created_count: validation.created,
        updated_count: validation.updated,
        skipped_count: validation.skipped,
        failed_count: validation.failed,
        status: validation.valid ? "completed" : "failed",
        error_details: validation.valid ? null : validation.errors,
        completed_at: new Date(),
      });
      return { ...validation, logId: log.id };
    } catch (error) {
      await this.repo.updateImportLog(log.id, {
        status: "failed",
        failed_count: 1,
        error_details: [{ message: error.message || "Validation failed." }],
        completed_at: new Date(),
      });
      throw error;
    }
  }

  async importPlayers(buffer, fileName, actor) {
    const importLog = await this._createPlayerOperationLog(
      "import_process",
      fileName,
      actor,
    );

    try {
      await this.repo.updateImportLog(importLog.id, { status: "processing" });
      const validation = await this.validatePlayerImport(buffer, actor);
      if (!validation.valid) {
        await this.repo.updateImportLog(importLog.id, {
          total_rows: validation.totalRows,
          imported_rows: 0,
          created_count: 0,
          updated_count: 0,
          skipped_count: 0,
          failed_count: validation.failed,
          status: "failed",
          error_details: validation.errors,
          completed_at: new Date(),
        });
        return { ...validation, logId: importLog.id };
      }

      const passwordHashes = new Map();
      const passwordRows = validation.rows.filter(
        (row) => row.data.password,
      );
      for (let index = 0; index < passwordRows.length; index += 4) {
        const batch = passwordRows.slice(index, index + 4);
        const hashes = await Promise.all(
          batch.map((row) =>
            bcrypt.hash(row.data.password, env.BCRYPT_ROUNDS),
          ),
        );
        batch.forEach((row, batchIndex) => {
          passwordHashes.set(row.rowNumber, hashes[batchIndex]);
        });
      }

      const processedRows = await this.repo.db.transaction(async (trx) => {
        const processed = [];
        for (const row of validation.rows) {
          try {
            if (row.action === "create") {
              const player = await this.createPlayer(
                actor.academyId,
                row.data,
                actor,
                {
                  trx,
                  passwordHash: passwordHashes.get(row.rowNumber),
                  publishEvent: false,
                },
              );
              processed.push({ ...row, player });
            } else if (row.action === "update") {
              const player = await this.updatePlayer(
                row.existingPlayer.id,
                actor.academyId,
                row.data,
                actor,
                {
                  trx,
                  passwordHash: passwordHashes.get(row.rowNumber),
                  publishEvent: false,
                },
              );
              processed.push({ ...row, player });
            } else {
              processed.push({ ...row, player: row.existingPlayer });
            }
          } catch (error) {
            error.importRow = row.rowNumber;
            error.importPlayerName =
              row.data.fullName || row.existingPlayer?.full_name;
            throw error;
          }
        }
        await this.repo.updateImportLog(
          importLog.id,
          {
            total_rows: validation.totalRows,
            imported_rows: validation.created + validation.updated,
            created_count: validation.created,
            updated_count: validation.updated,
            skipped_count: validation.skipped,
            failed_count: 0,
            status: "completed",
            error_details: null,
            completed_at: new Date(),
          },
          trx,
        );
        return processed;
      });

      processedRows.forEach((row) => {
        if (row.action === "create") {
          this._publishPlayerCreated(
            row.player,
            actor.academyId,
            row.data.branchId,
            row.data.groupId || null,
          );
        } else if (row.action === "update") {
          eventBus.publish(PLAYERS_EVENTS.UPDATED, {
            playerId: row.player.id,
          });
        }
      });

      return {
        valid: true,
        logId: importLog.id,
        totalRows: validation.totalRows,
        importedRows: validation.created + validation.updated,
        created: validation.created,
        updated: validation.updated,
        skipped: validation.skipped,
        failed: 0,
        status: "completed",
        errors: [],
      };
    } catch (error) {
      const failureDetail = {
        row: error.importRow || null,
        column: error.importRow ? "Full Name" : "Import",
        field: error.importRow ? "fullName" : "import",
        value: error.importPlayerName || "",
        message: error.message || "The player import failed.",
      };
      await this.repo.updateImportLog(importLog.id, {
        imported_rows: 0,
        created_count: 0,
        updated_count: 0,
        skipped_count: 0,
        failed_count: 1,
        status: "failed",
        error_details: [failureDetail],
        completed_at: new Date(),
      });
      if (error.importRow) {
        throw new BadRequestError(
          "Player import failed. No players were imported.",
          [failureDetail],
        );
      }
      throw error;
    }
  }

  async _saveExtendedPlayerData(
    trx,
    player,
    data,
    actor = {},
    coachProfile = null,
  ) {
    const groupId = data.groupId || null;

    if (
      data.heightCm ||
      data.weightKg ||
      hasAnyValue(data, Object.keys(physicalMap))
    ) {
      await trx("player_measurements").insert({
        player_id: player.id,
        height_cm: data.heightCm || null,
        weight_kg: data.weightKg || null,
        ...pickMapped(
          {
            ...data,
            bmi: data.bmi || calculateBmi(data.heightCm, data.weightKg),
          },
          physicalMap,
        ),
        measured_at: new Date(),
        measured_by: actor.userId || null,
        notes: "Player profile completion measurement",
      });
    }

    if (
      hasAnyValue(data, [
        ...Object.keys(technicalSkillMap),
        ...Object.keys(tacticalSkillMap),
      ])
    ) {
      await trx("player_skill_assessments").insert({
        player_id: player.id,
        group_id: groupId,
        recorded_by: actor.userId || null,
        assessed_at: new Date(),
        ...pickMapped(data, technicalSkillMap),
        ...pickMapped(data, tacticalSkillMap),
      });
    }

    if (hasAnyValue(data, Object.keys(trainingMap))) {
      await trx("player_training_summaries").insert({
        player_id: player.id,
        group_id: groupId,
        recorded_by: actor.userId || null,
        recorded_at: new Date(),
        ...pickMapped(data, trainingMap),
      });
    }

    if (hasAnyValue(data, Object.keys(matchSummaryMap))) {
      await trx("player_match_summaries").insert({
        player_id: player.id,
        group_id: groupId,
        recorded_by: actor.userId || null,
        recorded_at: new Date(),
        ...pickMapped(data, matchSummaryMap),
      });
    }

    if (hasAnyValue(data, Object.keys(healthMap))) {
      const healthData = pickMapped(data, healthMap);

      await trx("player_health_profiles")
        .insert({
          player_id: player.id,
          ...healthData,
        })
        .onConflict("player_id")
        .merge({
          ...healthData,
          updated_at: new Date(),
        });
    }

    if (
      data.injuryType ||
      data.injuryDate ||
      data.recoveryDate ||
      data.injuryHistory
    ) {
      await trx("player_injury_history").insert({
        player_id: player.id,
        injury_type: data.injuryType || null,
        injury_date: data.injuryDate || null,
        recovery_date: data.recoveryDate || null,
        notes: data.injuryHistory || null,
        reported_by: actor.userId || null,
      });
    }

    if (
      coachProfile &&
      hasAnyValue(data, [
        "overallRating",
        "potentialRating",
        "strengths",
        "weaknesses",
        "recommendedPosition",
        "developmentPlan",
        "coachFinalNotes",
      ])
    ) {
      await trx("evaluation_coach_ratings").insert({
        player_id: player.id,
        coach_id: coachProfile.id,
        group_id: groupId,
        score: data.overallRating ?? 0,
        potential_rating: data.potentialRating ?? null,
        strengths: data.strengths || null,
        weaknesses: data.weaknesses || null,
        recommended_position: data.recommendedPosition || null,
        development_plan: data.developmentPlan || null,
        final_notes: data.coachFinalNotes || null,
        notes: data.coachFinalNotes || null,
        eval_date: new Date(),
      });
    }

    if (
      data.subscriptionType ||
      data.monthlyFees ||
      data.paymentStatus ||
      data.nextPaymentDue ||
      data.discount ||
      data.penalty
    ) {
      const plan = data.subscriptionType || "monthly";
      const startsAt =
        data.lastPaymentDate || new Date().toISOString().slice(0, 10);
      const endsAt = data.nextPaymentDue || addPlanPeriod(startsAt, plan);
      const amount = data.monthlyFees || 0;
      const discount = data.discount || 0;
      const penalty = data.penalty || 0;
      const subscriptionStatus =
        data.paymentStatus === "cancelled"
          ? "cancelled"
          : data.paymentStatus === "paid"
            ? "active"
            : "pending";

      const [subscription] = await trx("payment_subscriptions")
        .insert({
          player_id: player.id,
          group_id: groupId,
          plan,
          amount,
          starts_at: startsAt,
          ends_at: endsAt,
          status: subscriptionStatus,
          discount_amount: discount,
          penalty_amount: penalty,
          last_payment_date: data.lastPaymentDate || null,
          next_payment_due: data.nextPaymentDue || null,
        })
        .returning("*");

      await trx("payment_invoices").insert({
        subscription_id: subscription.id,
        amount: Math.max(amount - discount + penalty, 0),
        due_date: data.nextPaymentDue || endsAt,
        paid_at:
          data.paymentStatus === "paid" && data.lastPaymentDate
            ? data.lastPaymentDate
            : null,
        status: data.paymentStatus || "pending",
      });
    }
  }

  async updatePlayer(id, academyId, data, actor = {}, options = {}) {
    const db = options.trx || this.repo.db;
    const player = await this.repo.findById(id, db);
    if (!player) throw new NotFoundError("Player", id);
    await this._assertPlayerAccess(actor, player, { write: true });

    const coachProfile =
      actor.role === "coach"
        ? await this.repo.findCoachProfileByUserId(actor.userId, db)
        : null;
    const currentGroupAssignment = data.groupId || data.markProfileComplete
      ? await this.repo.findCurrentGroupAssignment(id, db)
      : null;
    const nextBranchId = data.branchId || player.branch_id;
    const nextBirthDate = data.birthDate || player.date_of_birth;
    const nextBirthYear = nextBirthDate
      ? new Date(nextBirthDate).getFullYear()
      : null;

    if (data.branchId) {
      const branch = await this.repo.findBranchByIdAndAcademy(
        data.branchId,
        academyId,
        db,
      );
      if (!branch) throw new NotFoundError("Branch", data.branchId);
    }

    if (data.groupId) {
      if (player.profile_status !== "complete" && !data.markProfileComplete) {
        throw new BadRequestError(
          "Player profile must be complete before assigning a group",
        );
      }
      const group = await this.repo.findGroupByIdAndBranch(
        data.groupId,
        nextBranchId,
        db,
      );
      if (!group) throw new NotFoundError("Group", data.groupId);
    }

    if (actor.role === "coach") {
      if (!coachProfile)
        throw new ForbiddenError("Coach profile is not linked to this user");
      if (!Number.isInteger(nextBirthYear)) {
        throw new BadRequestError("A valid player birth date is required");
      }
      const accessibleBirthYear =
        await this.repo.findCoachBirthYearAccessForDate(
          coachProfile.id,
          nextBranchId,
          nextBirthYear,
          db,
        );
      if (!accessibleBirthYear) {
        throw new ForbiddenError(
          "Your coach account does not have access to this player birth year",
        );
      }
      if (
        data.groupId &&
        !(await this.repo.coachCanAccessGroup(
          coachProfile.id,
          data.groupId,
          db,
        ))
      ) {
        throw new ForbiddenError(
          "Your coach account cannot assign players to this group",
        );
      }
    }

    const updateData = {};
    if (data.fullName) updateData.full_name = data.fullName;
    if (data.birthDate) updateData.date_of_birth = data.birthDate;
    if (data.dateJoined !== undefined) updateData.date_joined = data.dateJoined;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.nationality !== undefined)
      updateData.nationality = data.nationality;
    if (data.branchId) updateData.branch_id = data.branchId;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.preferredFoot !== undefined)
      updateData.preferred_foot = data.preferredFoot;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.guardianName !== undefined)
      updateData.guardian_name = data.guardianName;
    if (data.guardianPhone !== undefined)
      updateData.guardian_phone = data.guardianPhone;
    if (data.guardianRelation !== undefined)
      updateData.guardian_relation = data.guardianRelation;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.markProfileComplete) {
      updateData.profile_status = "complete";
      updateData.profile_completed_at = new Date();
    }

    const passwordHash =
      options.passwordHash !== undefined
        ? options.passwordHash
        : data.password !== undefined
          ? await bcrypt.hash(data.password, env.BCRYPT_ROUNDS)
          : null;
    const hasIamUsers = await db.schema.hasTable("iam_users");
    const applyUpdate = async (trx) => {
      const row = await this.repo.update(id, updateData, trx);
      if (
        player.user_id &&
        (data.isActive !== undefined ||
          data.phone !== undefined ||
          data.branchId !== undefined)
      ) {
        const authUpdate = { updated_at: new Date() };
        if (data.isActive !== undefined) authUpdate.is_active = data.isActive;
        if (data.phone !== undefined) authUpdate.phone = data.phone;
        if (data.branchId !== undefined) authUpdate.branch_id = data.branchId;
        await trx("auth_users")
          .where({ id: player.user_id, role: "player" })
          .update(authUpdate);
        if (hasIamUsers && data.isActive !== undefined) {
          await trx("iam_users")
            .where({ id: player.user_id })
            .update({ is_active: data.isActive, updated_at: new Date() });
        }
      }
      if (data.password !== undefined) {
        if (!player.user_id) {
          throw new BadRequestError("This player does not have a login account to reset.");
        }
        const updatedAuthRows = await trx("auth_users")
          .where({ id: player.user_id, role: "player" })
          .whereNull("deleted_at")
          .update({ password_hash: passwordHash, updated_at: new Date() });
        if (!updatedAuthRows) {
          throw new BadRequestError("Player login account was not found.");
        }
        await trx("auth_password_resets")
          .where({ user_id: player.user_id, is_used: false })
          .update({ is_used: true, updated_at: new Date() });
      }
      await this._saveExtendedPlayerData(trx, row, data, actor, coachProfile);
      return row;
    };
    const updated = options.trx
      ? await applyUpdate(options.trx)
      : await this.repo.db.transaction(applyUpdate);

    let nextGroupId = data.groupId || null;
    if (data.markProfileComplete && !nextGroupId && !currentGroupAssignment) {
      const autoGroup = Number.isInteger(nextBirthYear)
        ? actor.role === "coach"
          ? await this.repo.findCoachAutoAssignableGroup(
              coachProfile.id,
              nextBranchId,
              nextBirthYear,
              db,
            )
          : await this.repo.findAutoAssignableGroup(
              nextBranchId,
              nextBirthYear,
              db,
            )
        : null;
      nextGroupId = autoGroup?.id || null;
    }

    // Handle group change
    if (nextGroupId && nextGroupId !== currentGroupAssignment?.group_id) {
      await this.repo.assignToGroup(id, nextGroupId, db);
    }

    const shouldPublishEvent =
      options.publishEvent !== undefined
        ? options.publishEvent
        : !options.trx;
    if (shouldPublishEvent) {
      if (nextGroupId && nextGroupId !== currentGroupAssignment?.group_id) {
        eventBus.publish(PLAYERS_EVENTS.GROUP_CHANGED, {
          playerId: id,
          oldGroupId: currentGroupAssignment?.group_id,
          newGroupId: nextGroupId,
        });
      }
      if (data.level && data.level !== player.level) {
        eventBus.publish(PLAYERS_EVENTS.LEVEL_CHANGED, {
          playerId: id,
          oldLevel: player.level,
          newLevel: data.level,
        });
      }
      eventBus.publish(PLAYERS_EVENTS.UPDATED, { playerId: id });
    }
    return updated;
  }

  async deletePlayer(id, academyId) {
    const player = await this.repo.findById(id);
    if (!player) throw new NotFoundError("Player", id);
    if (academyId && player.academy_id !== academyId)
      throw new NotFoundError("Player", id);

    await this.repo.softDelete(id);
    eventBus.publish(PLAYERS_EVENTS.DELETED, {
      playerId: id,
      academyId: player.academy_id,
    });
  }

  async hardDeletePlayer(id, academyId) {
    const player = await this.repo.findById(id);
    if (!player) throw new NotFoundError("Player", id);
    if (academyId && player.academy_id !== academyId)
      throw new NotFoundError("Player", id);

    const hasIamUsers = await this.repo.db.schema.hasTable("iam_users");
    await this.repo.db.transaction(async (trx) => {
      await trx("player_profiles").where({ id }).del();

      if (player.user_id) {
        await trx("auth_users")
          .where({ id: player.user_id, role: "player" })
          .del();

        if (hasIamUsers) {
          await trx("iam_users").where({ id: player.user_id }).del();
        }
      }
    });

    eventBus.publish(PLAYERS_EVENTS.DELETED, {
      playerId: id,
      academyId: player.academy_id,
      hardDelete: true,
    });
  }

  // ─── Measurements ──────────────────────────────────────────────────
  async getMeasurements(playerId, pagination) {
    return this.repo.findMeasurements(playerId, pagination);
  }

  async addMeasurement(playerId, coachId, data) {
    const measurement = await this.repo.addMeasurement({
      player_id: playerId,
      height_cm: data.heightCm,
      weight_kg: data.weightKg,
      ...pickMapped(
        {
          ...data,
          bmi: data.bmi || calculateBmi(data.heightCm, data.weightKg),
        },
        physicalMap,
      ),
      measured_at: data.recordedMonth,
      measured_by: coachId,
      notes: data.notes,
    });

    eventBus.publish(PLAYERS_EVENTS.MEASUREMENT_ADDED, {
      playerId,
      measurementId: measurement.id,
    });

    return measurement;
  }

  // ─── Injuries ──────────────────────────────────────────────────────
  async getInjuries(playerId, pagination) {
    return this.repo.findInjuries(playerId, pagination);
  }

  async addInjury(playerId, coachId, data) {
    const injury = await this.repo.addInjury({
      player_id: playerId,
      injury_type: data.injuryType,
      body_part: data.bodyPart,
      severity: data.severity,
      injury_date: data.occurredAt,
      recovery_date: data.recoveredAt || null,
      notes: data.notes,
      reported_by: coachId,
    });

    eventBus.publish(PLAYERS_EVENTS.INJURY_REPORTED, {
      playerId,
      injuryId: injury.id,
      severity: data.severity,
    });

    return injury;
  }

  // ─── Parent access ─────────────────────────────────────────────────
  async getChildrenByParent(parentUserId) {
    return this.repo.findChildrenByParent(parentUserId);
  }

  async isParentOfPlayer(parentUserId, playerId) {
    return this.repo.isParentOfPlayer(parentUserId, playerId);
  }
}

module.exports = PlayersService;
