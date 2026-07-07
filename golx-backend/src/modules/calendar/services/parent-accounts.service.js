const bcrypt = require("bcrypt");
const env = require("../../../config/env");
const {
  ConflictError,
  NotFoundError,
} = require("../../../shared/errors");

class ParentAccountsService {
  constructor(
    repository,
    {
      getCoach,
      ensureCoachCanAccessPlayers,
      managedPlayerDetail,
      resolveQrPlayer,
    },
    {
      hashPassword = (password) => bcrypt.hash(password, env.BCRYPT_ROUNDS),
    } = {},
  ) {
    this.repo = repository;
    this.getCoach = getCoach;
    this.ensureCoachCanAccessPlayers = ensureCoachCanAccessPlayers;
    this.managedPlayerDetail = managedPlayerDetail;
    this.resolveQrPlayer = resolveQrPlayer;
    this.hashPassword = hashPassword;
  }

  listLinks(academyId, filters = {}) {
    return this.repo.listAdminParentLinks(academyId, filters);
  }

  listAccounts(academyId, filters = {}) {
    return this.repo.listAdminParentAccounts(academyId, filters);
  }

  listLinkablePlayers(academyId, filters = {}) {
    return this.repo.listAdminLinkablePlayers(academyId, filters);
  }

  async getProfile(academyId, parentUserId, playerIds = null) {
    const parent = await this.repo.findParentAccountById(
      parentUserId,
      academyId,
    );
    if (!parent) throw new NotFoundError("Parent account", parentUserId);

    const links = await this.repo.listAdminParentLinks(academyId, {
      parentUserId,
      ...(Array.isArray(playerIds) ? { playerIds } : {}),
      page: 1,
      limit: 500,
    });
    const children = await Promise.all(
      links.data.map((link) =>
        this.managedPlayerDetail(academyId, link.player_id),
      ),
    );
    return { parent, links: links.data, children };
  }

  async scopedCoachPlayerIds(userId, academyId) {
    const coach = await this.getCoach(userId, academyId);
    const players = await this.repo.findCoachScopedPlayers(
      coach.id,
      academyId,
    );
    return {
      coach,
      playerIds: players.map((player) => player.id),
    };
  }

  emptyPage(filters = {}) {
    return {
      data: [],
      total: 0,
      page: filters.page || 1,
      totalPages: 1,
    };
  }

  async createAccount(academyId, actorUserId, data) {
    const username = data.username.trim().toLowerCase();
    const phone = data.phone.trim();

    const conflict = await this.repo.findParentIdentityConflict({
      username,
      phone,
    });
    if (conflict) {
      throw new ConflictError(
        `${conflict.field} is already used by another user. Choose a different ${conflict.field}.`,
      );
    }

    try {
      const passwordHash = await this.hashPassword(data.password);
      const parent = await this.repo.createParentAccount({
        academyId,
        actorUserId,
        fullName: data.fullName.trim(),
        username,
        phone,
        passwordHash,
        address: data.address.trim(),
      });

      return {
        ...parent,
        relationship: data.relationship || "guardian",
      };
    } catch (error) {
      if (error.code === "23505") {
        throw new ConflictError(
          "User with this username or phone already exists",
        );
      }
      throw error;
    }
  }

  async createLink(academyId, actorUserId, data) {
    const [parent, player] = await Promise.all([
      this.repo.findParentUser(data.parentUserId, academyId),
      this.repo.findPlayerForParentLink(data.playerId, academyId),
    ]);

    if (!parent) {
      throw new NotFoundError("Parent account", data.parentUserId);
    }
    if (!player) throw new NotFoundError("Player", data.playerId);

    const existing = await this.repo.listAdminParentLinks(academyId, {
      parentUserId: data.parentUserId,
      playerId: data.playerId,
      page: 1,
      limit: 1,
    });
    if (existing.total > 0) {
      throw new ConflictError("This parent is already linked to this player");
    }

    return this.repo.createParentPlayerLink({
      academy_id: academyId,
      parent_user_id: data.parentUserId,
      player_id: data.playerId,
      relation: data.relation || "guardian",
      is_primary: Boolean(data.isPrimary),
      can_view_progress: data.canViewProgress !== false,
      can_view_payments: data.canViewPayments !== false,
      can_message_coach: data.canMessageCoach !== false,
      created_by_user_id: actorUserId,
    });
  }

  async createLinkByQr(academyId, actorUserId, data) {
    const player = await this.resolveQrPlayer(academyId, data);
    return this.createLink(academyId, actorUserId, {
      ...data,
      playerId: player.id,
    });
  }

  async updateLink(academyId, linkId, data) {
    const link = await this.repo.findParentPlayerLink(linkId, academyId);
    if (!link) throw new NotFoundError("Parent link", linkId);

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(data, "relation")) {
      patch.relation = data.relation || "guardian";
    }
    if (Object.prototype.hasOwnProperty.call(data, "isPrimary")) {
      patch.is_primary = Boolean(data.isPrimary);
    }
    if (Object.prototype.hasOwnProperty.call(data, "canViewProgress")) {
      patch.can_view_progress = Boolean(data.canViewProgress);
    }
    if (Object.prototype.hasOwnProperty.call(data, "canViewPayments")) {
      patch.can_view_payments = Boolean(data.canViewPayments);
    }
    if (Object.prototype.hasOwnProperty.call(data, "canMessageCoach")) {
      patch.can_message_coach = Boolean(data.canMessageCoach);
    }

    return this.repo.updateParentPlayerLink(linkId, academyId, patch);
  }

  async deleteLink(academyId, linkId) {
    const deleted = await this.repo.deleteParentPlayerLink(linkId, academyId);
    if (!deleted) throw new NotFoundError("Parent link", linkId);
    return { deleted: true, id: linkId };
  }

  async coachListLinks(userId, academyId, filters = {}) {
    const { playerIds } = await this.scopedCoachPlayerIds(userId, academyId);
    if (!playerIds.length) return this.emptyPage(filters);
    return this.listLinks(academyId, { ...filters, playerIds });
  }

  async coachListAccounts(userId, academyId, filters = {}) {
    await this.getCoach(userId, academyId);
    return this.listAccounts(academyId, filters);
  }

  async coachListLinkablePlayers(userId, academyId, filters = {}) {
    const { playerIds } = await this.scopedCoachPlayerIds(userId, academyId);
    if (!playerIds.length) return this.emptyPage(filters);
    return this.listLinkablePlayers(academyId, { ...filters, playerIds });
  }

  async coachGetProfile(userId, academyId, parentUserId) {
    const { playerIds } = await this.scopedCoachPlayerIds(userId, academyId);
    return this.getProfile(academyId, parentUserId, playerIds);
  }

  async coachCreateAccount(userId, academyId, data) {
    await this.getCoach(userId, academyId);
    return this.createAccount(academyId, userId, data);
  }

  async coachCreateLink(userId, academyId, data) {
    const coach = await this.getCoach(userId, academyId);
    await this.ensureCoachCanAccessPlayers(coach, academyId, [data.playerId]);
    return this.createLink(academyId, userId, data);
  }

  async coachCreateLinkByQr(userId, academyId, data) {
    const coach = await this.getCoach(userId, academyId);
    const player = await this.resolveQrPlayer(academyId, data);
    await this.ensureCoachCanAccessPlayers(coach, academyId, [player.id]);
    return this.createLink(academyId, userId, {
      ...data,
      playerId: player.id,
    });
  }

  async coachUpdateLink(userId, academyId, linkId, data) {
    const coach = await this.getCoach(userId, academyId);
    const link = await this.repo.findParentPlayerLink(linkId, academyId);
    if (!link) throw new NotFoundError("Parent link", linkId);
    await this.ensureCoachCanAccessPlayers(coach, academyId, [link.player_id]);
    return this.updateLink(academyId, linkId, data);
  }

  async coachDeleteLink(userId, academyId, linkId) {
    const coach = await this.getCoach(userId, academyId);
    const link = await this.repo.findParentPlayerLink(linkId, academyId);
    if (!link) throw new NotFoundError("Parent link", linkId);
    await this.ensureCoachCanAccessPlayers(coach, academyId, [link.player_id]);
    return this.deleteLink(academyId, linkId);
  }
}

module.exports = ParentAccountsService;
