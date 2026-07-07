const eventBus = require("../../events/eventBus");
const ACADEMY_EVENTS = require("./academy.events");
const env = require("../../config/env");
const { redis } = require("../../infrastructure/redis");
const {
  bumpCacheVersion,
  getCacheVersion,
  getJsonCache,
  setJsonCache,
} = require("../../shared/redis-json-cache");
const {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} = require("../../shared/errors");

const normalizeLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const deriveLabel = (label, fromYear, toYear) => {
  if (label && String(label).trim()) return String(label).trim();
  if (fromYear === toYear) return String(fromYear);
  return `${fromYear}-${toYear}`;
};

const normalizeAcademySettings = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const settings = { ...value };
  delete settings.timezone;

  const matchDayOpenMinutes =
    settings.matchDayOpenMinutesBeforeKickoff ??
    settings.match_day_open_minutes_before_kickoff;
  if (matchDayOpenMinutes !== undefined) {
    const parsedMinutes = Number(matchDayOpenMinutes);
    if (!Number.isFinite(parsedMinutes)) {
      throw new BadRequestError(
        "Match Day open time must be a valid number of minutes",
      );
    }
    settings.matchDayOpenMinutesBeforeKickoff = Math.max(
      0,
      Math.min(240, Math.round(parsedMinutes)),
    );
    delete settings.match_day_open_minutes_before_kickoff;
  }

  return settings;
};

const branchesVersionKey = (academyId) =>
  `goalix:academy:${academyId}:branches:v`;
const branchesCacheKey = (academyId, version, { page = 1, limit = 20 } = {}) =>
  `goalix:academy:${academyId}:branches:v${version}:p${page}:l${limit}`;

class AcademyService {
  constructor(academyRepository) {
    this.repo = academyRepository;
  }

  // ─── Academy ────────────────────────────────────────────────────────
  async getAcademy(academyId) {
    const academy = await this.repo.findById(academyId);
    if (!academy) throw new NotFoundError("Academy", academyId);
    return academy;
  }

  async getPublicAcademyProfile() {
    const academy = await this.repo.findPublicAcademyProfile();
    if (!academy) throw new NotFoundError("Academy profile");

    const settings =
      academy.settings && typeof academy.settings === "object"
        ? academy.settings
        : {};
    const socialLinks =
      settings.socialLinks && typeof settings.socialLinks === "object"
        ? settings.socialLinks
        : {};

    return {
      name: academy.name,
      email: academy.email || null,
      phone: academy.phone || null,
      address: academy.address || null,
      logoUrl: academy.logo_url || null,
      socialLinks: {
        facebook:
          typeof socialLinks.facebook === "string" ? socialLinks.facebook : "",
        instagram:
          typeof socialLinks.instagram === "string"
            ? socialLinks.instagram
            : "",
        twitter:
          typeof socialLinks.twitter === "string" ? socialLinks.twitter : "",
        linkedin:
          typeof socialLinks.linkedin === "string" ? socialLinks.linkedin : "",
      },
    };
  }

  async updateAcademy(academyId, data) {
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.logoUrl !== undefined) updateData.logo_url = data.logoUrl;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.settings !== undefined)
      updateData.settings = normalizeAcademySettings(data.settings);

    const academy = await this.repo.update(academyId, updateData);
    if (!academy) throw new NotFoundError("Academy", academyId);

    eventBus.publish(ACADEMY_EVENTS.UPDATED, { academyId });
    return academy;
  }

  // ─── Branches ───────────────────────────────────────────────────────
  async getBranches(academyId, pagination, actor = null) {
    if (actor?.role === "coach") {
      return this.repo.findBranchesForCoachUser(
        actor.userId,
        academyId,
        pagination,
      );
    }

    const version = await getCacheVersion(redis, branchesVersionKey(academyId));
    const cacheKey = branchesCacheKey(academyId, version, pagination);
    const cached = await getJsonCache(redis, cacheKey);
    if (cached !== undefined) return cached;

    const result = await this.repo.findBranches(academyId, pagination);
    await setJsonCache(
      redis,
      cacheKey,
      result,
      env.ACADEMY_BRANCHES_CACHE_TTL_SECONDS,
    );
    return result;
  }

  async getBranch(id, academyId) {
    const branch = await this.repo.findBranchById(id);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("Branch", id);
    return branch;
  }

  async createBranch(academyId, data) {
    const insertData = {
      academy_id: academyId,
      name: data.name,
      address: data.address,
    };
    if (data.city !== undefined) insertData.city = data.city;
    if (data.capacity !== undefined) insertData.capacity = data.capacity;
    if (data.isActive !== undefined) insertData.is_active = data.isActive;

    const branch = await this.repo.createBranch(insertData);

    eventBus.publish(ACADEMY_EVENTS.BRANCH_CREATED, {
      branchId: branch.id,
      academyId,
      name: branch.name,
    });
    await bumpCacheVersion(redis, branchesVersionKey(academyId));

    return branch;
  }

  async updateBranch(id, academyId, data) {
    const branch = await this.repo.findBranchById(id);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("Branch", id);

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const updated = await this.repo.updateBranch(id, updateData);

    eventBus.publish(ACADEMY_EVENTS.BRANCH_UPDATED, {
      branchId: id,
      academyId,
    });
    await bumpCacheVersion(redis, branchesVersionKey(academyId));
    return updated;
  }

  async deleteBranch(id, academyId) {
    const branch = await this.repo.findBranchById(id);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("Branch", id);

    const activeRelations = await this.repo.getBranchActiveRelations(id);
    if (activeRelations.length > 0) {
      throw new BadRequestError(
        "Cannot delete this branch because it has active related data.",
        [
          {
            reason: "BRANCH_HAS_ACTIVE_RELATIONS",
            blockers: activeRelations,
            solution:
              "Move or delete the related birth years, groups, coaches, players, attendance sessions, and matches first. If you only want to hide the branch, mark it inactive instead of deleting it.",
          },
        ],
      );
    }

    await this.repo.softDeleteBranch(id);
    eventBus.publish(ACADEMY_EVENTS.BRANCH_DELETED, {
      branchId: id,
      academyId,
    });
    await bumpCacheVersion(redis, branchesVersionKey(academyId));
  }

  // ─── Groups ─────────────────────────────────────────────────────────
  async getGroups(branchId, academyId, pagination, actor = null) {
    // Verify the branch belongs to this academy before returning its groups
    const branch = await this.repo.findBranchById(branchId);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("Branch", branchId);
    if (actor?.role === "coach") {
      return this.repo.findGroupsForCoachUser(actor.userId, academyId, {
        ...pagination,
        branchId,
      });
    }
    return this.repo.findGroupsByBranch(branchId, pagination);
  }

  async getAllGroups(academyId, filters, actor = null) {
    if (actor?.role === "coach") {
      return this.repo.findGroupsForCoachUser(actor.userId, academyId, filters);
    }
    return this.repo.findGroups(academyId, filters);
  }

  async getGroup(id) {
    const group = await this.repo.findGroupById(id);
    if (!group) throw new NotFoundError("Group", id);
    return group;
  }

  async createGroup(academyId, data) {
    // Verify the target branch belongs to this academy
    const branch = await this.repo.findBranchById(data.branchId);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("Branch", data.branchId);

    const assignmentMode = data.assignmentMode || "birth_year";
    const playerIds = await this._resolveGroupPlayerIds(data.branchId, data);
    const birthYearIds =
      assignmentMode === "players" &&
      !data.birthYearIds?.length &&
      !data.birthYearId &&
      !data.labels?.length
        ? []
        : await this._resolveGroupBirthYearIds(data.branchId, data);
    const birthYears = await this.repo.findBirthYearsByIds(
      data.branchId,
      birthYearIds,
    );
    const normalizedLabels = [
      ...new Set(birthYears.map((row) => row.normalized_label).filter(Boolean)),
    ];

    const group = await this.repo.db.transaction(async (trx) => {
      const [created] = await trx("academy_groups")
        .insert({
          branch_id: data.branchId,
          name: data.name,
          description: data.description || null,
          max_players: data.maxPlayers,
          assignment_mode: assignmentMode,
        })
        .returning("*");
      await this.repo.replaceGroupBirthYears(created.id, birthYearIds, trx);
      await this.repo.replaceGroupLabels(created.id, normalizedLabels, trx);
      if (playerIds.length) {
        await this.repo.replaceGroupPlayers(created.id, playerIds, trx);
      }
      return created;
    });

    eventBus.publish(ACADEMY_EVENTS.GROUP_CREATED, {
      groupId: group.id,
      branchId: data.branchId,
      birthYearIds,
    });

    return group;
  }

  async updateGroup(id, academyId, data) {
    const group = await this.repo.findGroupById(id);
    if (!group) throw new NotFoundError("Group", id);

    // Verify the group’s branch belongs to this academy
    const branch = await this.repo.findBranchById(group.branch_id);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("Group", id);

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description || null;
    if (data.maxPlayers !== undefined) updateData.max_players = data.maxPlayers;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.assignmentMode !== undefined)
      updateData.assignment_mode = data.assignmentMode;

    const shouldUpdateBirthYears =
      data.birthYearIds !== undefined ||
      data.birthYearId !== undefined ||
      data.labels !== undefined;
    const birthYearIds = shouldUpdateBirthYears
      ? await this._resolveGroupBirthYearIds(group.branch_id, data)
      : null;
    const birthYears = birthYearIds
      ? await this.repo.findBirthYearsByIds(group.branch_id, birthYearIds)
      : [];
    const normalizedLabels = [
      ...new Set(birthYears.map((row) => row.normalized_label).filter(Boolean)),
    ];

    const shouldUpdatePlayers =
      data.playerIds !== undefined ||
      data.playerCodeFrom !== undefined ||
      data.playerCodeTo !== undefined;
    const playerIds = shouldUpdatePlayers
      ? await this._resolveGroupPlayerIds(group.branch_id, data)
      : null;

    const updated = await this.repo.db.transaction(async (trx) => {
      let row = group;
      if (Object.keys(updateData).length) {
        [row] = await trx("academy_groups")
          .where({ id })
          .whereNull("deleted_at")
          .update({ ...updateData, updated_at: new Date() })
          .returning("*");
      }

      if (birthYearIds) {
        await this.repo.replaceGroupBirthYears(id, birthYearIds, trx);
        await this.repo.replaceGroupLabels(id, normalizedLabels, trx);
      }

      if (playerIds) {
        await this.repo.replaceGroupPlayers(id, playerIds, trx);
      }

      return row;
    });

    eventBus.publish(ACADEMY_EVENTS.GROUP_UPDATED, { groupId: id });
    return updated;
  }

  async deleteGroup(id, academyId) {
    const group = await this.repo.findGroupById(id);
    if (!group) throw new NotFoundError("Group", id);

    // Verify the group’s branch belongs to this academy
    const branch = await this.repo.findBranchById(group.branch_id);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("Group", id);

    const hasRelations = await this.repo.groupHasActiveRelations(id);
    if (hasRelations) {
      throw new BadRequestError(
        "Cannot delete a group with active players, sessions, or matches",
      );
    }

    await this.repo.softDeleteGroup(id);
    await this.repo.clearGroupLabels(id);
    eventBus.publish(ACADEMY_EVENTS.GROUP_DELETED, { groupId: id });
  }

  // ─── Birth Years ────────────────────────────────────────────────────
  async getBirthYears(branchId, academyId, actor = null) {
    // Verify branch belongs to this academy before exposing its birth years
    const branch = await this.repo.findBranchById(branchId);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("Branch", branchId);
    if (actor?.role === "coach") {
      const scopedBranches = await this.repo.findBranchesForCoachUser(
        actor.userId,
        academyId,
        { limit: 500 },
      );
      if (!scopedBranches.data.some((item) => item.id === branchId)) {
        throw new ForbiddenError("Coach can only access assigned branches");
      }
    }
    const rows = await this.repo.findBirthYears(branchId);
    const grouped = new Map();

    rows.forEach((row) => {
      const key = row.normalized_label;
      if (!grouped.has(key)) {
        grouped.set(key, {
          label: row.label,
          normalizedLabel: row.normalized_label,
          birthYears: [],
        });
      }
      grouped.get(key).birthYears.push({
        id: row.id,
        fromYear: row.from_year,
        toYear: row.to_year,
        createdByRole: row.created_by_role || "admin",
        createdByUserId: row.created_by_user_id || null,
        createdByCoachId: row.created_by_coach_id || null,
        createdByName:
          row.created_by_name ||
          (row.created_by_role === "coach" ? "Coach" : "Admin"),
      });
    });

    return Array.from(grouped.values()).map((group) => ({
      ...group,
      birthYears: group.birthYears.sort((a, b) => a.fromYear - b.fromYear),
    }));
  }

  async getBirthYearDetail(id, academyId, actor = null) {
    const detail = await this.repo.findBirthYearDetail(id);
    if (!detail || (academyId && detail.birthYear.academy_id !== academyId)) {
      throw new NotFoundError("BirthYear", id);
    }
    if (actor?.role === "coach") {
      const scopedBranches = await this.repo.findBranchesForCoachUser(
        actor.userId,
        academyId,
        { limit: 500 },
      );
      if (
        !scopedBranches.data.some(
          (item) => item.id === detail.birthYear.branch_id,
        )
      ) {
        throw new ForbiddenError("Coach can only access assigned branches");
      }
    }

    return {
      id: detail.birthYear.id,
      branchId: detail.birthYear.branch_id,
      branchName: detail.birthYear.branch_name,
      label: detail.birthYear.label,
      normalizedLabel: detail.birthYear.normalized_label,
      fromYear: detail.birthYear.from_year,
      toYear: detail.birthYear.to_year,
      createdByRole: detail.birthYear.created_by_role || "admin",
      createdByUserId: detail.birthYear.created_by_user_id || null,
      createdByCoachId: detail.birthYear.created_by_coach_id || null,
      createdByName:
        detail.birthYear.created_by_name ||
        (detail.birthYear.created_by_role === "coach" ? "Coach" : "Admin"),
      groups: detail.groups,
      players: detail.players,
      coaches: detail.coaches.map((coach) => ({
        ...coach,
        full_name:
          coach.full_name ||
          [coach.first_name, coach.last_name].filter(Boolean).join(" "),
      })),
    };
  }

  async createBirthYear(data, academyId, creator = null) {
    // Verify the target branch belongs to this academy before creating
    const branch = await this.repo.findBranchById(data.branchId);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("Branch", data.branchId);

    const label = deriveLabel(data.label, data.fromYear, data.toYear);
    const normalizedLabel = normalizeLabel(label);

    const overlap = await this.repo.findBirthYearOverlap(
      data.branchId,
      data.fromYear,
      data.toYear,
    );
    if (overlap) {
      throw new ConflictError(
        "Birth year range overlaps an existing range in this branch",
      );
    }

    const birthYear = await this.repo.createBirthYear({
      branch_id: data.branchId,
      label,
      normalized_label: normalizedLabel,
      from_year: data.fromYear,
      to_year: data.toYear,
      created_by_role: creator?.role === "coach" ? "coach" : "admin",
      created_by_user_id: creator?.userId || null,
      created_by_coach_id:
        creator?.role === "coach" ? creator.coachId || null : null,
    });

    eventBus.publish(ACADEMY_EVENTS.BIRTH_YEAR_CREATED, {
      birthYearId: birthYear.id,
      branchId: data.branchId,
      label,
    });

    return birthYear;
  }

  async updateBirthYear(id, data, academyId) {
    const birthYear = await this.repo.findBirthYearById(id);
    if (!birthYear) throw new NotFoundError("BirthYear", id);

    const branch = await this.repo.findBranchById(birthYear.branch_id);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("BirthYear", id);

    const fromYear = data.fromYear ?? birthYear.from_year;
    const toYear = data.toYear ?? birthYear.to_year;
    const label = deriveLabel(data.label ?? birthYear.label, fromYear, toYear);
    const normalizedLabel = normalizeLabel(label);

    const overlap = await this.repo.findBirthYearOverlap(
      birthYear.branch_id,
      fromYear,
      toYear,
      id,
    );
    if (overlap) {
      throw new ConflictError(
        "Birth year range overlaps an existing range in this branch",
      );
    }

    return this.repo.updateBirthYear(id, {
      label,
      normalized_label: normalizedLabel,
      from_year: fromYear,
      to_year: toYear,
    });
  }

  async deleteBirthYear(id, academyId, data = {}) {
    const birthYear = await this.repo.findBirthYearById(id);
    if (!birthYear) throw new NotFoundError("BirthYear", id);

    const branch = await this.repo.findBranchById(birthYear.branch_id);
    if (!branch || (academyId && branch.academy_id !== academyId))
      throw new NotFoundError("BirthYear", id);

    const detail = await this.repo.findBirthYearDetail(id);
    const affectedPlayers = detail?.players || [];
    if (affectedPlayers.length) {
      if (!data.transferBirthYearId) {
        throw new BadRequestError(
          "This birth year has players. Transfer them to another birth year before deleting.",
        );
      }
      if (data.transferBirthYearId === id) {
        throw new BadRequestError(
          "Transfer birth year must be different from the deleted birth year",
        );
      }

      const targetBirthYear = await this.repo.findBirthYearById(
        data.transferBirthYearId,
      );
      if (
        !targetBirthYear ||
        targetBirthYear.branch_id !== birthYear.branch_id
      ) {
        throw new BadRequestError(
          "Transfer birth year must exist in the same branch",
        );
      }

      const movedBirthYears = affectedPlayers
        .map((player) => new Date(player.date_of_birth).getFullYear())
        .filter((year) => Number.isInteger(year));
      if (!movedBirthYears.length) {
        throw new BadRequestError(
          "Players must have valid birth dates before transfer",
        );
      }

      const nextFromYear = Math.min(
        targetBirthYear.from_year,
        ...movedBirthYears,
      );
      const nextToYear = Math.max(targetBirthYear.to_year, ...movedBirthYears);
      const overlap = await this.repo.findBirthYearOverlap(
        birthYear.branch_id,
        nextFromYear,
        nextToYear,
        [targetBirthYear.id, birthYear.id],
      );
      if (overlap) {
        throw new ConflictError(
          "Transfer would make the target birth year overlap another active range",
        );
      }

      await this.repo.db.transaction(async (trx) => {
        await this.repo.updateBirthYearRange(
          targetBirthYear.id,
          {
            fromYear: nextFromYear,
            toYear: nextToYear,
          },
          trx,
        );
        await this.repo.moveBirthYearGroupLinks(id, targetBirthYear.id, trx);
        await trx("academy_birth_years")
          .where({ id })
          .whereNull("deleted_at")
          .update({ deleted_at: new Date(), updated_at: new Date() });
      });
      return;
    }

    const hasRelations = await this.repo.birthYearHasActiveRelations(
      birthYear.branch_id,
      birthYear.normalized_label,
    );
    if (hasRelations) {
      throw new BadRequestError(
        "Cannot delete birth year label with active players, sessions, or matches",
      );
    }

    await this.repo.softDeleteBirthYear(id);
  }

  async _resolveGroupBirthYearIds(branchId, data) {
    const requestedIds = [
      ...(Array.isArray(data.birthYearIds) ? data.birthYearIds : []),
      ...(data.birthYearId ? [data.birthYearId] : []),
    ];

    if (requestedIds.length) {
      const ids = [...new Set(requestedIds)];
      const rows = await this.repo.findBirthYearsByIds(branchId, ids);
      if (rows.length !== ids.length) {
        throw new BadRequestError(
          "All group birth years must exist in the selected branch",
        );
      }
      return ids;
    }

    const rawLabels = Array.isArray(data.labels) ? data.labels : [];
    const normalizedLabels = [
      ...new Set(rawLabels.map(normalizeLabel).filter(Boolean)),
    ];
    if (!normalizedLabels.length) {
      throw new BadRequestError(
        "At least one birth year is required for a group",
      );
    }

    const rows = await this.repo.findBirthYearsByLabels(
      branchId,
      normalizedLabels,
    );
    if (
      !rows.length ||
      new Set(rows.map((row) => row.normalized_label)).size !==
        normalizedLabels.length
    ) {
      throw new BadRequestError(
        "One or more labels do not exist for this branch",
      );
    }
    return rows.map((row) => row.id);
  }

  async _resolveGroupPlayerIds(branchId, data) {
    const requestedIds = [
      ...new Set(Array.isArray(data.playerIds) ? data.playerIds : []),
    ];
    const rangeRows =
      data.playerCodeFrom && data.playerCodeTo
        ? await this.repo.findPlayersByCodeRange(
            branchId,
            data.playerCodeFrom,
            data.playerCodeTo,
          )
        : [];
    const ids = [
      ...new Set([...requestedIds, ...rangeRows.map((row) => row.id)]),
    ];

    if (!ids.length) return [];

    const rows = await this.repo.findPlayersByIds(branchId, ids);
    if (rows.length !== ids.length) {
      throw new BadRequestError(
        "All group players must exist in the selected branch",
      );
    }
    if ((data.playerCodeFrom || data.playerCodeTo) && !rangeRows.length) {
      throw new BadRequestError(
        "No players were found in the selected player ID range",
      );
    }
    return ids;
  }

  // ─── Schedules ──────────────────────────────────────────────────────
  async getSchedules(groupId) {
    return this.repo.findSchedulesByGroup(groupId);
  }

  async createSchedule(data) {
    return this.repo.createSchedule({
      group_id: data.groupId,
      day_of_week: data.dayOfWeek,
      start_time: data.startTime,
      end_time: data.endTime,
      location: data.location,
    });
  }
}

module.exports = AcademyService;
