class ChatRepository {
  constructor(db) {
    this.db = db;
  }

  findCoachByUserId(userId, academyId) {
    return this.db("coach_profiles")
      .where({ user_id: userId, academy_id: academyId })
      .whereNull("deleted_at")
      .first();
  }

  findPlayerByUserId(userId, academyId) {
    return this.db("player_profiles")
      .where({ user_id: userId, academy_id: academyId })
      .whereNull("deleted_at")
      .first();
  }

  findCoachById(coachId, academyId) {
    return this.db("coach_profiles as cp")
      .join("auth_users as au", "cp.user_id", "au.id")
      .where("cp.id", coachId)
      .where("cp.academy_id", academyId)
      .where("au.role", "coach")
      .where("au.is_active", true)
      .whereNull("cp.deleted_at")
      .whereNull("au.deleted_at")
      .select("cp.*", "au.id as auth_user_id")
      .first();
  }

  findPlayerById(playerId, academyId) {
    return this.db("player_profiles as pp")
      .join("auth_users as au", "pp.user_id", "au.id")
      .where("pp.id", playerId)
      .where("pp.academy_id", academyId)
      .where("au.role", "player")
      .where("au.is_active", true)
      .whereNull("pp.deleted_at")
      .whereNull("au.deleted_at")
      .select("pp.*", "au.id as auth_user_id")
      .first();
  }

  findParentByUserId(userId, academyId) {
    return this.db("auth_users")
      .where({ id: userId, academy_id: academyId, role: "parent", is_active: true })
      .whereNull("deleted_at")
      .first();
  }

  async findParentLinkedPlayers(parentUserId, academyId) {
    const linkRows = await this.db("parent_player_links as ppl")
      .join("player_profiles as pp", "ppl.player_id", "pp.id")
      .leftJoin("player_group_assignments as pga", function joinCurrentGroup() {
        this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
      })
      .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
      .where("ppl.parent_user_id", parentUserId)
      .where("ppl.academy_id", academyId)
      .where("pp.academy_id", academyId)
      .whereNull("ppl.deleted_at")
      .whereNull("pp.deleted_at")
      .select(
        "pp.*",
        "ppl.relation",
        "ppl.is_primary",
        "ppl.can_message_coach",
        "ag.name as group_name",
      )
      .orderBy("ppl.is_primary", "desc")
      .orderBy("pp.full_name", "asc");

    if (linkRows.length) {
      return linkRows.filter((row) => row.can_message_coach !== false);
    }

    return this.db("auth_users as au")
      .join("player_profiles as pp", "au.linked_player_id", "pp.id")
      .leftJoin("player_group_assignments as pga", function joinCurrentGroup() {
        this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
      })
      .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
      .where("au.id", parentUserId)
      .where("au.role", "parent")
      .where("pp.academy_id", academyId)
      .whereNull("au.deleted_at")
      .whereNull("pp.deleted_at")
      .select(
        "pp.*",
        this.db.raw("'guardian' as relation"),
        this.db.raw("true as is_primary"),
        this.db.raw("true as can_message_coach"),
        "ag.name as group_name",
      );
  }

  async findParentLinkedPlayer(parentUserId, playerId, academyId) {
    const players = await this.findParentLinkedPlayers(parentUserId, academyId);
    return players.find((player) => player.id === playerId) || null;
  }

  findUserById(userId) {
    return this.db("auth_users")
      .where({ id: userId, is_active: true })
      .whereNull("deleted_at")
      .first();
  }

  findActiveUsersByIds(userIds, academyId) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (!uniqueIds.length) return [];
    return this.db("auth_users")
      .whereIn("id", uniqueIds)
      .where({ academy_id: academyId, is_active: true })
      .whereIn("role", ["admin", "coach", "player"])
      .whereNull("deleted_at")
      .select(
        "id",
        "role",
        this.db.raw(
          "COALESCE(username, email, phone, 'User') as name",
        ),
      );
  }

  findAdminByUserId(userId, academyId) {
    return this.db("admin_accounts as aa")
      .join("auth_users as au", "aa.user_id", "au.id")
      .where("aa.user_id", userId)
      .where("aa.academy_id", academyId)
      .where("aa.is_active", true)
      .where("au.role", "admin")
      .where("au.is_active", true)
      .whereNull("aa.deleted_at")
      .whereNull("au.deleted_at")
      .select(
        "aa.*",
        "au.id as user_id",
        this.db.raw(
          "COALESCE(au.username, au.email, au.phone, 'Admin') as name",
        ),
      )
      .first();
  }

  listAcademyAdmins(academyId) {
    return this.db("admin_accounts as aa")
      .join("auth_users as au", "aa.user_id", "au.id")
      .where("aa.academy_id", academyId)
      .where("aa.is_active", true)
      .where("au.role", "admin")
      .where("au.is_active", true)
      .whereNull("aa.deleted_at")
      .whereNull("au.deleted_at")
      .select(
        this.db.raw("'admin' as type"),
        "au.id",
        "au.id as user_id",
        this.db.raw(
          "COALESCE(au.username, au.email, au.phone, 'Admin') as name",
        ),
        this.db.raw("'Academy admin' as subtitle"),
      )
      .orderBy("name", "asc");
  }

  async listAdminContacts(academyId) {
    const [coaches, players] = await Promise.all([
      this.db("coach_profiles as cp")
        .join("auth_users as au", "cp.user_id", "au.id")
        .where("cp.academy_id", academyId)
        .where("au.role", "coach")
        .where("au.is_active", true)
        .whereNull("cp.deleted_at")
        .whereNull("au.deleted_at")
        .select(
          this.db.raw("'coach' as type"),
          "cp.id",
          "cp.user_id",
          "cp.full_name as name",
          "cp.specialization as subtitle",
        )
        .orderBy("cp.full_name", "asc"),
      this.db("player_profiles as pp")
        .join("auth_users as au", "pp.user_id", "au.id")
        .where("pp.academy_id", academyId)
        .where("au.role", "player")
        .where("au.is_active", true)
        .whereNull("pp.deleted_at")
        .whereNull("au.deleted_at")
        .select(
          this.db.raw("'player' as type"),
          "pp.id",
          "pp.user_id",
          "pp.full_name as name",
          "pp.position as subtitle",
        )
        .orderBy("pp.full_name", "asc"),
    ]);
    return { coaches, players };
  }

  async listCoachContacts(coachId, academyId) {
    const [admins, coaches, players] = await Promise.all([
      this.listAcademyAdmins(academyId),
      this.db("coach_profiles as cp")
        .join("auth_users as au", "cp.user_id", "au.id")
        .where("cp.academy_id", academyId)
        .whereNot("cp.id", coachId)
        .where("au.role", "coach")
        .where("au.is_active", true)
        .whereNull("cp.deleted_at")
        .whereNull("au.deleted_at")
        .select(
          this.db.raw("'coach' as type"),
          "cp.id",
          "cp.user_id",
          "cp.full_name as name",
          "cp.specialization as subtitle",
        )
        .orderBy("cp.full_name", "asc"),
      this.findCoachScopedPlayers(coachId, academyId, {
        requireUser: true,
      }),
    ]);
    const playerIds = players.map((player) => player.id);
    const parents = playerIds.length
      ? await this.db("parent_player_links as ppl")
          .join("auth_users as au", "ppl.parent_user_id", "au.id")
          .join("player_profiles as pp", "ppl.player_id", "pp.id")
          .whereIn("ppl.player_id", playerIds)
          .where("ppl.academy_id", academyId)
          .where("ppl.can_message_coach", true)
          .where("au.role", "parent")
          .where("au.is_active", true)
          .whereNull("ppl.deleted_at")
          .whereNull("au.deleted_at")
          .whereNull("pp.deleted_at")
          .distinctOn("au.id", "pp.id")
          .select(
            this.db.raw("'parent' as type"),
            "au.id",
            "au.id as user_id",
            "pp.id as player_id",
            "pp.full_name as player_name",
            this.db.raw(
              "COALESCE(au.username, au.email, au.phone, 'Parent') as name",
            ),
            this.db.raw("CONCAT('Parent of ', pp.full_name) as subtitle"),
          )
          .orderBy("au.id")
          .orderBy("pp.id")
          .orderBy("name", "asc")
      : [];
    return {
      admins,
      coaches,
      players: players.map((player) => ({
        type: "player",
        id: player.id,
        user_id: player.user_id,
        name: player.full_name,
        subtitle: player.position || player.group_name || null,
      })),
      parents,
    };
  }

  async listPlayerContacts(player, academyId) {
    const coaches = await this.findCoachesForPlayer(player, academyId);
    return {
      coaches: coaches.map((coach) => ({
        type: "coach",
        id: coach.id,
        user_id: coach.user_id,
        name: coach.full_name,
        subtitle: coach.specialization || null,
      })),
    };
  }

  async listParentContacts(parentUserId, academyId) {
    const children = await this.findParentLinkedPlayers(parentUserId, academyId);
    const coachContacts = [];
    for (const child of children) {
      const coaches = await this.findCoachesForPlayer(child, academyId);
      coaches.forEach((coach) => {
        coachContacts.push({
          type: "coach",
          id: coach.id,
          user_id: coach.user_id,
          player_id: child.id,
          player_name: child.full_name,
          name: coach.full_name,
          subtitle: `${coach.specialization || "Coach"} - ${child.full_name}`,
        });
      });
    }

    const byCoachAndChild = new Map();
    coachContacts.forEach((contact) => {
      const key = `${contact.user_id}:${contact.player_id}`;
      if (!byCoachAndChild.has(key)) byCoachAndChild.set(key, contact);
    });

    return {
      children: children.map((child) => ({
        type: "player",
        id: child.id,
        user_id: child.user_id,
        name: child.full_name,
        subtitle: child.position || child.group_name || null,
      })),
      coaches: [...byCoachAndChild.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  }

  async findCoachAssignedGroups(coachId, academyId) {
    return this.db("coach_group_assignments as cga")
      .join("academy_groups as ag", "cga.group_id", "ag.id")
      .join("academy_branches as ab", "ag.branch_id", "ab.id")
      .where("cga.coach_id", coachId)
      .where("ab.academy_id", academyId)
      .whereNull("ag.deleted_at")
      .whereNull("ab.deleted_at")
      .select("cga.group_id", "ag.name as group_name", "ag.branch_id");
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

  async findCoachAccessibleBirthYears(coachId, academyId) {
    return this.db("academy_birth_years as aby")
      .join("academy_branches as ab", "aby.branch_id", "ab.id")
      .where("ab.academy_id", academyId)
      .whereIn("aby.id", this._coachAccessibleBirthYearIdsQuery(coachId))
      .whereNull("aby.deleted_at")
      .whereNull("ab.deleted_at")
      .select("aby.*", "ab.name as branch_name");
  }

  async findCoachScopedPlayers(coachId, academyId, { requireUser = false } = {}) {
    const [assignments, birthYears] = await Promise.all([
      this.findCoachAssignedGroups(coachId, academyId),
      this.findCoachAccessibleBirthYears(coachId, academyId),
    ]);
    const groupIds = assignments.map((assignment) => assignment.group_id);
    if (!groupIds.length && !birthYears.length) return [];

    return this.db("player_profiles as pp")
      .leftJoin("player_group_assignments as pga", function joinCurrentGroup() {
        this.on("pga.player_id", "=", "pp.id").andOnNull("pga.left_at");
      })
      .leftJoin("academy_groups as ag", "pga.group_id", "ag.id")
      .where("pp.academy_id", academyId)
      .whereNull("pp.deleted_at")
      .modify((q) => {
        if (requireUser) q.whereNotNull("pp.user_id");
      })
      .andWhere((scope) => {
        if (groupIds.length) scope.orWhereIn("pga.group_id", groupIds);
        birthYears.forEach((birthYear) => {
          scope.orWhere((birthScope) => {
            birthScope
              .where("pp.branch_id", birthYear.branch_id)
              .whereRaw(
                "EXTRACT(YEAR FROM pp.date_of_birth)::int BETWEEN ? AND ?",
                [birthYear.from_year, birthYear.to_year],
              );
          });
        });
      })
      .distinctOn("pp.id")
      .select("pp.*", "ag.name as group_name")
      .orderBy("pp.id")
      .orderBy("pp.full_name", "asc");
  }

  async findCoachScopedPlayerById(coachId, academyId, playerId) {
    const players = await this.findCoachScopedPlayers(coachId, academyId, {
      requireUser: true,
    });
    return players.find((player) => player.id === playerId) || null;
  }

  findPlayerGroups(playerId) {
    return this.db("player_group_assignments")
      .where({ player_id: playerId })
      .whereNull("left_at")
      .select("group_id");
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
                birthScope
                  .where("car.all_birth_years", true)
                  .orWhere((selected) => {
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

  conversationBaseQuery(viewerUserId = null) {
    const hiddenForViewerClause = viewerUserId
      ? `AND NOT EXISTS (
          SELECT 1
            FROM chat_message_user_deletions cmud
           WHERE cmud.message_id = cm.id
             AND cmud.user_id = ?
        )`
      : "";
    const hiddenBindings = viewerUserId ? [viewerUserId] : [];

    return this.db("chat_conversations as c")
      .leftJoin("coach_profiles as cp", "c.coach_id", "cp.id")
      .leftJoin("player_profiles as pp", "c.player_id", "pp.id")
      .leftJoin("auth_users as admin_user", "c.admin_user_id", "admin_user.id")
      .leftJoin("auth_users as parent_user", "c.parent_user_id", "parent_user.id")
      .leftJoin(
        "chat_group_conversations as cgc",
        "cgc.conversation_id",
        "c.id",
      )
      .select(
        "c.*",
        "cp.full_name as coach_name",
        "pp.full_name as player_name",
        "cgc.name as group_name",
        "cgc.created_by_user_id as group_created_by_user_id",
        this.db.raw(
          "COALESCE(admin_user.username, admin_user.email, admin_user.phone, 'Admin') as admin_name",
        ),
        this.db.raw(
          "COALESCE(parent_user.username, parent_user.email, parent_user.phone, 'Parent') as parent_name",
        ),
        this.db.raw(
          `(SELECT COALESCE(array_agg(cgm.user_id::text ORDER BY cgm.created_at), ARRAY[]::text[])
              FROM chat_group_members cgm
             WHERE cgm.conversation_id = c.id) as group_member_user_ids`,
        ),
        this.db.raw(
          `(SELECT COUNT(*)::int
              FROM chat_group_members cgm
             WHERE cgm.conversation_id = c.id) as group_member_count`,
        ),
        this.db.raw(
          `(SELECT COALESCE(
              json_agg(
                json_build_object(
                  'userId', cgm.user_id::text,
                  'name', COALESCE(cp_member.full_name, pp_member.full_name, au_member.username, au_member.email, au_member.phone, 'User'),
                  'role', au_member.role,
                  'membershipRole', cgm.role
                )
                ORDER BY CASE WHEN cgm.role = 'owner' THEN 0 ELSE 1 END, COALESCE(cp_member.full_name, pp_member.full_name, au_member.username, au_member.email, au_member.phone, 'User')
              ),
              '[]'::json
            )
              FROM chat_group_members cgm
              JOIN auth_users au_member ON au_member.id = cgm.user_id
              LEFT JOIN coach_profiles cp_member
                ON cp_member.user_id = au_member.id
               AND cp_member.deleted_at IS NULL
              LEFT JOIN player_profiles pp_member
                ON pp_member.user_id = au_member.id
               AND pp_member.deleted_at IS NULL
             WHERE cgm.conversation_id = c.id) as group_members`,
        ),
        this.db.raw(
          `(SELECT cm.body
              FROM chat_messages cm
             WHERE cm.conversation_id = c.id
               AND cm.deleted_at IS NULL
               ${hiddenForViewerClause}
             ORDER BY cm.created_at DESC
             LIMIT 1) as last_message_body`,
          hiddenBindings,
        ),
        this.db.raw(
          `(SELECT cm.attachment_url
              FROM chat_messages cm
             WHERE cm.conversation_id = c.id
               AND cm.deleted_at IS NULL
               ${hiddenForViewerClause}
             ORDER BY cm.created_at DESC
             LIMIT 1) as last_attachment_url`,
          hiddenBindings,
        ),
      );
  }

  listConversationsForUser(user) {
    return this.conversationBaseQuery(user.userId)
      .where("c.academy_id", user.academyId)
      .where((q) => {
        if (user.role === "admin") {
          q.where((direct) => {
            direct
              .whereIn("c.type", ["admin_coach", "admin_player_session"])
              .where("c.admin_user_id", user.userId);
          }).orWhereExists(function groupMembership() {
            this.select("cgm.conversation_id")
              .from("chat_group_members as cgm")
              .whereRaw("cgm.conversation_id = c.id")
              .where("cgm.user_id", user.userId);
          });
        } else if (user.role === "coach") {
          q.where("c.coach_user_id", user.userId).orWhereExists(
            function groupMembership() {
              this.select("cgm.conversation_id")
                .from("chat_group_members as cgm")
                .whereRaw("cgm.conversation_id = c.id")
                .where("cgm.user_id", user.userId);
            },
          );
        } else if (user.role === "player") {
          q.where("c.player_user_id", user.userId).orWhereExists(
            function groupMembership() {
              this.select("cgm.conversation_id")
                .from("chat_group_members as cgm")
                .whereRaw("cgm.conversation_id = c.id")
                .where("cgm.user_id", user.userId);
            },
          );
        } else if (user.role === "parent") {
          q.where("c.parent_user_id", user.userId).orWhereExists(
            function groupMembership() {
              this.select("cgm.conversation_id")
                .from("chat_group_members as cgm")
                .whereRaw("cgm.conversation_id = c.id")
                .where("cgm.user_id", user.userId);
            },
          );
        } else {
          q.whereRaw("1 = 0");
        }
      })
      .orderByRaw("c.last_message_at DESC NULLS LAST")
      .orderBy("c.created_at", "desc");
  }

  findConversationById(conversationId) {
    return this.conversationBaseQuery().where("c.id", conversationId).first();
  }

  findOpenConversation(filters) {
    return this.conversationBaseQuery()
      .where({
        "c.academy_id": filters.academyId,
        "c.type": filters.type,
        "c.status": "open",
      })
      .modify((q) => {
        if (filters.adminUserId) q.where("c.admin_user_id", filters.adminUserId);
        if (filters.coachUserId) q.where("c.coach_user_id", filters.coachUserId);
        if (filters.playerUserId) q.where("c.player_user_id", filters.playerUserId);
        if (filters.parentUserId) q.where("c.parent_user_id", filters.parentUserId);
        if (filters.playerId) q.where("c.player_id", filters.playerId);
      })
      .first();
  }

  async createConversation(data, trx = this.db) {
    const [row] = await trx("chat_conversations").insert(data).returning("*");
    return this.findConversationById(row.id);
  }

  async createGroupConversation({
    academyId,
    name,
    createdByUserId,
    memberUserIds,
  }) {
    const uniqueMemberUserIds = [...new Set(memberUserIds.filter(Boolean))];
    const [row] = await this.db.transaction(async (trx) => {
      const [conversation] = await trx("chat_conversations")
        .insert({
          academy_id: academyId,
          type: "chat_group",
          status: "open",
          opened_by_user_id: createdByUserId,
        })
        .returning("*");

      await trx("chat_group_conversations").insert({
        conversation_id: conversation.id,
        name,
        created_by_user_id: createdByUserId,
      });

      await trx("chat_group_members").insert(
        uniqueMemberUserIds.map((userId) => ({
          conversation_id: conversation.id,
          user_id: userId,
          role: userId === createdByUserId ? "owner" : "member",
          added_by_user_id: createdByUserId,
        })),
      );

      return [conversation];
    });

    return this.findConversationById(row.id);
  }

  async closeConversation(conversationId, userId) {
    const [row] = await this.db("chat_conversations")
      .where({ id: conversationId })
      .update({
        status: "closed",
        closed_by_user_id: userId,
        closed_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");
    if (!row) return null;
    return this.findConversationById(row.id);
  }

  async insertMessage(conversation, data) {
    const now = new Date();
    let insertResult;
    try {
      insertResult = await this.db.transaction(async (trx) => {
        if (data.clientMessageId) {
          const existing = await trx("chat_messages")
            .where({
              conversation_id: conversation.id,
              sender_user_id: data.senderUserId,
              client_message_id: data.clientMessageId,
            })
            .whereNull("deleted_at")
            .first("id");
          if (existing) {
            return { message: existing, event: null, idempotent: true };
          }
        }

        const [message] = await trx("chat_messages")
          .insert({
            conversation_id: conversation.id,
            academy_id: conversation.academy_id,
            sender_user_id: data.senderUserId,
            client_message_id: data.clientMessageId || null,
            body: data.body || null,
            attachment_url: data.attachmentUrl || null,
            attachment_original_name: data.attachmentOriginalName || null,
            attachment_mime_type: data.attachmentMimeType || null,
            attachment_size: data.attachmentSize || null,
            delivered_at: now,
          })
          .returning("*");
        await trx("chat_conversations")
          .where({ id: conversation.id })
          .update({ last_message_at: now, updated_at: now });
        const realtimeEvent = await this.createRealtimeEvent(trx, {
          eventType: "chat.message.created",
          entityType: "chat_messages",
          entityId: message.id,
          academyId: conversation.academy_id,
          payload: {
            conversationId: conversation.id,
            messageId: message.id,
            senderUserId: data.senderUserId,
          },
        });
        return { message, event: realtimeEvent, idempotent: false };
      });
    } catch (err) {
      if (data.clientMessageId && err.code === "23505") {
        const existing = await this.db("chat_messages")
          .where({
            conversation_id: conversation.id,
            sender_user_id: data.senderUserId,
            client_message_id: data.clientMessageId,
          })
          .whereNull("deleted_at")
          .first("id");
        if (existing) {
          const message = await this.findMessageById(existing.id);
          return { message, event: null, idempotent: true };
        }
      }
      throw err;
    }
    const { message: row, event, idempotent } = insertResult;
    const message = await this.findMessageById(row.id);
    return { message, event, idempotent };
  }

  async createRealtimeEvent(trx, {
    eventType,
    entityType,
    entityId,
    academyId,
    payload = {},
  }) {
    const [row] = await trx("realtime_outbox")
      .insert({
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId || null,
        academy_id: academyId || null,
        payload,
      })
      .returning([
        "id",
        "sequence",
        "event_type",
        "entity_type",
        "entity_id",
        "occurred_at",
      ]);
    return row;
  }

  messageBaseQuery({
    includeDeleted = false,
    viewerUserId = null,
    tableName = "chat_messages",
    userDeletionsTableName = "chat_message_user_deletions",
  } = {}) {
    const db = this.db;
    return this.db(`${tableName} as cm`)
      .leftJoin("auth_users as au", "cm.sender_user_id", "au.id")
      .leftJoin("coach_profiles as cp", "cp.user_id", "au.id")
      .leftJoin("player_profiles as pp", "pp.user_id", "au.id")
      .modify((q) => {
        if (!includeDeleted) q.whereNull("cm.deleted_at");
        if (viewerUserId) {
          q.leftJoin(`${userDeletionsTableName} as cmud`, function joinDeletes() {
            this.on("cmud.message_id", "=", "cm.id").andOn(
              "cmud.user_id",
              "=",
              db.raw("?", [viewerUserId]),
            );
          }).whereNull("cmud.message_id");
        }
      })
      .select(
        "cm.*",
        "au.role as sender_role",
        this.db.raw(
          "COALESCE(cp.full_name, pp.full_name, au.username, au.email, au.phone, 'User') as sender_name",
        ),
      );
  }

  findMessageById(messageId, options = {}) {
    return this.messageBaseQuery(options).where("cm.id", messageId).first();
  }

  findMessagesByIds(messageIds) {
    if (!messageIds.length) return [];
    return this.messageBaseQuery()
      .whereIn("cm.id", messageIds)
      .orderBy("cm.created_at", "asc");
  }

  findMessageForMutation(messageId, conversationId) {
    return this.db("chat_messages")
      .where({ id: messageId, conversation_id: conversationId })
      .whereNull("deleted_at")
      .first();
  }

  async updateMessageBody(messageId, body) {
    const [row] = await this.db("chat_messages")
      .where({ id: messageId })
      .whereNull("deleted_at")
      .update({
        body,
        edited_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");
    if (!row) return null;
    return this.findMessageById(row.id);
  }

  async softDeleteMessage(messageId, userId) {
    const [row] = await this.db("chat_messages")
      .where({ id: messageId })
      .whereNull("deleted_at")
      .update({
        deleted_at: new Date(),
        deleted_by_user_id: userId,
        updated_at: new Date(),
      })
      .returning("*");
    return row || null;
  }

  async hideMessageForUser(messageId, userId) {
    const [row] = await this.db("chat_message_user_deletions")
      .insert({ message_id: messageId, user_id: userId })
      .onConflict(["message_id", "user_id"])
      .ignore()
      .returning(["message_id", "user_id", "created_at"]);
    return row || { message_id: messageId, user_id: userId };
  }

  async refreshConversationLastMessageAt(conversationId) {
    const latest = await this.db("chat_messages")
      .where({ conversation_id: conversationId })
      .whereNull("deleted_at")
      .max("created_at as latest")
      .first();
    await this.db("chat_conversations")
      .where({ id: conversationId })
      .update({
        last_message_at: latest?.latest || null,
        updated_at: new Date(),
      });
    return this.findConversationById(conversationId);
  }

  async listMessages(conversationId, userId, { limit = 50, before, includeArchive = false } = {}) {
    const normalizedLimit = Number(limit) || 50;
    const hasArchivedUserDeletions = includeArchive
      ? await this.db.schema.hasTable("chat_message_user_deletions_archive")
      : false;
    const loadFromTable = (tableName) => this.messageBaseQuery({
      includeDeleted: true,
      viewerUserId: userId,
      tableName,
      userDeletionsTableName: tableName === "chat_messages_archive" && hasArchivedUserDeletions
        ? "chat_message_user_deletions_archive"
        : "chat_message_user_deletions",
    })
      .where("cm.conversation_id", conversationId)
      .modify((q) => {
        if (before) q.where("cm.created_at", "<", before);
      })
      .orderBy("cm.created_at", "desc")
      .limit(normalizedLimit);

    const hotMessages = await loadFromTable("chat_messages");
    if (!includeArchive || hotMessages.length >= normalizedLimit) return hotMessages;
    if (!(await this.db.schema.hasTable("chat_messages_archive"))) return hotMessages;

    const archiveMessages = await loadFromTable("chat_messages_archive");
    return [...hotMessages, ...archiveMessages]
      .sort((a, b) => {
        const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (dateDiff !== 0) return dateDiff;
        return String(b.id).localeCompare(String(a.id));
      })
      .slice(0, normalizedLimit);
  }

  async markConversationRead(conversationId, userId) {
    const now = new Date();
    const { rows, event } = await this.db.transaction(async (trx) => {
      const updatedRows = await trx("chat_messages")
        .where({ conversation_id: conversationId })
        .whereNot("sender_user_id", userId)
        .whereNull("deleted_at")
        .whereNull("read_at")
        .update({
          delivered_at: this.db.raw("COALESCE(delivered_at, ?)", [now]),
          read_at: now,
          updated_at: now,
        })
        .returning("id");
      if (!updatedRows.length) return { rows: updatedRows, event: null };
      const realtimeEvent = await this.createRealtimeEvent(trx, {
        eventType: "chat.messages.read",
        entityType: "chat_conversations",
        entityId: conversationId,
        payload: {
          conversationId,
          readerUserId: userId,
          messageIds: updatedRows.map((row) => row.id || row),
        },
      });
      return { rows: updatedRows, event: realtimeEvent };
    });

    const messageIds = rows.map((row) => row.id || row);
    return {
      messages: await this.findMessagesByIds(messageIds),
      event,
    };
  }

  conversationUserIds(conversation) {
    if (conversation.type === "chat_group") {
      return Array.isArray(conversation.group_member_user_ids)
        ? conversation.group_member_user_ids.filter(Boolean)
        : [];
    }

    return [
      conversation.admin_user_id,
      conversation.coach_user_id,
      conversation.player_user_id,
      conversation.parent_user_id,
    ].filter(Boolean);
  }

  async findMessageByAttachmentUrl(attachmentUrl) {
    const hotMessage = await this.db("chat_messages")
      .where({ attachment_url: attachmentUrl })
      .whereNull("deleted_at")
      .first();
    if (hotMessage) return hotMessage;
    if (!(await this.db.schema.hasTable("chat_messages_archive"))) return null;
    return this.db("chat_messages_archive")
      .where({ attachment_url: attachmentUrl })
      .whereNull("deleted_at")
      .first();
  }

}

module.exports = ChatRepository;
