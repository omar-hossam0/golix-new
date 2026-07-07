const BaseRepository = require("../../shared/base.repository");
const {
  emitNotificationRead,
  emitNotifications,
  emitNotificationsReadAll,
} = require("../../realtime/chat.realtime");

class NotificationsRepository extends BaseRepository {
  constructor(db) {
    super("notification_inbox", db, { hasSoftDelete: false });
  }

  async _notificationPlayer(user) {
    if (user?.role === "player") {
      return this.db("player_profiles")
        .where({ user_id: user.userId })
        .whereNull("deleted_at")
        .first("id", "branch_id", "date_of_birth");
    }

    if (user?.role === "parent") {
      const linkedPlayerId =
        user.linkedPlayerId ||
        (
          await this.db("auth_users")
            .where({ id: user.userId })
            .whereNull("deleted_at")
            .first("linked_player_id")
        )?.linked_player_id;

      if (!linkedPlayerId) return null;
      return this.db("player_profiles")
        .where({ id: linkedPlayerId })
        .whereNull("deleted_at")
        .first("id", "branch_id", "date_of_birth");
    }

    return null;
  }

  _applyMatchVisibility(query, player) {
    if (!player?.id) {
      query.where("notification_inbox.type", "<>", "match");
      return query;
    }

    const db = this.db;
    const notificationMatchId =
      "COALESCE(notification_inbox.data->'match'->>'id', notification_inbox.data->>'matchId')";

    query.andWhere((visibility) => {
      visibility
        .where("notification_inbox.type", "<>", "match")
        .orWhereExists(function visibleMatchNotification() {
          this.select(db.raw("1"))
            .from("matches as m")
            .whereRaw(`${notificationMatchId} IS NOT NULL`)
            .whereRaw(`m.id::text = ${notificationMatchId}`)
            .whereNull("m.deleted_at")
            .whereExists(function hasTactics() {
              this.select(db.raw("1"))
                .from("match_tactics as mt")
                .whereRaw("mt.match_id = m.id");
            })
            .andWhere(function playerTargeted() {
              this.whereExists(function playerGroupTargeted() {
                this.select(db.raw("1"))
                  .from("player_group_assignments as pga")
                  .leftJoin(
                    "calendar_event_groups as ceg",
                    "ceg.event_id",
                    "m.event_id",
                  )
                  .where("pga.player_id", player.id)
                  .whereNull("pga.left_at")
                  .andWhere(function groupMatches() {
                    this.whereRaw("pga.group_id = m.team_id")
                      .orWhereRaw("pga.group_id = m.age_group_id")
                      .orWhereRaw("pga.group_id = ceg.group_id");
                  });
              });

              if (player.branch_id && player.date_of_birth) {
                this.orWhereExists(function playerBirthYearTargeted() {
                  this.select(db.raw("1"))
                    .from("calendar_event_birth_years as ceby")
                    .join(
                      "academy_birth_years as aby",
                      "aby.id",
                      "ceby.birth_year_id",
                    )
                    .whereRaw("ceby.event_id = m.event_id")
                    .where("aby.branch_id", player.branch_id)
                    .whereNull("aby.deleted_at")
                    .whereRaw(
                      "EXTRACT(YEAR FROM ?::date)::int BETWEEN aby.from_year AND aby.to_year",
                      [player.date_of_birth],
                    );
                });
              }

              this.orWhereExists(function playerInSquad() {
                this.select(db.raw("1"))
                  .from("match_squads as ms")
                  .whereRaw("ms.match_id = m.id")
                  .where("ms.player_id", player.id);
              });
            });
        });
    });

    return query;
  }

  async _baseUserQuery(
    userId,
    { isRead, type } = {},
    userContext = null,
    sourceTable = "notification_inbox",
  ) {
    const query = this.db(`${sourceTable} as notification_inbox`)
      .where({ user_id: userId })
      .modify((q) => {
        if (isRead !== undefined) q.where("is_read", isRead === "true");
        if (type) q.where("type", type);
      });

    if (["player", "parent"].includes(userContext?.role)) {
      const player = await this._notificationPlayer(userContext);
      this._applyMatchVisibility(query, player);
    }

    return { query };
  }

  async findByUser(
    userId,
    { isRead, type, page = 1, limit = 20, includeArchive = false } = {},
    userContext = null,
  ) {
    const { query } = await this._baseUserQuery(
      userId,
      { isRead, type },
      userContext,
    );

    if (
      includeArchive &&
      (await this.db.schema.hasTable("notification_inbox_archive"))
    ) {
      const { query: archiveQuery } = await this._baseUserQuery(
        userId,
        { isRead, type },
        userContext,
        "notification_inbox_archive",
      );
      const [{ count: hotCount }] = await query.clone().count("id as count");
      const [{ count: archiveCount }] = await archiveQuery
        .clone()
        .count("id as count");
      const readLimit = page * limit;
      const [hotRows, archiveRows] = await Promise.all([
        query.clone().orderBy("created_at", "desc").limit(readLimit),
        archiveQuery.clone().orderBy("created_at", "desc").limit(readLimit),
      ]);
      const data = [...hotRows, ...archiveRows]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice((page - 1) * limit, page * limit);
      const total = Number(hotCount || 0) + Number(archiveCount || 0);
      return { data, total, page, totalPages: Math.ceil(total / limit) || 1 };
    }

    const [{ count }] = await query.clone().count("id as count");
    const data = await query
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      data,
      total: +count,
      page,
      totalPages: Math.ceil(+count / limit) || 1,
    };
  }

  async createNotification(data) {
    const [row] = await this.db("notification_inbox")
      .insert(data)
      .returning("*");
    emitNotifications([row]);
    return row;
  }

  async createBulk(rows) {
    const created = await this.db("notification_inbox")
      .insert(rows)
      .returning("*");
    emitNotifications(created);
    return created;
  }

  async createBulkWithLogs(rows, channel) {
    if (!rows.length) return [];

    const created = await this.db.transaction(async (trx) => {
      const notifications = await trx("notification_inbox")
        .insert(rows)
        .returning("*");
      await trx("notification_logs").insert(
        notifications.map((notification) => ({
          notification_id: notification.id,
          user_id: notification.user_id,
          channel,
          status: "sent",
        })),
      );
      return notifications;
    });

    emitNotifications(created);
    return created;
  }

  async targetUsers(academyId, targetRole) {
    return this.db("auth_users")
      .where({ academy_id: academyId, is_active: true })
      .whereNull("deleted_at")
      .modify((q) => {
        if (targetRole) q.where("role", targetRole);
      })
      .select("id as user_id");
  }

  async findTargetUser(academyId, userId) {
    return this.db("auth_users")
      .where({ id: userId, academy_id: academyId, is_active: true })
      .whereNull("deleted_at")
      .first("id as user_id", "academy_id");
  }

  async markAsRead(id, userId) {
    const [row] = await this.db("notification_inbox")
      .where({ id, user_id: userId })
      .update({ is_read: true })
      .returning("*");
    if (row) emitNotificationRead(row);
    return row;
  }

  async markAllAsRead(userId) {
    const count = await this.db("notification_inbox")
      .where({ user_id: userId, is_read: false })
      .update({ is_read: true });
    if (count) emitNotificationsReadAll(userId);
    return count;
  }

  async getUnreadCount(userId, userContext = null) {
    const { query } = await this._baseUserQuery(
      userId,
      { isRead: "false" },
      userContext,
    );
    const [{ count }] = await query.count("id as count");
    return +count;
  }

  async findLogs({ academyId, channel, status, page = 1, limit = 20 } = {}) {
    const query = this.db("notification_logs")
      .join(
        "auth_users as notification_user",
        "notification_user.id",
        "notification_logs.user_id",
      )
      .whereNull("notification_user.deleted_at")
      .modify((q) => {
        if (academyId) q.where("notification_user.academy_id", academyId);
        if (channel) q.where("notification_logs.channel", channel);
        if (status) q.where("notification_logs.status", status);
      })
      .select("notification_logs.*");

    const [{ count }] = await query
      .clone()
      .clearSelect()
      .count("notification_logs.id as count");
    const data = await query
      .orderBy("notification_logs.created_at", "desc")
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      data,
      total: +count,
      page,
      totalPages: Math.ceil(+count / limit) || 1,
    };
  }

  async logNotification(data) {
    const [row] = await this.db("notification_logs")
      .insert(data)
      .returning("*");
    return row;
  }
}

module.exports = NotificationsRepository;
