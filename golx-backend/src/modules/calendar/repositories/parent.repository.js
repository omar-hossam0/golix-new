const { ensureIamForAuthUser } = require("../../../shared/iam-sync");

class ParentRepository {
  constructor(db) {
    this.db = db;
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

  findParentLinkedPlayer(parentUserId) {
    return this.db("auth_users")
      .where({ id: parentUserId })
      .select("linked_player_id")
      .first();
  }

  async parentUsersForPlayers(playerIds, trx = this.db) {
    if (!playerIds.length) return [];

    const linkedParents = await trx("parent_player_links as ppl")
      .join("auth_users as au", "au.id", "ppl.parent_user_id")
      .whereIn("ppl.player_id", playerIds)
      .whereNull("ppl.deleted_at")
      .where("au.role", "parent")
      .where("au.is_active", true)
      .whereNull("au.deleted_at")
      .select("au.id as user_id", "ppl.player_id");

    const legacyParents = await trx("auth_users as au")
      .whereIn("au.linked_player_id", playerIds)
      .where("au.role", "parent")
      .where("au.is_active", true)
      .whereNull("au.deleted_at")
      .whereNotExists(function activeParentLink() {
        this.select(trx.raw("1"))
          .from("parent_player_links as active_ppl")
          .whereRaw("active_ppl.parent_user_id = au.id")
          .whereNull("active_ppl.deleted_at");
      })
      .select("au.id as user_id", "au.linked_player_id as player_id");

    const uniqueParents = new Map();
    for (const row of [...linkedParents, ...legacyParents]) {
      const key = `${row.user_id}:${row.player_id}`;
      if (!uniqueParents.has(key)) uniqueParents.set(key, row);
    }
    return [...uniqueParents.values()];
  }

  async findParentLinkedPlayers(parentUserId, academyId) {
    const linkRows = await this.db("parent_player_links as ppl")
      .join("player_profiles as pp", "ppl.player_id", "pp.id")
      .leftJoin("auth_users as player_user", "pp.user_id", "player_user.id")
      .leftJoin(
        "player_group_assignments as pga",
        function joinCurrentGroup() {
          this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
        },
      )
      .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
      .leftJoin("academy_branches as ab", "pp.branch_id", "ab.id")
      .where("ppl.parent_user_id", parentUserId)
      .where("ppl.academy_id", academyId)
      .where("pp.academy_id", academyId)
      .whereNull("ppl.deleted_at")
      .whereNull("pp.deleted_at")
      .select(
        "pp.*",
        "ppl.id as parent_link_id",
        "ppl.relation",
        "ppl.is_primary",
        "ppl.can_view_progress",
        "ppl.can_view_payments",
        "ppl.can_message_coach",
        "ag.name as group_name",
        "ab.name as branch_name",
        this.db.raw(
          "COALESCE(player_user.username, player_user.email, player_user.phone) as account_name",
        ),
      )
      .orderBy("ppl.is_primary", "desc")
      .orderBy("pp.full_name", "asc");

    if (linkRows.length) return linkRows;

    return this.db("auth_users as au")
      .join("player_profiles as pp", "au.linked_player_id", "pp.id")
      .leftJoin("auth_users as player_user", "pp.user_id", "player_user.id")
      .leftJoin(
        "player_group_assignments as pga",
        function joinCurrentGroup() {
          this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
        },
      )
      .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
      .leftJoin("academy_branches as ab", "pp.branch_id", "ab.id")
      .where("au.id", parentUserId)
      .where("au.role", "parent")
      .where("pp.academy_id", academyId)
      .whereNull("au.deleted_at")
      .whereNull("pp.deleted_at")
      .select(
        "pp.*",
        this.db.raw("NULL::uuid as parent_link_id"),
        this.db.raw("'guardian' as relation"),
        this.db.raw("true as is_primary"),
        this.db.raw("true as can_view_progress"),
        this.db.raw("true as can_view_payments"),
        this.db.raw("true as can_message_coach"),
        "ag.name as group_name",
        "ab.name as branch_name",
        this.db.raw(
          "COALESCE(player_user.username, player_user.email, player_user.phone) as account_name",
        ),
      );
  }

  async findParentChild(parentUserId, childId, academyId) {
    const children = await this.findParentLinkedPlayers(parentUserId, academyId);
    return children.find((child) => child.id === childId) || null;
  }

  parentLinksQuery(academyId) {
    return this.db("parent_player_links as ppl")
      .join("auth_users as parent_user", "ppl.parent_user_id", "parent_user.id")
      .leftJoin("iam_users as parent_iam", "parent_user.id", "parent_iam.id")
      .join("player_profiles as pp", "ppl.player_id", "pp.id")
      .leftJoin(
        "player_group_assignments as pga",
        function joinCurrentGroup() {
          this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
        },
      )
      .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
      .leftJoin("academy_branches as ab", "pp.branch_id", "ab.id")
      .where("ppl.academy_id", academyId)
      .where("pp.academy_id", academyId)
      .where("parent_user.role", "parent")
      .whereNull("ppl.deleted_at")
      .whereNull("parent_user.deleted_at")
      .whereNull("pp.deleted_at")
      .select(
        "ppl.*",
        this.db.raw(
          "COALESCE(parent_iam.full_name, parent_user.username, parent_user.email, parent_user.phone, 'Parent') as parent_name",
        ),
        "parent_user.email as parent_email",
        "parent_user.phone as parent_phone",
        "parent_iam.address as parent_address",
        "pp.full_name as player_name",
        "pp.player_code",
        "pp.position",
        "pp.level",
        "ag.name as group_name",
        "ab.name as branch_name",
      );
  }

  async listAdminParentLinks(academyId, filters = {}) {
    const query = this.parentLinksQuery(academyId)
      .modify((builder) => {
        if (filters.parentUserId) {
          builder.where("ppl.parent_user_id", filters.parentUserId);
        }
        if (filters.playerId) builder.where("ppl.player_id", filters.playerId);
        if (Array.isArray(filters.playerIds)) {
          if (filters.playerIds.length) {
            builder.whereIn("ppl.player_id", filters.playerIds);
          } else {
            builder.whereRaw("1 = 0");
          }
        }
        if (filters.search) {
          builder.where((search) => {
            search
              .where("pp.full_name", "ilike", `%${filters.search}%`)
              .orWhere(
                "parent_iam.full_name",
                "ilike",
                `%${filters.search}%`,
              )
              .orWhere("parent_user.email", "ilike", `%${filters.search}%`)
              .orWhere("parent_user.username", "ilike", `%${filters.search}%`)
              .orWhere("parent_user.phone", "ilike", `%${filters.search}%`);
          });
        }
      })
      .orderBy("ppl.is_primary", "desc")
      .orderBy("pp.full_name", "asc");
    return this.paginate(query, filters);
  }

  async listAdminParentAccounts(academyId, filters = {}) {
    const query = this.db("auth_users as au")
      .leftJoin("iam_users as iu", "au.id", "iu.id")
      .leftJoin("parent_player_links as ppl", function joinActiveLinks() {
        this.on("ppl.parent_user_id", "=", "au.id")
          .andOn("ppl.academy_id", "=", "au.academy_id")
          .andOnNull("ppl.deleted_at");
      })
      .where("au.academy_id", academyId)
      .where("au.role", "parent")
      .whereNull("au.deleted_at")
      .modify((builder) => {
        if (filters.search) {
          builder.where((search) => {
            search
              .where("iu.full_name", "ilike", `%${filters.search}%`)
              .orWhere("au.email", "ilike", `%${filters.search}%`)
              .orWhere("au.username", "ilike", `%${filters.search}%`)
              .orWhere("au.phone", "ilike", `%${filters.search}%`)
              .orWhere("iu.address", "ilike", `%${filters.search}%`);
          });
        }
      })
      .select(
        "au.id",
        "au.email",
        "au.phone",
        "au.username",
        "au.is_active",
        "iu.full_name",
        "iu.address",
        this.db.raw(
          "COALESCE(iu.full_name, au.username, au.email, au.phone, 'Parent') as name",
        ),
        this.db.raw("COUNT(ppl.id)::int as linked_players_count"),
      )
      .groupBy("au.id", "iu.full_name", "iu.address")
      .orderByRaw(
        "COALESCE(iu.full_name, au.username, au.email, au.phone) asc",
      );
    return this.paginate(query, filters);
  }

  async findParentIdentityConflict({ username, phone }) {
    const normalizedUsername = username ? username.toLowerCase() : null;
    const findConflict = (table) =>
      this.db(table)
        .whereNull("deleted_at")
        .where((query) => {
          if (normalizedUsername) {
            query.orWhereRaw("lower(username) = ?", [normalizedUsername]);
          }
          if (phone) query.orWhere("phone", phone);
        })
        .first("id", "username", "phone");

    const authUser = await findConflict("auth_users");
    if (authUser) {
      return this.identityConflictFromRow(authUser, {
        username,
        normalizedUsername,
        phone,
      });
    }

    const iamUser = await findConflict("iam_users");
    return iamUser
      ? this.identityConflictFromRow(iamUser, {
          username,
          normalizedUsername,
          phone,
        })
      : null;
  }

  identityConflictFromRow(row, { username, normalizedUsername, phone }) {
    if (
      normalizedUsername &&
      row.username?.toLowerCase() === normalizedUsername
    ) {
      return { field: "username", value: username };
    }
    if (phone && row.phone === phone) return { field: "phone", value: phone };
    return { field: "login details", value: null };
  }

  findParentAccountById(parentUserId, academyId, dbOrTrx = this.db) {
    return dbOrTrx("auth_users as au")
      .leftJoin("iam_users as iu", "au.id", "iu.id")
      .leftJoin("parent_player_links as ppl", function joinActiveLinks() {
        this.on("ppl.parent_user_id", "=", "au.id")
          .andOn("ppl.academy_id", "=", "au.academy_id")
          .andOnNull("ppl.deleted_at");
      })
      .where({
        "au.id": parentUserId,
        "au.academy_id": academyId,
        "au.role": "parent",
      })
      .whereNull("au.deleted_at")
      .select(
        "au.id",
        "au.email",
        "au.phone",
        "au.username",
        "au.is_active",
        "iu.full_name",
        "iu.address",
        this.db.raw(
          "COALESCE(iu.full_name, au.username, au.email, au.phone, 'Parent') as name",
        ),
        this.db.raw("COUNT(ppl.id)::int as linked_players_count"),
      )
      .groupBy("au.id", "iu.full_name", "iu.address")
      .first();
  }

  async createParentAccount({
    academyId,
    actorUserId,
    fullName,
    username,
    phone,
    passwordHash,
    address,
  }) {
    return this.db.transaction(async (trx) => {
      const [user] = await trx("auth_users")
        .insert({
          username,
          email: null,
          phone,
          password_hash: passwordHash,
          role: "parent",
          academy_id: academyId,
          is_active: true,
          is_verified: true,
        })
        .returning("*");

      await ensureIamForAuthUser(trx, user, {
        fullName,
        address,
        grantedBy: actorUserId,
      });

      return this.findParentAccountById(user.id, academyId, trx);
    });
  }

  async listAdminLinkablePlayers(academyId, filters = {}) {
    const query = this.db("player_profiles as pp")
      .leftJoin(
        "player_group_assignments as pga",
        function joinCurrentGroup() {
          this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
        },
      )
      .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
      .where("pp.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .modify((builder) => {
        if (Array.isArray(filters.playerIds)) {
          if (filters.playerIds.length) {
            builder.whereIn("pp.id", filters.playerIds);
          } else {
            builder.whereRaw("1 = 0");
          }
        }
        if (filters.search) {
          builder.where((search) => {
            search
              .where("pp.full_name", "ilike", `%${filters.search}%`)
              .orWhere("pp.player_code", "ilike", `%${filters.search}%`);
          });
        }
      })
      .select(
        "pp.id",
        "pp.full_name",
        "pp.player_code",
        "pp.position",
        "pp.level",
        "ag.name as group_name",
      )
      .orderBy("pp.full_name", "asc");
    return this.paginate(query, filters);
  }

  findParentUser(parentUserId, academyId) {
    return this.db("auth_users")
      .where({
        id: parentUserId,
        academy_id: academyId,
        role: "parent",
      })
      .whereNull("deleted_at")
      .first();
  }

  findPlayerForParentLink(playerId, academyId) {
    return this.db("player_profiles")
      .where({ id: playerId, academy_id: academyId })
      .whereNull("deleted_at")
      .first();
  }

  findParentPlayerLink(linkId, academyId) {
    return this.parentLinksQuery(academyId).where("ppl.id", linkId).first();
  }

  async createParentPlayerLink(data) {
    const created = await this.db.transaction(async (trx) => {
      if (data.is_primary) {
        await trx("parent_player_links")
          .where({
            academy_id: data.academy_id,
            parent_user_id: data.parent_user_id,
          })
          .whereNull("deleted_at")
          .update({ is_primary: false, updated_at: new Date() });
      }

      const [row] = await trx("parent_player_links")
        .insert(data)
        .returning("*");

      await trx("player_profiles")
        .where({ id: data.player_id, academy_id: data.academy_id })
        .whereNull("deleted_at")
        .update({
          guardian_name: null,
          guardian_phone: null,
          guardian_relation: null,
          updated_at: new Date(),
        });

      return row;
    });
    return this.findParentPlayerLink(created.id, data.academy_id);
  }

  findPrimaryParentForPlayer(playerId, academyId) {
    return this.db("parent_player_links as ppl")
      .join("auth_users as au", "ppl.parent_user_id", "au.id")
      .leftJoin("iam_users as iu", "au.id", "iu.id")
      .where({
        "ppl.player_id": playerId,
        "ppl.academy_id": academyId,
        "au.role": "parent",
      })
      .whereNull("ppl.deleted_at")
      .whereNull("au.deleted_at")
      .select(
        "ppl.id as link_id",
        "ppl.relation",
        "ppl.is_primary",
        "ppl.can_view_progress",
        "ppl.can_view_payments",
        "ppl.can_message_coach",
        "au.id as user_id",
        "au.email",
        "au.phone",
        "au.username",
        "au.is_active",
        "iu.full_name",
        "iu.address",
        this.db.raw(
          "COALESCE(iu.full_name, au.username, au.email, au.phone, 'Parent') as name",
        ),
      )
      .orderBy("ppl.is_primary", "desc")
      .orderBy("ppl.created_at", "asc")
      .first();
  }

  async updateParentPlayerLink(linkId, academyId, patch) {
    const updated = await this.db.transaction(async (trx) => {
      const existing = await trx("parent_player_links")
        .where({ id: linkId, academy_id: academyId })
        .whereNull("deleted_at")
        .first();
      if (!existing) return null;

      if (patch.is_primary === true) {
        await trx("parent_player_links")
          .where({
            academy_id: academyId,
            parent_user_id: existing.parent_user_id,
          })
          .whereNot({ id: linkId })
          .whereNull("deleted_at")
          .update({ is_primary: false, updated_at: new Date() });
      }

      const [row] = await trx("parent_player_links")
        .where({ id: linkId, academy_id: academyId })
        .whereNull("deleted_at")
        .update({ ...patch, updated_at: new Date() })
        .returning("*");
      return row;
    });
    return updated ? this.findParentPlayerLink(updated.id, academyId) : null;
  }

  async deleteParentPlayerLink(linkId, academyId) {
    const [row] = await this.db("parent_player_links")
      .where({ id: linkId, academy_id: academyId })
      .whereNull("deleted_at")
      .update({ deleted_at: new Date(), updated_at: new Date() })
      .returning("*");
    return row || null;
  }

  parentNotesQuery(academyId) {
    return this.db("parent_player_notes as ppn")
      .join("player_profiles as pp", "ppn.player_id", "pp.id")
      .join("auth_users as parent_user", "ppn.parent_user_id", "parent_user.id")
      .leftJoin("coach_profiles as cp", "ppn.coach_user_id", "cp.user_id")
      .where("ppn.academy_id", academyId)
      .whereNull("ppn.deleted_at")
      .whereNull("pp.deleted_at")
      .select(
        "ppn.*",
        "pp.full_name as player_name",
        "pp.position as player_position",
        "cp.full_name as coach_name",
        this.db.raw(
          "COALESCE(parent_user.username, parent_user.email, parent_user.phone, 'Parent') as parent_name",
        ),
      );
  }

  async listParentPlayerNotesForParent(
    parentUserId,
    academyId,
    playerId,
    filters = {},
  ) {
    const query = this.parentNotesQuery(academyId)
      .where("ppn.parent_user_id", parentUserId)
      .where("ppn.player_id", playerId)
      .orderBy("ppn.created_at", "desc");
    return this.paginate(query, filters);
  }

  async listPlayerVisibleParentNotes(academyId, playerId, filters = {}) {
    const query = this.parentNotesQuery(academyId)
      .where("ppn.player_id", playerId)
      .whereIn("ppn.visibility", ["player_and_parent", "family"])
      .modify((builder) => {
        if (filters.status) builder.where("ppn.status", filters.status);
      })
      .orderBy("ppn.created_at", "desc");
    return this.paginate(query, filters);
  }

  async listParentPlayerMeasurements(academyId, playerId, filters = {}) {
    const query = this.db("player_measurements as pm")
      .join("player_profiles as pp", "pm.player_id", "pp.id")
      .leftJoin(
        "auth_users as measured_by_user",
        "pm.measured_by",
        "measured_by_user.id",
      )
      .where("pp.academy_id", academyId)
      .where("pm.player_id", playerId)
      .whereNull("pp.deleted_at")
      .select(
        "pm.*",
        this.db.raw(
          "COALESCE(measured_by_user.username, measured_by_user.email, measured_by_user.phone) as measured_by_name",
        ),
      )
      .orderBy("pm.measured_at", "desc")
      .orderBy("pm.id", "desc");
    return this.paginate(query, filters);
  }

  async parentPaymentSummary(academyId, playerId) {
    const subscriptions = await this.db("payment_subscriptions as ps")
      .join("player_profiles as pp", "ps.player_id", "pp.id")
      .leftJoin("academy_groups as ag", "ps.group_id", "ag.id")
      .where("pp.academy_id", academyId)
      .where("ps.player_id", playerId)
      .whereNull("pp.deleted_at")
      .select("ps.*", "ag.name as group_name")
      .orderBy("ps.created_at", "desc");

    const invoices = await this.db("payment_invoices as pi")
      .join("payment_subscriptions as ps", "pi.subscription_id", "ps.id")
      .join("player_profiles as pp", "ps.player_id", "pp.id")
      .where("pp.academy_id", academyId)
      .where("ps.player_id", playerId)
      .whereNull("pp.deleted_at")
      .select(
        "pi.*",
        "ps.plan",
        "ps.currency",
        "ps.starts_at",
        "ps.ends_at",
      )
      .orderBy("pi.due_date", "desc")
      .orderBy("pi.created_at", "desc");

    const totals = invoices.reduce(
      (acc, invoice) => {
        const amount = Number(invoice.amount || 0);
        acc.total += amount;
        if (invoice.status === "paid") acc.paid += amount;
        if (invoice.status === "pending" || invoice.status === "overdue") {
          acc.due += amount;
        }
        acc.byStatus[invoice.status] =
          (acc.byStatus[invoice.status] || 0) + amount;
        return acc;
      },
      { total: 0, paid: 0, due: 0, byStatus: {} },
    );

    return {
      currentSubscription:
        subscriptions.find((item) => item.status === "active") ||
        subscriptions.find((item) => item.status === "pending") ||
        subscriptions[0] ||
        null,
      subscriptions,
      invoices,
      totals,
    };
  }

  async createParentPlayerNote(data, trx = this.db) {
    const [row] = await trx("parent_player_notes").insert(data).returning("*");
    return this.parentNotesQuery(data.academy_id)
      .where("ppn.id", row.id)
      .first();
  }

  async listCoachParentNotes(coachId, academyId, filters = {}) {
    const scopedPlayers = await this.findCoachScopedPlayers(
      coachId,
      academyId,
    );
    const playerIds = scopedPlayers.map((player) => player.id);
    if (!playerIds.length) {
      return {
        data: [],
        total: 0,
        page: filters.page || 1,
        totalPages: 1,
      };
    }

    const query = this.parentNotesQuery(academyId)
      .whereIn("ppn.player_id", playerIds)
      .where((scope) => {
        scope.whereNull("ppn.coach_user_id");
        if (filters.coachUserId) {
          scope.orWhere("ppn.coach_user_id", filters.coachUserId);
        }
      })
      .modify((builder) => {
        if (filters.playerId) {
          builder.where("ppn.player_id", filters.playerId);
        }
        if (filters.status) builder.where("ppn.status", filters.status);
      })
      .orderByRaw(
        "CASE ppn.status WHEN 'new' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END",
      )
      .orderBy("ppn.created_at", "desc");
    return this.paginate(query, filters);
  }

  findParentNoteById(noteId, academyId) {
    return this.parentNotesQuery(academyId).where("ppn.id", noteId).first();
  }

  async updateParentNoteResponse(noteId, academyId, patch) {
    const [row] = await this.db("parent_player_notes")
      .where({ id: noteId, academy_id: academyId })
      .whereNull("deleted_at")
      .update({
        ...patch,
        updated_at: new Date(),
      })
      .returning("*");
    if (!row) return null;
    return this.findParentNoteById(row.id, academyId);
  }
}

module.exports = ParentRepository;
