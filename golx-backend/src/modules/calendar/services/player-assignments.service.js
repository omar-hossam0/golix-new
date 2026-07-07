const { BadRequestError, NotFoundError } = require("../../../shared/errors");
const storage = require("../../../shared/storage");
const { assertUploadSignature } = require("../../../shared/upload-validation");
const { normalizePagination } = require("../../../shared/pagination");

const MAX_ASSIGNMENT_FILE_BYTES = 25 * 1024 * 1024;
const PLAYER_ASSIGNMENT_UPLOAD_MIME = {
  "application/pdf": { fileType: "pdf", extension: ".pdf" },
  "application/msword": { fileType: "word", extension: ".doc" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    fileType: "word",
    extension: ".docx",
  },
  "image/png": { fileType: "image", extension: ".png" },
  "image/jpeg": { fileType: "image", extension: ".jpg" },
  "image/jpg": { fileType: "image", extension: ".jpg" },
  "image/webp": { fileType: "image", extension: ".webp" },
};

function sanitizeFileName(value = "assignment-file") {
  let decoded = String(value || "assignment-file");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the original header value if it is not URI encoded.
  }
  return (
    decoded
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) || "assignment-file"
  );
}

class PlayerAssignmentsService {
  constructor(repository, { getPlayer }) {
    this.repo = repository;
    this.getPlayer = getPlayer;
  }

  dailyAiScore({ sleepHours, trainedToday, mealsCount }) {
    const sleepScore = sleepHours >= 8 ? 40 : sleepHours >= 7 ? 30 : 20;
    const trainingScore = trainedToday === 1 ? 40 : 0;
    const mealsScore = mealsCount >= 4 ? 20 : mealsCount === 3 ? 15 : 10;
    return sleepScore + trainingScore + mealsScore;
  }

  shapeDailyAiInput(row) {
    if (!row) return null;
    return {
      id: row.id,
      playerId: row.player_id,
      inputDate: row.input_date,
      sleepHours: Number(row.sleep_hours),
      trainedToday: Number(row.trained_today),
      mealsCount: Number(row.meals_count),
      dailyAiScore: Number(row.daily_ai_score),
      submittedAt: row.submitted_at,
    };
  }

  shapeFile(file) {
    return {
      id: file.id,
      submissionId: file.submission_id,
      fileType: file.file_type,
      fileName: file.file_name,
      fileUrl: file.file_url,
      mimeType: file.mime_type,
      sizeBytes: Number(file.size_bytes || 0),
      uploadedBy: file.uploaded_by,
      createdAt: file.created_at,
    };
  }

  shapeSubmission(row) {
    if (!row) return null;
    return {
      id: row.id,
      assignmentId: row.assignment_id,
      playerId: row.player_id,
      notes: row.notes || "",
      submittedAt: row.submitted_at,
      reviewStatus: row.review_status || "pending",
      coachComment: row.coach_comment || "",
      reviewedAt: row.reviewed_at || null,
      files: (row.files || []).map((file) => this.shapeFile(file)),
    };
  }

  async storeUpload(user, { originalName, mimeType, buffer }) {
    const normalizedMimeType = String(mimeType || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const typeInfo = PLAYER_ASSIGNMENT_UPLOAD_MIME[normalizedMimeType];
    if (!typeInfo) {
      throw new BadRequestError(
        "Only PDF, Word, PNG, JPG, JPEG, and WEBP assignment files are accepted.",
      );
    }
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new BadRequestError("Uploaded file is empty.");
    }
    if (buffer.length > MAX_ASSIGNMENT_FILE_BYTES) {
      throw new BadRequestError("Assignment files must be 25MB or smaller.");
    }
    assertUploadSignature(normalizedMimeType, buffer);

    const fileName = sanitizeFileName(originalName);
    const upload = await storage.putUpload({
      scope: "player-assignments",
      academyId: user.academyId,
      extension: typeInfo.extension,
      buffer,
      contentType: normalizedMimeType,
      uploaderId: user.userId,
      entityType: "player_assignment_file",
      isSensitive: true,
    });

    return {
      fileType: typeInfo.fileType,
      fileName,
      fileUrl: upload.url,
      mimeType: normalizedMimeType,
      sizeBytes: buffer.length,
    };
  }

  async listForPlayer(userId, academyId, filters = {}) {
    const player = await this.getPlayer(userId, academyId);
    const { page, limit, offset } = normalizePagination({
      page: filters.page,
      limit: filters.limit || 50,
    });
    const db = this.repo.db;
    const [{ today }] = await db
      .raw("SELECT current_date::text AS today")
      .then((result) => result.rows);
    const [groupRows, birthYearRows] = await Promise.all([
      this.repo.findPlayerGroups(player.id),
      this.repo.findBirthYearsForPlayer(player),
    ]);
    const groupIds = groupRows.map((row) => row.group_id);
    const birthYearIds = birthYearRows.map((row) => row.id);

    const [dailyInput, assignmentRows] = await Promise.all([
      db("player_daily_ai_inputs")
        .where({
          academy_id: academyId,
          player_id: player.id,
          input_date: today,
        })
        .first(),
      groupIds.length || birthYearIds.length
        ? db("player_assignments as pa")
            .join(
              "player_assignment_groups as pag",
              "pa.id",
              "pag.assignment_id",
            )
            .join("coach_profiles as cp", "pa.created_by_coach_id", "cp.id")
            .where("pa.academy_id", academyId)
            .where((targetScope) => {
              if (groupIds.length) {
                targetScope.orWhere((groupScope) => {
                  groupScope
                    .where((typeScope) => {
                      typeScope
                        .whereNull("pa.target_type")
                        .orWhere("pa.target_type", "group");
                    })
                    .whereIn("pag.group_id", groupIds);
                });
              }
              if (birthYearIds.length) {
                targetScope.orWhereExists((existsQuery) => {
                  existsQuery
                    .select(db.raw("1"))
                    .from("player_assignment_birth_years as paby")
                    .whereRaw("paby.assignment_id = pa.id")
                    .whereIn("paby.birth_year_id", birthYearIds);
                });
              }
            })
            .whereNull("pa.deleted_at")
            .where("pa.status", "active")
            .where((scope) => {
              scope
                .whereNull("pa.open_at")
                .orWhere("pa.open_at", "<=", new Date());
            })
            .groupBy("pa.id", "cp.full_name")
            .select("pa.*", "cp.full_name as coach_name")
            .orderBy("pa.due_at", "asc")
            .orderBy("pa.created_at", "desc")
        : [],
    ]);

    const assignmentIds = assignmentRows.map((assignment) => assignment.id);
    const [groups, submissions] = await Promise.all([
      assignmentIds.length
        ? db("player_assignment_groups as pag")
            .join("academy_groups as ag", "pag.group_id", "ag.id")
            .whereIn("pag.assignment_id", assignmentIds)
            .select("pag.assignment_id", "ag.id", "ag.name")
        : [],
      assignmentIds.length
        ? db("player_assignment_submissions")
            .whereIn("assignment_id", assignmentIds)
            .where("player_id", player.id)
        : [],
    ]);
    const submissionIds = submissions.map((submission) => submission.id);
    const files = submissionIds.length
      ? await db("player_assignment_files").whereIn(
          "submission_id",
          submissionIds,
        )
      : [];
    const groupsByAssignment = groups.reduce((acc, group) => {
      if (!acc[group.assignment_id]) acc[group.assignment_id] = [];
      acc[group.assignment_id].push({ id: group.id, name: group.name });
      return acc;
    }, {});
    const filesBySubmission = files.reduce((acc, file) => {
      if (!acc[file.submission_id]) acc[file.submission_id] = [];
      acc[file.submission_id].push(file);
      return acc;
    }, {});
    const submissionByAssignment = new Map(
      submissions.map((submission) => [
        submission.assignment_id,
        {
          ...submission,
          files: filesBySubmission[submission.id] || [],
        },
      ]),
    );

    const dailyAssignment = {
      id: "daily-ai-score",
      assignmentType: "daily_ai",
      title: "Daily AI Score Module",
      description:
        "Daily model input: sleep_hours, trained_today, meals_count.",
      openAt: `${today}T00:00:00`,
      dueAt: `${today}T23:59:59`,
      status: "active",
      isSystemDaily: true,
      acceptedFileTypes: [],
      groups: [],
      submission: this.shapeDailyAiInput(dailyInput),
      scoringRules: {
        sleep: ["sleep >= 8h = 40", "sleep >= 7h = 30", "otherwise = 20"],
        training: ["trained_today 1 = 40", "trained_today 0 = 0"],
        meals: ["4+ meals = 20", "3 meals = 15", "less than 3 meals = 10"],
        output: "daily_ai_score",
      },
    };

    const normalAssignments = assignmentRows.map((assignment) => ({
      id: assignment.id,
      assignmentType: "coach_task",
      title: assignment.title,
      description: assignment.description || "",
      coachName: assignment.coach_name || null,
      openAt: assignment.open_at,
      dueAt: assignment.due_at,
      status: assignment.status,
      isSystemDaily: false,
      acceptedFileTypes: assignment.accepted_file_types || [
        "pdf",
        "word",
        "image",
      ],
      groups: groupsByAssignment[assignment.id] || [],
      submission: this.shapeSubmission(
        submissionByAssignment.get(assignment.id),
      ),
    }));
    const rows =
      page === 1
        ? [dailyAssignment, ...normalAssignments].slice(offset, offset + limit)
        : normalAssignments.slice(offset - 1, offset - 1 + limit);
    const total = normalAssignments.length + 1;

    return {
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getVisibleAssignment(player, academyId, assignmentId) {
    const [groupRows, birthYearRows] = await Promise.all([
      this.repo.findPlayerGroups(player.id),
      this.repo.findBirthYearsForPlayer(player),
    ]);
    const groupIds = groupRows.map((row) => row.group_id);
    const birthYearIds = birthYearRows.map((row) => row.id);
    if (!groupIds.length && !birthYearIds.length) return null;

    return this.repo
      .db("player_assignments as pa")
      .join("player_assignment_groups as pag", "pa.id", "pag.assignment_id")
      .where("pa.id", assignmentId)
      .where("pa.academy_id", academyId)
      .where((targetScope) => {
        if (groupIds.length) {
          targetScope.orWhere((groupScope) => {
            groupScope
              .where((typeScope) => {
                typeScope
                  .whereNull("pa.target_type")
                  .orWhere("pa.target_type", "group");
              })
              .whereIn("pag.group_id", groupIds);
          });
        }
        if (birthYearIds.length) {
          targetScope.orWhereExists((existsQuery) => {
            existsQuery
              .select(this.repo.db.raw("1"))
              .from("player_assignment_birth_years as paby")
              .whereRaw("paby.assignment_id = pa.id")
              .whereIn("paby.birth_year_id", birthYearIds);
          });
        }
      })
      .whereNull("pa.deleted_at")
      .where("pa.status", "active")
      .select("pa.*")
      .first();
  }

  async submit(userId, academyId, assignmentId, data) {
    const player = await this.getPlayer(userId, academyId);
    const assignment = await this.getVisibleAssignment(
      player,
      academyId,
      assignmentId,
    );
    if (!assignment) throw new NotFoundError("Assignment", assignmentId);
    if (assignment.open_at && new Date(assignment.open_at) > new Date()) {
      throw new BadRequestError("Assignment is not open yet.");
    }

    const existingSubmission = await this.repo
      .db("player_assignment_submissions")
      .where({ assignment_id: assignmentId, player_id: player.id })
      .first();
    if (existingSubmission?.review_status === "approved") {
      throw new BadRequestError(
        "Assignment has already been accepted by the coach.",
      );
    }
    const canResubmitRejected =
      existingSubmission?.review_status === "rejected";
    if (
      assignment.due_at &&
      new Date(assignment.due_at) < new Date() &&
      !canResubmitRejected
    ) {
      throw new BadRequestError("Assignment deadline has passed.");
    }
    const files = data.files || [];
    if (!files.length) {
      throw new BadRequestError("At least one file is required.");
    }

    const submission = await this.repo.db.transaction(async (trx) => {
      const [row] = await trx("player_assignment_submissions")
        .insert({
          assignment_id: assignmentId,
          player_id: player.id,
          submitted_by_user_id: userId,
          notes: data.notes || null,
          submitted_at: new Date(),
          review_status: "pending",
          coach_comment: null,
          reviewed_by_coach_id: null,
          reviewed_by_user_id: null,
          reviewed_at: null,
        })
        .onConflict(["assignment_id", "player_id"])
        .merge({
          submitted_by_user_id: userId,
          notes: data.notes || null,
          submitted_at: new Date(),
          review_status: "pending",
          coach_comment: null,
          reviewed_by_coach_id: null,
          reviewed_by_user_id: null,
          reviewed_at: null,
          updated_at: new Date(),
        })
        .returning("*");
      await trx("player_assignment_files")
        .where({ submission_id: row.id })
        .del();
      await trx("player_assignment_files").insert(
        files.map((file) => ({
          submission_id: row.id,
          uploaded_by: userId,
          file_type: file.fileType,
          file_name: file.fileName,
          file_url: file.fileUrl,
          mime_type: file.mimeType || null,
          size_bytes: file.sizeBytes || null,
        })),
      );
      const savedFiles = await trx("player_assignment_files")
        .where({ submission_id: row.id })
        .orderBy("created_at", "asc");
      return { ...row, files: savedFiles };
    });
    await storage.attachMediaToEntity(
      files.map((file) => file.fileUrl),
      {
        academyId,
        scope: "player-assignments",
        uploaderId: userId,
        entityType: "player_assignment_submission",
        entityId: submission.id,
        isSensitive: true,
      },
    );

    return this.shapeSubmission(submission);
  }

  async submitDailyAiInput(userId, academyId, data) {
    const player = await this.getPlayer(userId, academyId);
    const [{ today }] = await this.repo.db
      .raw("SELECT current_date::text AS today")
      .then((result) => result.rows);
    const dailyAiScore = this.dailyAiScore(data);
    const [row] = await this.repo
      .db("player_daily_ai_inputs")
      .insert({
        academy_id: academyId,
        player_id: player.id,
        submitted_by_user_id: userId,
        input_date: today,
        sleep_hours: data.sleepHours,
        trained_today: data.trainedToday,
        meals_count: data.mealsCount,
        daily_ai_score: dailyAiScore,
        submitted_at: new Date(),
      })
      .onConflict(["player_id", "input_date"])
      .merge({
        submitted_by_user_id: userId,
        sleep_hours: data.sleepHours,
        trained_today: data.trainedToday,
        meals_count: data.mealsCount,
        daily_ai_score: dailyAiScore,
        submitted_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");

    return this.shapeDailyAiInput(row);
  }
}

module.exports = PlayerAssignmentsService;
module.exports.sanitizeFileName = sanitizeFileName;
