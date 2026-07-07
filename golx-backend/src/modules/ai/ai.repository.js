const BaseRepository = require("../../shared/base.repository");

class AiRepository extends BaseRepository {
  constructor(db) {
    super("ai_analyses", db, { hasSoftDelete: false });
  }

  async upsertAiScore(playerId, score, breakdown) {
    const [row] = await this.db("ai_analyses")
      .insert({
        player_id: playerId,
        type: "performance",
        input_data: {},
        result: { score, breakdown },
      })
      .returning("*");
    return row;
  }

  async getAiScore(playerId) {
    return this.db("ai_analyses")
      .where({ player_id: playerId, type: "performance" })
      .orderBy("created_at", "desc")
      .first();
  }

  _baseAiScoresQuery(academyId) {
    return this.db("ai_analyses")
      .join("player_profiles", "ai_analyses.player_id", "player_profiles.id")
      .where("player_profiles.academy_id", academyId)
      .where("ai_analyses.type", "performance")
      .select("ai_analyses.*", "player_profiles.full_name");
  }

  async _paginateAiScores(query, { page = 1, limit = 20 } = {}) {
    const [{ count }] = await query
      .clone()
      .clearSelect()
      .count("ai_analyses.id as count");
    const data = await query
      .orderBy("ai_analyses.created_at", "desc")
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      data,
      total: +count,
      page,
      totalPages: Math.ceil(+count / limit) || 1,
    };
  }

  async getAiScores(academyId, pagination = {}) {
    return this._paginateAiScores(
      this._baseAiScoresQuery(academyId),
      pagination,
    );
  }

  async getAiScoresForCoach(academyId, coachId, pagination = {}) {
    const query = this._baseAiScoresQuery(academyId).where((scope) => {
      scope
        .whereIn(
          "player_profiles.id",
          this._coachAssignedPlayerIdsQuery(coachId),
        )
        .orWhereExists((exists) => {
          exists
            .select(this.db.raw("1"))
            .from("academy_birth_years as aby")
            .whereRaw("aby.branch_id = player_profiles.branch_id")
            .whereNull("aby.deleted_at")
            .whereRaw(
              "EXTRACT(YEAR FROM player_profiles.date_of_birth)::int BETWEEN aby.from_year AND aby.to_year",
            )
            .whereIn("aby.id", this._coachAccessibleBirthYearIdsQuery(coachId));
        });
    });

    return this._paginateAiScores(query, pagination);
  }

  async getAiScoresForPlayer(academyId, userId, pagination = {}) {
    return this._paginateAiScores(
      this._baseAiScoresQuery(academyId).where(
        "player_profiles.user_id",
        userId,
      ),
      pagination,
    );
  }

  async getAiScoresForParent(academyId, parentUserId, pagination = {}) {
    const query = this._baseAiScoresQuery(academyId).where((scope) => {
      scope
        .whereIn(
          "player_profiles.id",
          this._parentLinkedPlayerIdsQuery(parentUserId),
        )
        .orWhereIn(
          "player_profiles.id",
          this._legacyParentLinkedPlayerIdsQuery(parentUserId),
        );
    });

    return this._paginateAiScores(query, pagination);
  }

  async createInjuryRisk(data) {
    const [row] = await this.db("ai_analyses")
      .insert({
        player_id: data.player_id,
        type: "injury_risk",
        input_data: data.input_data || {},
        result: data.result || {},
      })
      .returning("*");
    return row;
  }

  async getInjuryRisks(playerId, { includeArchive = false } = {}) {
    const hotRows = await this.db("ai_analyses")
      .where({ player_id: playerId, type: "injury_risk" })
      .orderBy("created_at", "desc")
      .limit(10);
    if (!includeArchive || hotRows.length >= 10) return hotRows;
    if (!(await this.db.schema.hasTable("ai_analyses_archive"))) return hotRows;
    const archiveRows = await this.db("ai_analyses_archive")
      .where({ player_id: playerId, type: "injury_risk" })
      .orderBy("created_at", "desc")
      .limit(10);
    return [...hotRows, ...archiveRows]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 10);
  }

  async getLatestInjuryRisk(playerId) {
    return this.db("ai_analyses")
      .where({ player_id: playerId, type: "injury_risk" })
      .orderBy("created_at", "desc")
      .first();
  }

  async createNutritionPlan(data) {
    const [row] = await this.db("nutrition_plans").insert(data).returning("*");
    return row;
  }

  async getNutritionPlans(playerId) {
    return this.db("nutrition_plans")
      .where({ player_id: playerId })
      .orderBy("created_at", "desc")
      .limit(10);
  }

  async getLatestNutritionPlan(playerId) {
    return this.db("nutrition_plans")
      .where({ player_id: playerId })
      .orderBy("created_at", "desc")
      .first();
  }

  async verifyPlayerOwnership(playerId, academyId) {
    return this.db("player_profiles")
      .where({ id: playerId, academy_id: academyId })
      .whereNull("deleted_at")
      .first();
  }

  async findCoachProfileByUserId(userId, academyId) {
    return this.db("coach_profiles")
      .where({ user_id: userId, academy_id: academyId })
      .whereNull("deleted_at")
      .first();
  }

  async coachCanAccessPlayer(coachId, playerId) {
    const groupAccess = await this.db("player_group_assignments as pga")
      .join("coach_group_assignments as cga", "pga.group_id", "cga.group_id")
      .where("cga.coach_id", coachId)
      .where("pga.player_id", playerId)
      .whereNull("pga.left_at")
      .first("pga.player_id");
    if (groupAccess) return groupAccess;

    return this.db("player_profiles as pp")
      .where("pp.id", playerId)
      .whereNull("pp.deleted_at")
      .whereExists((exists) => {
        exists
          .select(this.db.raw("1"))
          .from("academy_birth_years as aby")
          .whereRaw("aby.branch_id = pp.branch_id")
          .whereNull("aby.deleted_at")
          .whereRaw(
            "EXTRACT(YEAR FROM pp.date_of_birth)::int BETWEEN aby.from_year AND aby.to_year",
          )
          .whereIn("aby.id", this._coachAccessibleBirthYearIdsQuery(coachId));
      })
      .first("pp.id as player_id");
  }

  async findParentLinkedPlayer(parentUserId, playerId, academyId) {
    const linked = await this.db("parent_player_links as ppl")
      .join("player_profiles as pp", "ppl.player_id", "pp.id")
      .where("ppl.parent_user_id", parentUserId)
      .where("ppl.player_id", playerId)
      .where("pp.academy_id", academyId)
      .whereNull("ppl.deleted_at")
      .whereNull("pp.deleted_at")
      .select("pp.*", "ppl.parent_user_id", "ppl.can_view_progress")
      .first();
    if (linked) return linked;

    return this.db("auth_users as au")
      .join("player_profiles as pp", "au.linked_player_id", "pp.id")
      .where({
        "au.id": parentUserId,
        "au.role": "parent",
        "pp.id": playerId,
        "pp.academy_id": academyId,
      })
      .whereNull("au.deleted_at")
      .whereNull("pp.deleted_at")
      .select(
        "pp.*",
        this.db.raw("au.id as parent_user_id"),
        this.db.raw("true as can_view_progress"),
      )
      .first();
  }

  _coachAssignedPlayerIdsQuery(coachId) {
    return this.db("player_group_assignments as pga")
      .join("coach_group_assignments as cga", "pga.group_id", "cga.group_id")
      .where("cga.coach_id", coachId)
      .whereNull("pga.left_at")
      .select("pga.player_id");
  }

  _coachAccessibleBirthYearIdsQuery(coachId) {
    return this.db
      .select("birth_year_id")
      .from(function accessibleBirthYears() {
        this.select("aby_all.id as birth_year_id")
          .from("coach_branch_access_rules as car_all")
          .join(
            "academy_birth_years as aby_all",
            "aby_all.branch_id",
            "car_all.branch_id",
          )
          .where("car_all.coach_id", coachId)
          .whereIn("car_all.access_type", ["birth_years", "both"])
          .where("car_all.all_birth_years", true)
          .whereNull("aby_all.deleted_at")
          .union(function selectedBirthYears() {
            this.select("carb.birth_year_id")
              .from("coach_branch_access_rules as car_selected")
              .join(
                "coach_access_rule_birth_years as carb",
                "carb.rule_id",
                "car_selected.id",
              )
              .where("car_selected.coach_id", coachId)
              .whereIn("car_selected.access_type", ["birth_years", "both"]);
          })
          .union(function groupBirthYears() {
            this.select("gby.birth_year_id")
              .from("coach_group_assignments as cga")
              .join("academy_groups as ag", "cga.group_id", "ag.id")
              .join("group_birth_years as gby", "gby.group_id", "ag.id")
              .where("cga.coach_id", coachId)
              .whereNull("ag.deleted_at");
          })
          .as("coach_accessible_birth_years");
      });
  }

  _parentLinkedPlayerIdsQuery(parentUserId) {
    return this.db("parent_player_links as ppl")
      .where("ppl.parent_user_id", parentUserId)
      .whereNull("ppl.deleted_at")
      .where((scope) => {
        scope
          .where("ppl.can_view_progress", true)
          .orWhereNull("ppl.can_view_progress");
      })
      .select("ppl.player_id");
  }

  _legacyParentLinkedPlayerIdsQuery(parentUserId) {
    return this.db("auth_users")
      .where({ id: parentUserId, role: "parent" })
      .whereNull("deleted_at")
      .whereNotNull("linked_player_id")
      .select("linked_player_id");
  }
}

module.exports = AiRepository;
