const { emitNotifications } = require("../../realtime/chat.realtime");
const {
  PERMISSION_COLUMNS,
} = require("../coaches/coach-assignment-roles");
const ParentRepository = require("./repositories/parent.repository");

class CalendarRepository extends ParentRepository {
  constructor(db) {
    super(db);
  }

  async paginate(query, { page = 1, limit = 50 } = {}) {
    const { count } = await this.db
      .from(query.clone().clearOrder().as("counted_rows"))
      .count("* as count")
      .first();
    const data = await query.limit(limit).offset((page - 1) * limit);
    const total = Number(count || 0);
    return { data, total, page, totalPages: Math.ceil(total / limit) || 1 };
  }

  findCoachByUserId(userId) {
    return this.db("coach_profiles")
      .where({ user_id: userId })
      .whereNull("deleted_at")
      .first();
  }

  findCoachById(coachId, academyId) {
    return this.db("coach_profiles")
      .where({ id: coachId, academy_id: academyId })
      .whereNull("deleted_at")
      .first();
  }

  findPlayerByUserId(userId) {
    return this.db("player_profiles")
      .where({ user_id: userId })
      .whereNull("deleted_at")
      .first();
  }

  async findCoachesForPlayer(player, academyId) {
    const birthYear = player.date_of_birth
      ? new Date(player.date_of_birth).getFullYear()
      : null;
    const groupRows = await this.findPlayerGroups(player.id);
    const groupIds = groupRows.map((row) => row.group_id);

    return this.db("coach_profiles as cp")
      .join("auth_users as au", "cp.user_id", "au.id")
      .where("cp.academy_id", academyId)
      .where("au.role", "coach")
      .where("au.is_active", true)
      .whereNull("cp.deleted_at")
      .whereNull("au.deleted_at")
      .andWhere((scope) => {
        if (groupIds.length) {
          scope.orWhereExists((exists) => {
            exists
              .select(this.db.raw("1"))
              .from("coach_group_assignments as cga")
              .whereRaw("cga.coach_id = cp.id")
              .whereIn("cga.group_id", groupIds);
          });
        }
        if (player.branch_id && birthYear) {
          scope.orWhereExists((exists) => {
            exists
              .select(this.db.raw("1"))
              .from("coach_branch_access_rules as car")
              .leftJoin(
                "coach_access_rule_birth_years as carb",
                "carb.rule_id",
                "car.id",
              )
              .leftJoin(
                "academy_birth_years as aby",
                "aby.id",
                "carb.birth_year_id",
              )
              .whereRaw("car.coach_id = cp.id")
              .where("car.branch_id", player.branch_id)
              .whereIn("car.access_type", ["birth_years", "both"])
              .andWhere((birthScope) => {
                birthScope.where("car.all_birth_years", true).orWhere((selected) => {
                  selected
                    .whereNotNull("aby.id")
                    .whereNull("aby.deleted_at")
                    .where("aby.from_year", "<=", birthYear)
                    .where("aby.to_year", ">=", birthYear);
                });
              });
          });
        }
      })
      .distinct("cp.id", "cp.user_id", "cp.full_name", "cp.specialization")
      .orderBy("cp.full_name", "asc");
  }

  async findCoachAssignedGroups(coachId, academyId) {
    return this.db("coach_group_assignments as cga")
      .join("academy_groups as ag", "cga.group_id", "ag.id")
      .join("academy_branches as ab", "ag.branch_id", "ab.id")
      .where("cga.coach_id", coachId)
      .where("ab.academy_id", academyId)
      .whereNull("ag.deleted_at")
      .select(
        "cga.id as assignment_id",
        "cga.coach_id",
        "cga.group_id",
        "cga.role",
        "cga.can_create_training",
        "cga.can_take_attendance",
        "cga.can_evaluate_players",
        "cga.can_record_measurements",
        "cga.can_manage_player_assignments",
        "cga.can_manage_players",
        "cga.can_manage_groups",
        "cga.can_manage_matches",
        "cga.can_view_injury_risk",
        "cga.can_run_injury_risk",
        "cga.can_manage_injury_risk",
        "ag.name as group_name",
        "ag.branch_id",
        "ab.name as branch_name",
      );
  }

  async findCoachEffectivePermissions(coachId, academyId) {
    const [groupAssignments, branchRules] = await Promise.all([
      this.db("coach_group_assignments as cga")
        .join("academy_groups as ag", "cga.group_id", "ag.id")
        .join("academy_branches as ab", "ag.branch_id", "ab.id")
        .where("cga.coach_id", coachId)
        .where("ab.academy_id", academyId)
        .whereNull("ag.deleted_at")
        .whereNull("ab.deleted_at")
        .select(PERMISSION_COLUMNS.map((column) => `cga.${column}`)),
      this.db("coach_branch_access_rules as car")
        .join("academy_branches as ab", "car.branch_id", "ab.id")
        .where("car.coach_id", coachId)
        .where("ab.academy_id", academyId)
        .whereNull("ab.deleted_at")
        .select(PERMISSION_COLUMNS.map((column) => `car.${column}`)),
    ]);

    const assignments = [...groupAssignments, ...branchRules];
    return Object.fromEntries(
      PERMISSION_COLUMNS.map((column) => [
        column,
        assignments.some((assignment) => assignment[column] === true),
      ]),
    );
  }

  async findCoachAssignedBranches(coachId, academyId) {
    return this.db("coach_branch_assignments as cba")
      .join("academy_branches as ab", "cba.branch_id", "ab.id")
      .where("cba.coach_id", coachId)
      .where("ab.academy_id", academyId)
      .whereNull("ab.deleted_at")
      .select("ab.*");
  }

  _coachAccessibleBirthYearIdsQuery(coachId, permission = null) {
    if (permission && !PERMISSION_COLUMNS.includes(permission)) {
      throw new Error(`Unsupported coach assignment permission: ${permission}`);
    }
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
          .modify((query) => {
            if (permission) query.where(`car_all.${permission}`, true);
          })
          .union(function selectedBirthYears() {
            this.select("carb.birth_year_id")
              .from("coach_branch_access_rules as car_selected")
              .join(
                "coach_access_rule_birth_years as carb",
                "carb.rule_id",
                "car_selected.id",
              )
              .where("car_selected.coach_id", coachId)
              .whereIn("car_selected.access_type", ["birth_years", "both"])
              .modify((query) => {
                if (permission) query.where(`car_selected.${permission}`, true);
              });
          })
          .union(function groupBirthYears() {
            this.select("gby.birth_year_id")
              .from("coach_group_assignments as cga")
              .join("academy_groups as ag", "cga.group_id", "ag.id")
              .join("group_birth_years as gby", "gby.group_id", "ag.id")
              .where("cga.coach_id", coachId)
              .whereNull("ag.deleted_at")
              .modify((query) => {
                if (permission) query.where(`cga.${permission}`, true);
              });
          })
          .as("coach_accessible_birth_years");
      });
  }

  async findCoachAccessibleBirthYears(
    coachId,
    academyId,
    { branchId, birthYear, permission } = {},
  ) {
    return this.db("academy_birth_years as aby")
      .join("academy_branches as ab", "aby.branch_id", "ab.id")
      .where("ab.academy_id", academyId)
      .whereIn(
        "aby.id",
        this._coachAccessibleBirthYearIdsQuery(coachId, permission),
      )
      .whereNull("aby.deleted_at")
      .whereNull("ab.deleted_at")
      .modify((q) => {
        if (branchId) q.where("aby.branch_id", branchId);
        if (birthYear) {
          q.where("aby.from_year", "<=", birthYear).where(
            "aby.to_year",
            ">=",
            birthYear,
          );
        }
      })
      .select("aby.*", "ab.name as branch_name")
      .orderBy("ab.name", "asc")
      .orderBy("aby.from_year", "asc");
  }

  async findCoachAutoAssignableGroup(coachId, branchId, birthYear) {
    return this.db("academy_groups as ag")
      .join("coach_group_assignments as cga", "cga.group_id", "ag.id")
      .join("group_birth_years as gby", "gby.group_id", "ag.id")
      .join("academy_birth_years as aby", "aby.id", "gby.birth_year_id")
      .leftJoin(
        "player_group_assignments as pga",
        function joinCurrentPlayers() {
          this.on("pga.group_id", "=", "ag.id").andOnNull("pga.left_at");
        },
      )
      .where("cga.coach_id", coachId)
      .where("ag.branch_id", branchId)
      .where("aby.from_year", "<=", birthYear)
      .where("aby.to_year", ">=", birthYear)
      .whereNull("ag.deleted_at")
      .whereNull("aby.deleted_at")
      .select(
        "ag.*",
        this.db.raw("COUNT(DISTINCT pga.player_id)::int as player_count"),
      )
      .groupBy("ag.id")
      .havingRaw(
        "(ag.max_players IS NULL OR COUNT(DISTINCT pga.player_id) < ag.max_players)",
      )
      .orderBy("ag.created_at", "asc")
      .first();
  }

  async findGroupsForBirthYears(academyId, birthYearIds) {
    if (!birthYearIds.length) return [];
    return this.db("academy_groups as ag")
      .join("academy_branches as ab", "ag.branch_id", "ab.id")
      .join("group_birth_years as gby", "gby.group_id", "ag.id")
      .where("ab.academy_id", academyId)
      .whereIn("gby.birth_year_id", birthYearIds)
      .whereNull("ag.deleted_at")
      .whereNull("ab.deleted_at")
      .distinct("ag.id");
  }

  async findBirthYearsByIds(birthYearIds, academyId) {
    if (!birthYearIds.length) return [];
    return this.db("academy_birth_years as aby")
      .join("academy_branches as ab", "aby.branch_id", "ab.id")
      .whereIn("aby.id", birthYearIds)
      .where("ab.academy_id", academyId)
      .whereNull("aby.deleted_at")
      .whereNull("ab.deleted_at")
      .select("aby.*", "ab.name as branch_name");
  }

  async findCoachVisibleGroupIds(coachId, academyId) {
    const [assignments, birthYears] = await Promise.all([
      this.findCoachAssignedGroups(coachId, academyId),
      this.findCoachAccessibleBirthYears(coachId, academyId),
    ]);
    const directIds = assignments.map((assignment) => assignment.group_id);
    const birthYearGroups = birthYears.length
      ? await this.findGroupsForBirthYears(
          academyId,
          birthYears.map((row) => row.id),
        )
      : [];
    return [
      ...new Set([...directIds, ...birthYearGroups.map((row) => row.id)]),
    ];
  }

  async findGroupsByIds(groupIds, academyId) {
    if (!groupIds.length) return [];
    return this.db("academy_groups as ag")
      .join("academy_branches as ab", "ag.branch_id", "ab.id")
      .whereIn("ag.id", groupIds)
      .where("ab.academy_id", academyId)
      .whereNull("ag.deleted_at")
      .whereNull("ab.deleted_at")
      .select("ag.id", "ag.name", "ag.branch_id", "ab.name as branch_name");
  }

  async findGroupPlayers(
    groupIds,
    { onlyComplete = false, customFieldId, customValue, customOptionId } = {},
  ) {
    if (!groupIds.length) return [];
    return this.db("player_group_assignments as pga")
      .join("player_profiles as pp", "pga.player_id", "pp.id")
      .modify((q) => {
        this._applyPlayerCustomFilter(q, "pp", {
          customFieldId,
          customValue,
          customOptionId,
        });
      })
      .whereIn("pga.group_id", groupIds)
      .whereNull("pga.left_at")
      .whereNull("pp.deleted_at")
      .modify((q) => {
        if (onlyComplete) q.where("pp.profile_status", "complete");
      })
      .select("pp.*", "pga.group_id");
  }

  async findCoachScopedPlayers(
    coachId,
    academyId,
    {
      onlyComplete = false,
      customFieldId,
      customValue,
      customOptionId,
      permission,
    } = {},
  ) {
    const [assignments, birthYears] = await Promise.all([
      this.findCoachAssignedGroups(coachId, academyId),
      this.findCoachAccessibleBirthYears(coachId, academyId, { permission }),
    ]);
    const groupIds = assignments
      .filter((assignment) => !permission || assignment[permission] === true)
      .map((assignment) => assignment.group_id);
    if (!groupIds.length && !birthYears.length) return [];

    return this.db("player_profiles as pp")
      .leftJoin(
        "player_group_assignments as pga",
        function joinCurrentAssignment() {
          this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
        },
      )
      .modify((q) => {
        this._applyPlayerCustomFilter(q, "pp", {
          customFieldId,
          customValue,
          customOptionId,
        });
      })
      .where("pp.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .andWhere((scope) => {
        if (groupIds.length) {
          scope.orWhereIn("pga.group_id", groupIds);
        }
        birthYears.forEach((row) => {
          scope.orWhere((birthScope) => {
            birthScope
              .where("pp.branch_id", row.branch_id)
              .whereRaw(
                "EXTRACT(YEAR FROM pp.date_of_birth)::int BETWEEN ? AND ?",
                [row.from_year, row.to_year],
              );
          });
        });
      })
      .modify((q) => {
        if (onlyComplete) q.where("pp.profile_status", "complete");
      })
      .distinctOn("pp.id")
      .select("pp.*", "pga.group_id")
      .orderBy("pp.id")
      .orderBy("pp.full_name", "asc");
  }

  async findAcademyRankingPlayers(
    academyId,
    { groupId, onlyComplete = false } = {},
  ) {
    return this.db("player_profiles as pp")
      .leftJoin(
        "player_group_assignments as pga",
        function joinCurrentAssignment() {
          this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
        },
      )
      .where("pp.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .modify((q) => {
        if (groupId) q.where("pga.group_id", groupId);
        if (onlyComplete) q.where("pp.profile_status", "complete");
      })
      .distinctOn("pp.id")
      .select("pp.*", "pga.group_id")
      .orderBy("pp.id")
      .orderBy("pp.full_name", "asc");
  }

  async findBirthYearsForPlayer(player) {
    if (!player?.date_of_birth || !player?.branch_id) return [];
    return this.db("academy_birth_years as aby")
      .where("aby.branch_id", player.branch_id)
      .whereNull("aby.deleted_at")
      .whereRaw(
        "EXTRACT(YEAR FROM ?::date)::int BETWEEN aby.from_year AND aby.to_year",
        [player.date_of_birth],
      )
      .select("aby.id");
  }

  _applyPlayerCustomFilter(query, playerAlias, filters = {}) {
    const { customFieldId, customValue, customOptionId } = filters;
    if (!customFieldId) return;

    query.whereExists((existsQuery) => {
      existsQuery
        .select(this.db.raw("1"))
        .from("player_custom_values as pcv_filter")
        .whereRaw("pcv_filter.player_id = ??.id", [playerAlias])
        .where("pcv_filter.field_id", customFieldId);

      if (customOptionId) {
        existsQuery.andWhere((scope) => {
          scope
            .where("pcv_filter.value_option_id", customOptionId)
            .orWhereRaw("pcv_filter.value_json @> ?::jsonb", [
              JSON.stringify([customOptionId]),
            ]);
        });
      }

      if (customValue) {
        existsQuery.andWhere((scope) => {
          scope
            .whereILike("pcv_filter.value_text", `%${customValue}%`)
            .orWhereILike("pcv_filter.value_long_text", `%${customValue}%`)
            .orWhereRaw("pcv_filter.value_number::text ILIKE ?", [
              `%${customValue}%`,
            ])
            .orWhereRaw("pcv_filter.value_decimal::text ILIKE ?", [
              `%${customValue}%`,
            ])
            .orWhereRaw("pcv_filter.value_date::text ILIKE ?", [
              `%${customValue}%`,
            ])
            .orWhereRaw("pcv_filter.value_json::text ILIKE ?", [
              `%${customValue}%`,
            ]);
        });
      }
    });
  }

  async findCoachScopedPlayersByIds(
    coachId,
    academyId,
    playerIds,
    { onlyComplete = false, permission } = {},
  ) {
    if (!playerIds.length) return [];
    const [assignments, birthYears] = await Promise.all([
      this.findCoachAssignedGroups(coachId, academyId),
      this.findCoachAccessibleBirthYears(coachId, academyId, { permission }),
    ]);
    const groupIds = assignments
      .filter((assignment) => !permission || assignment[permission] === true)
      .map((assignment) => assignment.group_id);
    if (!groupIds.length && !birthYears.length) return [];

    return this.db("player_profiles as pp")
      .leftJoin(
        "player_group_assignments as pga",
        function joinCurrentAssignment() {
          this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
        },
      )
      .whereIn("pp.id", playerIds)
      .where("pp.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .andWhere((scope) => {
        if (groupIds.length) {
          scope.orWhereIn("pga.group_id", groupIds);
        }
        birthYears.forEach((row) => {
          scope.orWhere((birthScope) => {
            birthScope
              .where("pp.branch_id", row.branch_id)
              .whereRaw(
                "EXTRACT(YEAR FROM pp.date_of_birth)::int BETWEEN ? AND ?",
                [row.from_year, row.to_year],
              );
          });
        });
      })
      .modify((q) => {
        if (onlyComplete) q.where("pp.profile_status", "complete");
      })
      .distinctOn("pp.id")
      .select("pp.id", "pp.profile_status")
      .orderBy("pp.id");
  }

  async findPlayerGroups(playerId) {
    return this.db("player_group_assignments")
      .where({ player_id: playerId })
      .whereNull("left_at")
      .select("group_id");
  }

  async createEventWithGroups(eventData, groupIds, trx = this.db) {
    return this.createEventWithTargets(eventData, { groupIds }, trx);
  }

  async createEventWithTargets(
    eventData,
    { groupIds = [], birthYearIds = [], playerIds = [] } = {},
    trx = this.db,
  ) {
    const [event] = await trx("calendar_events")
      .insert(eventData)
      .returning("*");
    if (groupIds.length) {
      await trx("calendar_event_groups").insert(
        groupIds.map((groupId) => ({
          event_id: event.id,
          group_id: groupId,
        })),
      );
    }
    if (birthYearIds.length) {
      await trx("calendar_event_birth_years").insert(
        birthYearIds.map((birthYearId) => ({
          event_id: event.id,
          birth_year_id: birthYearId,
        })),
      );
    }
    if (playerIds.length) {
      await trx("calendar_event_players").insert(
        playerIds.map((playerId) => ({
          event_id: event.id,
          player_id: playerId,
        })),
      );
    }
    return event;
  }

  async replaceEventGroups(eventId, groupIds, trx = this.db) {
    await trx("calendar_event_groups").where({ event_id: eventId }).del();
    if (groupIds.length) {
      await trx("calendar_event_groups").insert(
        groupIds.map((groupId) => ({
          event_id: eventId,
          group_id: groupId,
        })),
      );
    }
  }

  async replaceEventTargets(
    eventId,
    { groupIds = [], birthYearIds = [], playerIds = [] } = {},
    trx = this.db,
  ) {
    await trx("calendar_event_groups").where({ event_id: eventId }).del();
    await trx("calendar_event_birth_years").where({ event_id: eventId }).del();
    await trx("calendar_event_players").where({ event_id: eventId }).del();
    if (groupIds.length) {
      await trx("calendar_event_groups").insert(
        groupIds.map((groupId) => ({ event_id: eventId, group_id: groupId })),
      );
    }
    if (birthYearIds.length) {
      await trx("calendar_event_birth_years").insert(
        birthYearIds.map((birthYearId) => ({
          event_id: eventId,
          birth_year_id: birthYearId,
        })),
      );
    }
    if (playerIds.length) {
      await trx("calendar_event_players").insert(
        playerIds.map((playerId) => ({ event_id: eventId, player_id: playerId })),
      );
    }
  }

  eventListQuery(academyId, filters = {}) {
    return this.db("calendar_events as ce")
      .leftJoin("calendar_event_groups as ceg", "ceg.event_id", "ce.id")
      .leftJoin("academy_groups as ag", "ceg.group_id", "ag.id")
      .leftJoin("calendar_event_birth_years as ceby", "ceby.event_id", "ce.id")
      .leftJoin("academy_birth_years as aby", "ceby.birth_year_id", "aby.id")
      .leftJoin("calendar_event_players as cep", "cep.event_id", "ce.id")
      .leftJoin("player_profiles as epp", "cep.player_id", "epp.id")
      .where("ce.academy_id", academyId)
      .whereNull("ce.deleted_at")
      .modify((q) => {
        if (filters.groupId) {
          q.where("ceg.group_id", filters.groupId);
        }
        if (
          filters.groupIds?.length ||
          filters.birthYearIds?.length ||
          filters.playerIds?.length
        ) {
          q.andWhere((scope) => {
            if (filters.groupIds?.length) {
              scope.orWhereIn("ceg.group_id", filters.groupIds);
            }
            if (filters.birthYearIds?.length) {
              scope.orWhereIn("ceby.birth_year_id", filters.birthYearIds);
            }
            if (filters.playerIds?.length) {
              scope.orWhereIn("cep.player_id", filters.playerIds);
            }
          });
        }
        if (filters.eventType) q.where("ce.event_type", filters.eventType);
        if (filters.status) q.where("ce.status", filters.status);
        if (filters.dateFrom)
          q.whereRaw("ce.start_datetime >= ?::date", [filters.dateFrom]);
        if (filters.dateTo)
          q.whereRaw("ce.start_datetime < (?::date + interval '1 day')", [
            filters.dateTo,
          ]);
      })
      .groupBy("ce.id")
      .select(
        "ce.*",
        this.db.raw(
          "COALESCE(json_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name)) FILTER (WHERE ag.id IS NOT NULL), '[]') as groups",
        ),
        this.db.raw(
          "COALESCE(json_agg(DISTINCT jsonb_build_object('id', aby.id, 'label', COALESCE(aby.label, CONCAT(aby.from_year, '-', aby.to_year)), 'fromYear', aby.from_year, 'toYear', aby.to_year)) FILTER (WHERE aby.id IS NOT NULL), '[]') as birth_years",
        ),
        this.db.raw(
          "COALESCE(json_agg(DISTINCT jsonb_build_object('id', epp.id, 'name', epp.full_name)) FILTER (WHERE epp.id IS NOT NULL), '[]') as players",
        ),
      )
      .orderBy("ce.start_datetime", "asc");
  }

  async findEventById(eventId, academyId) {
    const event = await this.eventListQuery(academyId, {})
      .where("ce.id", eventId)
      .first();
    if (!event) return null;
    const [training, match, attendance, evaluations] = await Promise.all([
      this.db("training_sessions").where({ event_id: eventId }).first(),
      this.db("matches")
        .where({ event_id: eventId })
        .whereNull("deleted_at")
        .first(),
      this.db("event_attendance as ea")
        .join("player_profiles as pp", "ea.player_id", "pp.id")
        .where("ea.event_id", eventId)
        .select("ea.*", "pp.full_name as player_name")
        .orderBy("pp.full_name", "asc"),
      this.db("player_event_evaluations as pee")
        .join("player_profiles as pp", "pee.player_id", "pp.id")
        .where("pee.event_id", eventId)
        .select("pee.*", "pp.full_name as player_name")
        .orderBy("pp.full_name", "asc"),
    ]);
    return { ...event, training, match, attendance, evaluations };
  }

  matchListQuery(academyId, filters = {}) {
    return this.db("matches as m")
      .leftJoin("calendar_events as ce", "m.event_id", "ce.id")
      .leftJoin("calendar_event_groups as ceg", "ceg.event_id", "ce.id")
      .leftJoin("academy_groups as ag", "ceg.group_id", "ag.id")
      .leftJoin("calendar_event_birth_years as ceby", "ceby.event_id", "ce.id")
      .leftJoin("academy_birth_years as aby", "ceby.birth_year_id", "aby.id")
      .leftJoin("academy_groups as team", "m.team_id", "team.id")
      .whereNull("m.deleted_at")
      .where((q) => {
        q.where("ce.academy_id", academyId)
          .orWhereIn(
            "m.team_id",
            this.db("academy_groups as ag2")
              .join("academy_branches as ab2", "ag2.branch_id", "ab2.id")
              .where("ab2.academy_id", academyId)
              .select("ag2.id"),
          )
          .orWhereIn(
            "m.age_group_id",
            this.db("academy_groups as ag3")
              .join("academy_branches as ab3", "ag3.branch_id", "ab3.id")
              .where("ab3.academy_id", academyId)
              .select("ag3.id"),
          );
      })
      .modify((q) => {
        if (filters.teamId) q.where("m.team_id", filters.teamId);
        if (filters.ageGroupId) q.where("m.age_group_id", filters.ageGroupId);
        if (filters.groupId) {
          q.andWhere((scope) => {
            scope
              .where("ceg.group_id", filters.groupId)
              .orWhere("m.team_id", filters.groupId)
              .orWhere("m.age_group_id", filters.groupId);
          });
        }
        if (filters.groupIds?.length && filters.birthYearIds?.length) {
          q.andWhere((scope) => {
            scope
              .whereIn("ceg.group_id", filters.groupIds)
              .orWhereIn("m.team_id", filters.groupIds)
              .orWhereIn("m.age_group_id", filters.groupIds)
              .orWhereIn("ceby.birth_year_id", filters.birthYearIds);
          });
        } else if (filters.groupIds?.length) {
          q.andWhere((scope) => {
            scope
              .whereIn("ceg.group_id", filters.groupIds)
              .orWhereIn("m.team_id", filters.groupIds)
              .orWhereIn("m.age_group_id", filters.groupIds);
          });
        } else if (filters.birthYearIds?.length) {
          q.whereIn("ceby.birth_year_id", filters.birthYearIds);
        }
        if (filters.matchType) q.where("m.match_type", filters.matchType);
        if (filters.status) q.where("m.status", filters.status);
        if (filters.dateFrom) q.where("m.match_date", ">=", filters.dateFrom);
        if (filters.dateTo) q.where("m.match_date", "<=", filters.dateTo);
      })
      .groupBy("m.id", "ce.id", "team.id")
      .select(
        "m.*",
        "ce.academy_id",
        this.db.raw(
          "(SELECT settings FROM academy_academies WHERE id = ?) as academy_settings",
          [academyId],
        ),
        "ce.title as event_title",
        "ce.start_datetime",
        "ce.end_datetime",
        this.db.raw(
          "COALESCE(NULLIF(m.target_snapshot->>'teamName', ''), team.name) as team_name",
        ),
        this.db.raw(
          "CASE WHEN jsonb_typeof(m.target_snapshot->'groups') = 'array' AND jsonb_array_length(m.target_snapshot->'groups') > 0 THEN m.target_snapshot->'groups' ELSE COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name)) FILTER (WHERE ag.id IS NOT NULL), '[]'::jsonb) END as groups",
        ),
        this.db.raw(
          "CASE WHEN jsonb_typeof(m.target_snapshot->'birthYears') = 'array' AND jsonb_array_length(m.target_snapshot->'birthYears') > 0 THEN m.target_snapshot->'birthYears' ELSE COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', aby.id, 'label', COALESCE(aby.label, CONCAT(aby.from_year, '-', aby.to_year)), 'fromYear', aby.from_year, 'toYear', aby.to_year)) FILTER (WHERE aby.id IS NOT NULL), '[]'::jsonb) END as birth_years",
        ),
      )
      .orderBy("m.match_date", "asc")
      .orderBy("m.match_time", "asc");
  }

  async findMatchById(matchId, academyId) {
    const match = await this.matchListQuery(academyId, {})
      .where("m.id", matchId)
      .first();
    if (!match) return null;
    const [
      squad,
      tactics,
      attendance,
      stats,
      incidents,
      goalEvents,
      substitutions,
      postponements,
    ] = await Promise.all([
      this.db("match_squads as ms")
        .join("player_profiles as pp", "ms.player_id", "pp.id")
        .where("ms.match_id", matchId)
        .select(
          "ms.*",
          this.db.raw(
            "COALESCE(ms.player_name_snapshot, pp.full_name) as player_name",
          ),
          this.db.raw(
            "COALESCE(ms.profile_status_snapshot, pp.profile_status::text) as profile_status",
          ),
        )
        .orderBy("ms.squad_role", "asc")
        .orderByRaw("COALESCE(ms.player_name_snapshot, pp.full_name) asc"),
      this.db("match_tactics as mt")
        .leftJoin("coach_profiles as cp", "mt.coach_id", "cp.id")
        .where("mt.match_id", matchId)
        .select("mt.*", "cp.full_name as coach_name")
        .first(),
      this.db("match_attendance as ma")
        .join("player_profiles as pp", "ma.player_id", "pp.id")
        .leftJoin("match_squads as ms", function joinSquadSnapshot() {
          this.on("ms.match_id", "=", "ma.match_id").andOn(
            "ms.player_id",
            "=",
            "ma.player_id",
          );
        })
        .where("ma.match_id", matchId)
        .select(
          "ma.*",
          this.db.raw(
            "COALESCE(ms.player_name_snapshot, pp.full_name) as player_name",
          ),
        ),
      this.db("match_player_stats as mps")
        .join("player_profiles as pp", "mps.player_id", "pp.id")
        .leftJoin("match_squads as ms", function joinSquadSnapshot() {
          this.on("ms.match_id", "=", "mps.match_id").andOn(
            "ms.player_id",
            "=",
            "mps.player_id",
          );
        })
        .where("mps.match_id", matchId)
        .select(
          "mps.*",
          this.db.raw(
            "COALESCE(ms.player_name_snapshot, pp.full_name) as player_name",
          ),
        ),
      this.db("match_player_incidents as mpi")
        .join("player_profiles as pp", "mpi.player_id", "pp.id")
        .leftJoin("match_squads as ms", function joinSquadSnapshot() {
          this.on("ms.match_id", "=", "mpi.match_id").andOn(
            "ms.player_id",
            "=",
            "mpi.player_id",
          );
        })
        .where("mpi.match_id", matchId)
        .select(
          "mpi.*",
          this.db.raw(
            "COALESCE(ms.player_name_snapshot, pp.full_name) as player_name",
          ),
        )
        .orderBy("mpi.created_at", "desc"),
      this.db("match_goal_events as mge")
        .leftJoin(
          "player_profiles as scorer",
          "mge.scorer_player_id",
          "scorer.id",
        )
        .leftJoin(
          "player_profiles as assister",
          "mge.assist_player_id",
          "assister.id",
        )
        .leftJoin("match_squads as scorer_squad", function joinScorerSquad() {
          this.on("scorer_squad.match_id", "=", "mge.match_id").andOn(
            "scorer_squad.player_id",
            "=",
            "mge.scorer_player_id",
          );
        })
        .leftJoin("match_squads as assist_squad", function joinAssistSquad() {
          this.on("assist_squad.match_id", "=", "mge.match_id").andOn(
            "assist_squad.player_id",
            "=",
            "mge.assist_player_id",
          );
        })
        .where("mge.match_id", matchId)
        .select(
          "mge.*",
          this.db.raw(
            "COALESCE(scorer_squad.player_name_snapshot, scorer.full_name) as scorer_player_name",
          ),
          this.db.raw(
            "COALESCE(assist_squad.player_name_snapshot, assister.full_name) as assist_player_name",
          ),
        )
        .orderBy("mge.minute", "asc")
        .orderBy("mge.created_at", "asc"),
      this.db("match_substitutions as sub")
        .join("player_profiles as out_player", "sub.out_player_id", "out_player.id")
        .join("player_profiles as in_player", "sub.in_player_id", "in_player.id")
        .leftJoin("coach_profiles as cp", "sub.coach_id", "cp.id")
        .leftJoin("match_squads as out_squad", function joinOutSquad() {
          this.on("out_squad.match_id", "=", "sub.match_id").andOn(
            "out_squad.player_id",
            "=",
            "sub.out_player_id",
          );
        })
        .leftJoin("match_squads as in_squad", function joinInSquad() {
          this.on("in_squad.match_id", "=", "sub.match_id").andOn(
            "in_squad.player_id",
            "=",
            "sub.in_player_id",
          );
        })
        .where("sub.match_id", matchId)
        .select(
          "sub.*",
          this.db.raw(
            "COALESCE(out_squad.player_name_snapshot, out_player.full_name) as out_player_name",
          ),
          this.db.raw(
            "COALESCE(in_squad.player_name_snapshot, in_player.full_name) as in_player_name",
          ),
          "cp.full_name as coach_name",
        )
        .orderBy("sub.minute", "asc")
        .orderBy("sub.created_at", "asc"),
      this.db("match_postponements as mp")
        .where("mp.match_id", matchId)
        .select("mp.*")
        .orderBy("mp.created_at", "desc"),
    ]);
    const statPlayerIds = stats.map((stat) => stat.player_id);
    let statsWithWeeklyMinutes = stats;
    if (statPlayerIds.length) {
      const weeklyRows = await this.db("match_player_stats as mps")
        .join("matches as wm", "mps.match_id", "wm.id")
        .whereIn("mps.player_id", statPlayerIds)
        .whereNull("wm.deleted_at")
        .whereRaw(
          "wm.match_date >= date_trunc('week', ?::date)::date",
          [match.match_date],
        )
        .whereRaw(
          "wm.match_date < (date_trunc('week', ?::date)::date + INTERVAL '7 days')",
          [match.match_date],
        )
        .groupBy("mps.player_id")
        .select(
          "mps.player_id",
          this.db.raw("COALESCE(SUM(mps.minutes_played), 0)::int as weekly_minutes_played"),
          this.db.raw("COUNT(*) FILTER (WHERE mps.minutes_played > 0)::int as weekly_matches_played"),
          this.db.raw("date_trunc('week', ?::date)::date as week_start", [
            match.match_date,
          ]),
          this.db.raw("(date_trunc('week', ?::date)::date + INTERVAL '6 days')::date as week_end", [
            match.match_date,
          ]),
        );
      const weeklyByPlayer = new Map(
        weeklyRows.map((row) => [row.player_id, row]),
      );
      statsWithWeeklyMinutes = stats.map((stat) => ({
        ...stat,
        weekly_minutes_played: Number(
          weeklyByPlayer.get(stat.player_id)?.weekly_minutes_played || 0,
        ),
        weekly_matches_played: Number(
          weeklyByPlayer.get(stat.player_id)?.weekly_matches_played || 0,
        ),
        week_start: weeklyByPlayer.get(stat.player_id)?.week_start || null,
        week_end: weeklyByPlayer.get(stat.player_id)?.week_end || null,
      }));
    }
    return {
      ...match,
      squad,
      tactics,
      attendance,
      stats: statsWithWeeklyMinutes,
      incidents,
      goal_events: goalEvents,
      substitutions,
      postponements,
    };
  }

  async findDueMatchDayCandidates() {
    return this.db("matches as m")
      .join("calendar_events as ce", "m.event_id", "ce.id")
      .leftJoin("academy_academies as aa", "ce.academy_id", "aa.id")
      .whereNull("m.deleted_at")
      .whereIn("m.status", ["scheduled", "postponed"])
      .where("m.match_status", "scheduled")
      .whereRaw("m.match_date >= CURRENT_DATE - INTERVAL '1 day'")
      .whereRaw("m.match_date <= CURRENT_DATE + INTERVAL '1 day'")
      .select(
        "m.id",
        "m.status",
        "m.match_status",
        "m.match_day_notified_at",
        "m.match_date",
        "m.match_time",
        "ce.academy_id",
        "aa.settings as academy_settings",
      );
  }

  async findAutoFinishMatchCandidates(academyId, { matchId } = {}) {
    return this.db("matches as m")
      .leftJoin("calendar_events as ce", "m.event_id", "ce.id")
      .whereNull("m.deleted_at")
      .whereIn("m.status", ["scheduled", "postponed"])
      .whereIn("m.match_status", [
        "scheduled",
        "first_half",
        "second_half",
        "finished",
      ])
      .whereRaw("m.match_date <= CURRENT_DATE")
      .where((q) => {
        q.where("ce.academy_id", academyId)
          .orWhereIn(
            "m.team_id",
            this.db("academy_groups as ag2")
              .join("academy_branches as ab2", "ag2.branch_id", "ab2.id")
              .where("ab2.academy_id", academyId)
              .select("ag2.id"),
          )
          .orWhereIn(
            "m.age_group_id",
            this.db("academy_groups as ag3")
              .join("academy_branches as ab3", "ag3.branch_id", "ab3.id")
              .where("ab3.academy_id", academyId)
              .select("ag3.id"),
          );
      })
      .modify((q) => {
        if (matchId) q.where("m.id", matchId);
      })
      .select(
        "m.id",
        "m.event_id",
        "m.status",
        "m.match_status",
        "m.match_date",
        "m.match_time",
        "m.started_at",
        "m.finished_at",
        "m.team_id",
        "m.age_group_id",
        this.db.raw(
          "EXISTS (SELECT 1 FROM match_tactics mt WHERE mt.match_id = m.id) as has_tactics",
        ),
        this.db.raw(
          "(SELECT COUNT(*) FROM match_squads ms WHERE ms.match_id = m.id)::int as squad_count",
        ),
        this.db.raw(
          "(SELECT COUNT(*) FROM match_attendance ma WHERE ma.match_id = m.id)::int as attendance_count",
        ),
      );
  }

  async findAutoFinishCandidateAcademyIds() {
    return this.db("matches as m")
      .join("calendar_events as ce", "m.event_id", "ce.id")
      .whereNull("m.deleted_at")
      .whereNull("ce.deleted_at")
      .whereIn("m.status", ["scheduled", "postponed"])
      .whereIn("m.match_status", [
        "scheduled",
        "first_half",
        "second_half",
        "finished",
      ])
      .whereRaw("m.match_date <= CURRENT_DATE")
      .distinct("ce.academy_id");
  }

  async findMatchForHardDelete(matchId, academyId) {
    return this.db("matches as m")
      .leftJoin("calendar_events as ce", "m.event_id", "ce.id")
      .where("m.id", matchId)
      .where((q) => {
        q.where("ce.academy_id", academyId)
          .orWhereIn(
            "m.team_id",
            this.db("academy_groups as ag2")
              .join("academy_branches as ab2", "ag2.branch_id", "ab2.id")
              .where("ab2.academy_id", academyId)
              .select("ag2.id"),
          )
          .orWhereIn(
            "m.age_group_id",
            this.db("academy_groups as ag3")
              .join("academy_branches as ab3", "ag3.branch_id", "ab3.id")
              .where("ab3.academy_id", academyId)
              .select("ag3.id"),
          );
      })
      .select("m.*", "ce.academy_id as event_academy_id")
      .first();
  }

  async getMatchGroupIds(matchId) {
    const rows = await this.db("matches as m")
      .leftJoin("calendar_event_groups as ceg", "m.event_id", "ceg.event_id")
      .where("m.id", matchId)
      .select("m.team_id", "m.age_group_id", "ceg.group_id");

    return [
      ...new Set(
        rows
          .flatMap((row) => [row.team_id, row.age_group_id, row.group_id])
          .filter(Boolean),
      ),
    ];
  }

  async getMatchBirthYearIds(matchId) {
    const rows = await this.db("matches as m")
      .leftJoin(
        "calendar_event_birth_years as ceby",
        "m.event_id",
        "ceby.event_id",
      )
      .where("m.id", matchId)
      .select("ceby.birth_year_id");
    return [...new Set(rows.map((row) => row.birth_year_id).filter(Boolean))];
  }

  async replaceEventBirthYears(eventId, birthYearIds, trx = this.db) {
    await trx("calendar_event_birth_years").where({ event_id: eventId }).del();
    if (birthYearIds.length) {
      await trx("calendar_event_birth_years").insert(
        birthYearIds.map((birthYearId) => ({
          event_id: eventId,
          birth_year_id: birthYearId,
        })),
      );
    }
  }

  async findFriendlyRequestById(id, academyId) {
    return this.db("friendly_match_requests as fmr")
      .join("coach_profiles as cp", "fmr.coach_id", "cp.id")
      .where("fmr.id", id)
      .where("cp.academy_id", academyId)
      .select("fmr.*", "cp.user_id as coach_user_id")
      .first();
  }

  friendlyRequestsQuery(academyId, filters = {}) {
    return this.db("friendly_match_requests as fmr")
      .join("coach_profiles as cp", "fmr.coach_id", "cp.id")
      .leftJoin("academy_groups as ag", "fmr.team_id", "ag.id")
      .leftJoin("matches as converted_match", "fmr.converted_match_id", "converted_match.id")
      .where("cp.academy_id", academyId)
      .where((linked) => {
        linked.whereNull("fmr.converted_match_id").orWhere((activeMatch) => {
          activeMatch
            .whereNotNull("converted_match.id")
            .whereNull("converted_match.deleted_at");
        });
      })
      .modify((q) => {
        if (filters.coachId) q.where("fmr.coach_id", filters.coachId);
        if (filters.status) q.where("fmr.status", filters.status);
      })
      .select("fmr.*", "cp.full_name as coach_name", "ag.name as team_name")
      .leftJoin("academy_birth_years as aby", "fmr.birth_year_id", "aby.id")
      .select(
        this.db.raw(
          "COALESCE(aby.label, CONCAT(aby.from_year, '-', aby.to_year)) as birth_year_name",
        ),
      )
      .orderBy("fmr.created_at", "desc");
  }

  async findPlayersForBirthYears(
    academyId,
    birthYearIds,
    { playerIds = [], onlyComplete = false } = {},
  ) {
    if (!birthYearIds.length) return [];
    const birthYears = await this.findBirthYearsByIds(birthYearIds, academyId);
    if (!birthYears.length) return [];
    return this.db("player_profiles as pp")
      .where("pp.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .modify((q) => {
        if (playerIds.length) q.whereIn("pp.id", playerIds);
        if (onlyComplete) q.where("pp.profile_status", "complete");
      })
      .andWhere((scope) => {
        birthYears.forEach((row) => {
          scope.orWhere((birthScope) => {
            birthScope
              .where("pp.branch_id", row.branch_id)
              .whereRaw(
                "EXTRACT(YEAR FROM pp.date_of_birth)::int BETWEEN ? AND ?",
                [row.from_year, row.to_year],
              );
          });
        });
      })
      .distinct("pp.*")
      .orderBy("pp.full_name", "asc");
  }

  async usersForBirthYears(academyId, birthYearIds) {
    if (!birthYearIds.length) return { coaches: [], players: [], parents: [] };
    const [coaches, players] = await Promise.all([
      this.db("coach_profiles as cp")
        .join("coach_branch_access_rules as car", "car.coach_id", "cp.id")
        .leftJoin(
          "coach_access_rule_birth_years as carb",
          "carb.rule_id",
          "car.id",
        )
        .join("academy_birth_years as aby", "aby.branch_id", "car.branch_id")
        .where("cp.academy_id", academyId)
        .whereNotNull("cp.user_id")
        .whereIn("car.access_type", ["birth_years", "both"])
        .andWhere((q) => {
          q.where((selected) => {
            selected.whereIn("carb.birth_year_id", birthYearIds);
          }).orWhere((allBirthYears) => {
            allBirthYears
              .where("car.all_birth_years", true)
              .whereIn("aby.id", birthYearIds);
          });
        })
        .distinct("cp.user_id"),
      this.findPlayersForBirthYears(academyId, birthYearIds),
    ]);
    const playerUsers = players
      .filter((row) => row.user_id)
      .map((row) => ({ user_id: row.user_id, player_id: row.id }));
    const parents = players.length
      ? await this.parentUsersForPlayers(players.map((row) => row.id))
      : [];
    return { coaches, players: playerUsers, parents };
  }

  expireAdminMatchCoachRequests({ academyId, coachId } = {}) {
    return this.db("admin_match_coach_requests")
      .where("status", "pending")
      .where("expires_at", "<", this.db.fn.now())
      .modify((q) => {
        if (academyId) q.where("academy_id", academyId);
        if (coachId) q.where("coach_id", coachId);
      })
      .update({ status: "expired", updated_at: new Date() });
  }

  adminMatchCoachRequestsQuery(academyId, filters = {}) {
    return this.db("admin_match_coach_requests as amcr")
      .join("coach_profiles as cp", "amcr.coach_id", "cp.id")
      .leftJoin("academy_groups as ag", "amcr.selected_group_id", "ag.id")
      .leftJoin("matches as accepted_match", "amcr.created_match_id", "accepted_match.id")
      .leftJoin(
        "academy_birth_years as aby",
        "amcr.selected_birth_year_id",
        "aby.id",
      )
      .where("amcr.academy_id", academyId)
      .where((linked) => {
        linked.where("amcr.status", "<>", "accepted").orWhere((activeMatch) => {
          activeMatch
            .whereNotNull("amcr.created_match_id")
            .whereNotNull("accepted_match.id")
            .whereNull("accepted_match.deleted_at");
        });
      })
      .modify((q) => {
        if (filters.coachId) q.where("amcr.coach_id", filters.coachId);
        if (filters.status) q.where("amcr.status", filters.status);
      })
      .select(
        "amcr.*",
        "cp.full_name as coach_name",
        "cp.user_id as coach_user_id",
        "ag.name as selected_group_name",
        this.db.raw(
          "CASE WHEN aby.id IS NULL THEN NULL ELSE COALESCE(aby.label, CONCAT(aby.from_year, '-', aby.to_year)) END as selected_birth_year_name",
        ),
      )
      .orderBy("amcr.created_at", "desc");
  }

  async deleteStaleMatchRequests(academyId) {
    await this.db.raw(
      `
        DELETE FROM friendly_match_requests fmr
        USING coach_profiles cp
        WHERE fmr.coach_id = cp.id
          AND cp.academy_id = ?
          AND fmr.converted_match_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM matches m
            WHERE m.id = fmr.converted_match_id
              AND m.deleted_at IS NULL
          )
      `,
      [academyId],
    );

    await this.db.raw(
      `
        DELETE FROM admin_match_coach_requests amcr
        WHERE amcr.academy_id = ?
          AND amcr.status = 'accepted'
          AND (
            amcr.created_match_id IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM matches m
              WHERE m.id = amcr.created_match_id
                AND m.deleted_at IS NULL
            )
          )
      `,
      [academyId],
    );
  }

  findAdminMatchCoachRequestById(requestId, academyId) {
    return this.adminMatchCoachRequestsQuery(academyId, {})
      .where("amcr.id", requestId)
      .first();
  }

  evaluationEditRequestsQuery(academyId, filters = {}) {
    return this.db("match_evaluation_edit_requests as meer")
      .join("matches as m", "meer.match_id", "m.id")
      .join("coach_profiles as cp", "meer.coach_id", "cp.id")
      .where("meer.academy_id", academyId)
      .whereNull("m.deleted_at")
      .modify((q) => {
        if (filters.status) q.where("meer.status", filters.status);
        if (filters.coachId) q.where("meer.coach_id", filters.coachId);
        if (filters.matchId) q.where("meer.match_id", filters.matchId);
      })
      .select(
        "meer.*",
        "cp.full_name as coach_name",
        "cp.user_id as coach_user_id",
        "m.opponent_name",
        "m.match_date",
        "m.match_time",
        "m.evaluations_finalized_at",
      )
      .orderBy("meer.created_at", "desc");
  }

  findEvaluationEditRequestById(requestId, academyId) {
    return this.evaluationEditRequestsQuery(academyId, {})
      .where("meer.id", requestId)
      .first();
  }

  latestEvaluationEditRequest(matchId, coachId) {
    return this.db("match_evaluation_edit_requests as meer")
      .where("meer.match_id", matchId)
      .where("meer.coach_id", coachId)
      .orderBy("meer.created_at", "desc")
      .first();
  }

  activeEvaluationEditRequest(matchId, coachId, trx = this.db) {
    return trx("match_evaluation_edit_requests")
      .where({
        match_id: matchId,
        coach_id: coachId,
        status: "approved",
      })
      .whereNull("consumed_at")
      .where("expires_at", ">", trx.fn.now())
      .orderBy("approved_at", "desc")
      .first();
  }

  async listCoachGroupAssignments(academyId, pagination) {
    const query = this.db("coach_group_assignments as cga")
      .join("coach_profiles as cp", "cga.coach_id", "cp.id")
      .join("academy_groups as ag", "cga.group_id", "ag.id")
      .join("academy_branches as ab", "ag.branch_id", "ab.id")
      .where("cp.academy_id", academyId)
      .where("ab.academy_id", academyId)
      .select(
        "cga.*",
        "cp.full_name as coach_name",
        "ag.name as group_name",
        "ab.name as branch_name",
      )
      .orderBy("cp.full_name", "asc");
    return this.paginate(query, pagination, "cga.id");
  }

  async listPlayerOptions(academyId, fieldKey) {
    return this.db("player_field_options")
      .where({ academy_id: academyId })
      .whereNull("deleted_at")
      .modify((q) => {
        if (fieldKey) q.where("field_key", fieldKey);
      })
      .orderBy("field_key", "asc")
      .orderBy("label", "asc");
  }

  async createNotifications(rows, trx = this.db) {
    if (!rows.length) return [];
    const created = await trx("notification_inbox").insert(rows).returning("*");
    emitNotifications(created);
    return created;
  }

  async adminUsers(academyId) {
    return this.db("admin_accounts as aa")
      .join("auth_users as au", "aa.user_id", "au.id")
      .where("aa.academy_id", academyId)
      .where("aa.is_active", true)
      .whereNull("au.deleted_at")
      .select("au.id as user_id");
  }

  async usersForGroups(groupIds) {
    if (!groupIds.length) return { coaches: [], players: [], parents: [] };
    const [coaches, players, groupPlayers] = await Promise.all([
      this.db("coach_group_assignments as cga")
        .join("coach_profiles as cp", "cga.coach_id", "cp.id")
        .whereIn("cga.group_id", groupIds)
        .whereNotNull("cp.user_id")
        .select("cp.user_id"),
      this.db("player_group_assignments as pga")
        .join("player_profiles as pp", "pga.player_id", "pp.id")
        .whereIn("pga.group_id", groupIds)
        .whereNull("pga.left_at")
        .whereNotNull("pp.user_id")
        .select("pp.user_id", "pp.id as player_id"),
      this.db("player_group_assignments as pga")
        .whereIn("pga.group_id", groupIds)
        .whereNull("pga.left_at")
        .distinct("pga.player_id"),
    ]);
    const parents = await this.parentUsersForPlayers(
      groupPlayers.map((row) => row.player_id),
    );
    return { coaches, players, parents };
  }
}

module.exports = CalendarRepository;
