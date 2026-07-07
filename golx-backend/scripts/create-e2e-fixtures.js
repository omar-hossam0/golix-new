require("dotenv").config();

const bcrypt = require("bcrypt");
const crypto = require("node:crypto");
const { Client } = require("pg");

const PASSWORD = process.env.E2E_PASSWORD;
const FIXTURE = "GOALIX_E2E_FIXTURE";

if (!PASSWORD) {
  throw new Error("E2E_PASSWORD is required before creating E2E fixtures.");
}

const ACCOUNTS = {
  admin: {
    role: "admin",
    username: "e2e.admin",
    email: "e2e.admin@goalix.local",
    phone: "01090002001",
    fullName: "Goalix Test Admin",
  },
  coach: {
    role: "coach",
    username: "e2e.coach",
    email: "e2e.coach@goalix.local",
    phone: "01090002002",
    fullName: "Karim Test Coach",
  },
  player: {
    role: "player",
    username: "e2e.player",
    email: null,
    phone: "01090002003",
    fullName: "Omar Test Player",
  },
  playerTwo: {
    role: "player",
    username: "e2e.player2",
    email: null,
    phone: "01090002004",
    fullName: "Lina Test Player",
  },
  parent: {
    role: "parent",
    username: "e2e.parent",
    email: "e2e.parent@goalix.local",
    phone: "01090002005",
    fullName: "Salma Test Parent",
  },
};

function id() {
  return crypto.randomUUID();
}

function dayOffset(days) {
  const value = new Date();
  value.setUTCHours(16, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

async function one(client, text, params = []) {
  const result = await client.query(text, params);
  return result.rows[0] || null;
}

async function upsertAuthUser(client, account, passwordHash, academyId, branchId) {
  let user = await one(
    client,
    `SELECT *
       FROM auth_users
      WHERE lower(username) = lower($1)
         OR ($2::text IS NOT NULL AND lower(email) = lower($2))
      ORDER BY deleted_at NULLS FIRST
      LIMIT 1`,
    [account.username, account.email],
  );

  if (!user) {
    user = await one(
      client,
      `INSERT INTO auth_users (
         id, username, email, phone, password_hash, role, academy_id, branch_id,
         is_active, is_verified, totp_enabled, failed_login_attempts
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,true,false,0)
       RETURNING *`,
      [
        id(),
        account.username,
        account.email,
        account.phone,
        passwordHash,
        account.role,
        academyId,
        branchId,
      ],
    );
  } else {
    user = await one(
      client,
      `UPDATE auth_users
          SET username = $2,
              email = $3,
              phone = $4,
              password_hash = $5,
              role = $6,
              academy_id = $7,
              branch_id = $8,
              is_active = true,
              is_verified = true,
              totp_enabled = false,
              totp_secret = NULL,
              totp_verified_at = NULL,
              failed_login_attempts = 0,
              locked_until = NULL,
              last_failed_login_at = NULL,
              deleted_at = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *`,
      [
        user.id,
        account.username,
        account.email,
        account.phone,
        passwordHash,
        account.role,
        academyId,
        branchId,
      ],
    );
  }

  await client.query(
    `INSERT INTO iam_users (
       id, username, email, phone, password_hash, full_name, is_active,
       is_verified, is_anonymized, totp_enabled, failed_login_attempts
     ) VALUES ($1,$2,$3,$4,$5,$6,true,true,false,false,0)
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       is_active = true,
       is_verified = true,
       is_anonymized = false,
       totp_enabled = false,
       totp_secret = NULL,
       failed_login_attempts = 0,
       locked_until = NULL,
       deleted_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [
      user.id,
      account.username,
      account.email,
      account.phone,
      passwordHash,
      account.fullName,
    ],
  );

  await client.query(
    `INSERT INTO iam_user_academies (
       id, user_id, academy_id, branch_id, status
     ) VALUES ($1,$2,$3,$4,'active')
     ON CONFLICT (user_id, academy_id) DO UPDATE SET
       branch_id = EXCLUDED.branch_id,
       status = 'active',
       revoked_at = NULL,
       revoked_by = NULL,
       revoke_reason = NULL,
       deleted_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [id(), user.id, academyId, branchId],
  );

  return user;
}

async function assignRole(client, userId, academyId, roleCode, branchId = null) {
  const role = await one(
    client,
    "SELECT id FROM iam_roles WHERE code = $1 LIMIT 1",
    [roleCode],
  );
  if (!role) throw new Error(`IAM role is missing: ${roleCode}`);

  const current = await one(
    client,
    `SELECT id
       FROM iam_user_roles
      WHERE user_id = $1
        AND role_id = $2
        AND academy_id = $3
        AND COALESCE(scope_branch_id, '00000000-0000-0000-0000-000000000000') =
            COALESCE($4::uuid, '00000000-0000-0000-0000-000000000000')
        AND scope_group_id IS NULL
        AND revoked_at IS NULL
      LIMIT 1`,
    [userId, role.id, academyId, branchId],
  );

  if (current) {
    await client.query(
      `UPDATE iam_user_roles
          SET expires_at = NULL,
              revoked_at = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [current.id],
    );
    return;
  }

  await client.query(
    `INSERT INTO iam_user_roles (
       id, user_id, role_id, academy_id, scope_branch_id
     ) VALUES ($1,$2,$3,$4,$5)`,
    [id(), userId, role.id, academyId, branchId],
  );
}

async function resetAuthRuntimeState(client, users) {
  const userIds = Object.values(users).map((user) => user.id);
  await client.query(
    "DELETE FROM auth_totp_backup_codes WHERE user_id = ANY($1::uuid[])",
    [userIds],
  );
  await client.query(
    "DELETE FROM auth_totp_devices WHERE user_id = ANY($1::uuid[])",
    [userIds],
  );
  await client.query(
    "DELETE FROM auth_refresh_tokens WHERE user_id = ANY($1::uuid[])",
    [userIds],
  );
}

async function upsertCoachProfile(client, user, academyId, branchId) {
  const existing = await one(
    client,
    "SELECT id FROM coach_profiles WHERE user_id = $1 LIMIT 1",
    [user.id],
  );
  const values = [
    user.id,
    academyId,
    branchId,
    ACCOUNTS.coach.fullName,
    "Karim",
    "Test Coach",
    ACCOUNTS.coach.email,
    ACCOUNTS.coach.phone,
  ];

  if (existing) {
    return one(
      client,
      `UPDATE coach_profiles
          SET academy_id=$2, branch_id=$3, full_name=$4, first_name=$5,
              last_name=$6, email=$7, phone=$8, role='head_coach',
              specialization='Performance Development',
              bio='Dedicated E2E coach profile for complete platform testing.',
              deleted_at=NULL, updated_at=CURRENT_TIMESTAMP
        WHERE id=$1
        RETURNING *`,
      [existing.id, ...values.slice(1)],
    );
  }

  return one(
    client,
    `INSERT INTO coach_profiles (
       id, user_id, academy_id, branch_id, full_name, first_name, last_name,
       email, phone, role, specialization, bio
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'head_coach',
       'Performance Development',
       'Dedicated E2E coach profile for complete platform testing.')
     RETURNING *`,
    [id(), ...values],
  );
}

async function upsertGroup(client, branchId) {
  const existing = await one(
    client,
    `SELECT id FROM academy_groups
      WHERE branch_id=$1 AND name='E2E Elite Squad'
      ORDER BY deleted_at NULLS FIRST LIMIT 1`,
    [branchId],
  );
  if (existing) {
    return one(
      client,
      `UPDATE academy_groups
          SET description=$2, assignment_mode='players', max_players=24,
              is_active=true, deleted_at=NULL, updated_at=CURRENT_TIMESTAMP
        WHERE id=$1 RETURNING *`,
      [existing.id, `${FIXTURE}: isolated full-flow testing group`],
    );
  }
  return one(
    client,
    `INSERT INTO academy_groups (
       id, branch_id, name, description, assignment_mode, max_players, is_active
     ) VALUES ($1,$2,'E2E Elite Squad',$3,'players',24,true)
     RETURNING *`,
    [id(), branchId, `${FIXTURE}: isolated full-flow testing group`],
  );
}

async function upsertPlayerProfile(
  client,
  user,
  academyId,
  branchId,
  details,
) {
  const existing = await one(
    client,
    "SELECT id FROM player_profiles WHERE user_id=$1 LIMIT 1",
    [user.id],
  );
  const data = [
    user.id,
    academyId,
    branchId,
    details.fullName,
    details.dateOfBirth,
    details.level,
    details.position,
    details.foot,
    details.code,
    details.phone,
    details.guardianName,
    details.guardianPhone,
  ];

  if (existing) {
    return one(
      client,
      `UPDATE player_profiles
          SET user_id=$2, academy_id=$3, branch_id=$4, full_name=$5,
              date_of_birth=$6, level=$7, position=$8, preferred_foot=$9,
              player_code=$10, phone=$11, guardian_name=$12, guardian_phone=$13,
              guardian_relation='mother', nationality='Egyptian',
              profile_status='complete',
              profile_completed_at=CURRENT_TIMESTAMP, date_joined=CURRENT_DATE - 180,
              is_active=true, deleted_at=NULL, updated_at=CURRENT_TIMESTAMP
        WHERE id=$1 RETURNING *`,
      [existing.id, ...data],
    );
  }

  return one(
    client,
    `INSERT INTO player_profiles (
       id, user_id, academy_id, branch_id, full_name, date_of_birth, level,
       position, preferred_foot, player_code, phone, guardian_name, guardian_phone,
       guardian_relation, nationality, profile_status,
       profile_completed_at, date_joined, is_active
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
       'mother','Egyptian','complete',
       CURRENT_TIMESTAMP,CURRENT_DATE - 180,true
     ) RETURNING *`,
    [id(), ...data],
  );
}

async function attachCoachAndPlayers(client, coachId, groupId, playerIds) {
  await client.query(
    `INSERT INTO coach_group_assignments (
       id, coach_id, group_id, role, can_create_training,
       can_take_attendance, can_evaluate_players
     ) VALUES ($1,$2,$3,'head_coach',true,true,true)
     ON CONFLICT (coach_id, group_id) DO UPDATE SET
       role='head_coach', can_create_training=true,
       can_take_attendance=true, can_evaluate_players=true`,
    [id(), coachId, groupId],
  );

  for (const playerId of playerIds) {
    const current = await one(
      client,
      `SELECT id FROM player_group_assignments
        WHERE player_id=$1 AND group_id=$2
        ORDER BY left_at NULLS FIRST LIMIT 1`,
      [playerId, groupId],
    );
    if (current) {
      await client.query(
        `UPDATE player_group_assignments
            SET left_at=NULL, joined_at=COALESCE(joined_at,CURRENT_TIMESTAMP)
          WHERE id=$1`,
        [current.id],
      );
    } else {
      await client.query(
        `INSERT INTO player_group_assignments (id,player_id,group_id)
         VALUES ($1,$2,$3)`,
        [id(), playerId, groupId],
      );
    }
  }
}

async function upsertParentLinks(
  client,
  parentId,
  academyId,
  adminId,
  playerOne,
  playerTwo,
) {
  await client.query(
    `UPDATE parent_player_links
        SET is_primary=false, updated_at=CURRENT_TIMESTAMP
      WHERE parent_user_id=$1 AND deleted_at IS NULL`,
    [parentId],
  );

  const links = [
    {
      playerId: playerOne.id,
      relation: "mother",
      primary: true,
      progress: true,
      payments: true,
      message: true,
    },
    {
      playerId: playerTwo.id,
      relation: "mother",
      primary: false,
      progress: true,
      payments: false,
      message: true,
    },
  ];

  for (const link of links) {
    const current = await one(
      client,
      `SELECT id FROM parent_player_links
        WHERE parent_user_id=$1 AND player_id=$2
        ORDER BY deleted_at NULLS FIRST LIMIT 1`,
      [parentId, link.playerId],
    );
    if (current) {
      await client.query(
        `UPDATE parent_player_links
            SET academy_id=$2, relation=$3, is_primary=$4,
                can_view_progress=$5, can_view_payments=$6,
                can_message_coach=$7, created_by_user_id=$8,
                deleted_at=NULL, updated_at=CURRENT_TIMESTAMP
          WHERE id=$1`,
        [
          current.id,
          academyId,
          link.relation,
          link.primary,
          link.progress,
          link.payments,
          link.message,
          adminId,
        ],
      );
    } else {
      await client.query(
        `INSERT INTO parent_player_links (
           id, academy_id, parent_user_id, player_id, relation, is_primary,
           can_view_progress, can_view_payments, can_message_coach,
           created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          id(),
          academyId,
          parentId,
          link.playerId,
          link.relation,
          link.primary,
          link.progress,
          link.payments,
          link.message,
          adminId,
        ],
      );
    }
  }

  await client.query(
    "UPDATE auth_users SET linked_player_id=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1",
    [parentId, playerOne.id],
  );
}

async function upsertEvent(
  client,
  academyId,
  groupId,
  creatorId,
  data,
) {
  let event = await one(
    client,
    `SELECT id FROM calendar_events
      WHERE academy_id=$1 AND title=$2 AND notes LIKE $3
      ORDER BY deleted_at NULLS FIRST LIMIT 1`,
    [academyId, data.title, `${FIXTURE}%`],
  );
  const values = [
    academyId,
    data.title,
    data.type,
    data.start,
    data.end,
    data.location,
    data.status,
    creatorId,
    data.notes,
  ];
  if (event) {
    event = await one(
      client,
      `UPDATE calendar_events
          SET academy_id=$2, title=$3, event_type=$4, start_datetime=$5,
              end_datetime=$6, location=$7, status=$8,
              visibility='selected_groups', created_by_user_id=$9,
              created_by_role='admin', notes=$10, deleted_at=NULL,
              updated_at=CURRENT_TIMESTAMP
        WHERE id=$1 RETURNING *`,
      [event.id, ...values],
    );
  } else {
    event = await one(
      client,
      `INSERT INTO calendar_events (
         id, academy_id, title, event_type, start_datetime, end_datetime,
         location, status, visibility, created_by_user_id, created_by_role, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'selected_groups',$9,'admin',$10)
       RETURNING *`,
      [id(), ...values],
    );
  }

  await client.query(
    `INSERT INTO calendar_event_groups (id,event_id,group_id)
     VALUES ($1,$2,$3)
     ON CONFLICT (event_id,group_id) DO NOTHING`,
    [id(), event.id, groupId],
  );
  return event;
}

async function createTrainingData(
  client,
  academyId,
  groupId,
  adminId,
  coachId,
  players,
) {
  const specs = [
    { days: -14, title: "E2E Ball Control Session", focus: "ball_control", intensity: "medium" },
    { days: -7, title: "E2E Speed and Agility Session", focus: "agility", intensity: "high" },
    { days: -2, title: "E2E Tactical Awareness Session", focus: "tactics", intensity: "medium" },
    { days: 3, title: "E2E Finishing Development Session", focus: "finishing", intensity: "high" },
  ];
  const events = [];

  for (const spec of specs) {
    const start = dayOffset(spec.days);
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    const event = await upsertEvent(client, academyId, groupId, adminId, {
      title: spec.title,
      type: "training",
      start,
      end,
      location: "Goalix Performance Pitch",
      status: spec.days < 0 ? "finished" : "scheduled",
      notes: `${FIXTURE}: ${spec.focus} training`,
    });
    events.push(event);

    await client.query(
      `INSERT INTO training_sessions (
         id,event_id,coach_id,training_focus,intensity_level,objectives,
         session_plan,equipment_needed,coach_notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (event_id) DO UPDATE SET
         coach_id=EXCLUDED.coach_id,
         training_focus=EXCLUDED.training_focus,
         intensity_level=EXCLUDED.intensity_level,
         objectives=EXCLUDED.objectives,
         session_plan=EXCLUDED.session_plan,
         equipment_needed=EXCLUDED.equipment_needed,
         coach_notes=EXCLUDED.coach_notes,
         updated_at=CURRENT_TIMESTAMP`,
      [
        id(),
        event.id,
        coachId,
        spec.focus,
        spec.intensity,
        "Improve technical execution, decision making, and match readiness.",
        "Warm-up, progressive drills, game scenario, recovery.",
        "Balls, cones, bibs, mini goals, GPS vests.",
        `${FIXTURE}: visible coach session note`,
      ],
    );

    if (spec.days < 0) {
      for (let index = 0; index < players.length; index += 1) {
        const player = players[index];
        const status =
          spec.days === -7 && index === 1
            ? "late"
            : spec.days === -14 && index === 1
              ? "excused"
              : "present";
        await client.query(
          `INSERT INTO event_attendance (
             id,event_id,player_id,status,arrival_time,marked_by_coach_id,notes
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (event_id,player_id) DO UPDATE SET
             status=EXCLUDED.status,
             arrival_time=EXCLUDED.arrival_time,
             marked_by_coach_id=EXCLUDED.marked_by_coach_id,
             notes=EXCLUDED.notes,
             updated_at=CURRENT_TIMESTAMP`,
          [
            id(),
            event.id,
            player.id,
            status,
            status === "late" ? "16:12" : "15:55",
            coachId,
            `${FIXTURE}: attendance record`,
          ],
        );

        await client.query(
          `INSERT INTO player_event_evaluations (
             id,event_id,player_id,coach_id,overall_rating,technical_rating,
             tactical_rating,physical_rating,mentality_rating,discipline_rating,
             teamwork_rating,impact_rating,strengths,weaknesses,coach_notes,
             improvement_plan,visibility,ball_control_rating,passing_accuracy_rating,
             shooting_rating,dribbling_rating,speed_rating,endurance_rating,
             agility_rating,development_notes,fatigue_rating
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
             'player_and_parent',$17,$18,$19,$20,$21,$22,$23,$24,$25
           )
           ON CONFLICT (event_id,player_id,coach_id) DO UPDATE SET
             overall_rating=EXCLUDED.overall_rating,
             technical_rating=EXCLUDED.technical_rating,
             tactical_rating=EXCLUDED.tactical_rating,
             physical_rating=EXCLUDED.physical_rating,
             mentality_rating=EXCLUDED.mentality_rating,
             discipline_rating=EXCLUDED.discipline_rating,
             teamwork_rating=EXCLUDED.teamwork_rating,
             impact_rating=EXCLUDED.impact_rating,
             strengths=EXCLUDED.strengths,
             weaknesses=EXCLUDED.weaknesses,
             coach_notes=EXCLUDED.coach_notes,
             improvement_plan=EXCLUDED.improvement_plan,
             visibility='player_and_parent',
             ball_control_rating=EXCLUDED.ball_control_rating,
             passing_accuracy_rating=EXCLUDED.passing_accuracy_rating,
             shooting_rating=EXCLUDED.shooting_rating,
             dribbling_rating=EXCLUDED.dribbling_rating,
             speed_rating=EXCLUDED.speed_rating,
             endurance_rating=EXCLUDED.endurance_rating,
             agility_rating=EXCLUDED.agility_rating,
             development_notes=EXCLUDED.development_notes,
             fatigue_rating=EXCLUDED.fatigue_rating,
             updated_at=CURRENT_TIMESTAMP`,
          [
            id(),
            event.id,
            player.id,
            coachId,
            index === 0 ? 8.7 : 8.2,
            index === 0 ? 8.9 : 8.1,
            8.4,
            8.3,
            8.8,
            9.0,
            8.6,
            8.5,
            "Fast learning, positive movement, and strong team communication.",
            "Improve weak-foot execution under pressure.",
            "A strong session with visible progress.",
            "Repeat the focused drill twice before the next session.",
            8.8,
            8.5,
            8.1,
            8.7,
            8.4,
            8.2,
            8.6,
            `${FIXTURE}: development is on track`,
            3.0,
          ],
        );
      }
    }
  }
  return events;
}

async function createMeasurements(client, coachUserId, players) {
  for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
    const player = players[playerIndex];
    await client.query(
      "DELETE FROM player_measurements WHERE player_id=$1 AND notes LIKE $2",
      [player.id, `${FIXTURE}%`],
    );
    for (const monthsAgo of [2, 1, 0]) {
      const measuredAt = new Date();
      measuredAt.setUTCMonth(measuredAt.getUTCMonth() - monthsAgo);
      measuredAt.setUTCDate(5);
      await client.query(
        `INSERT INTO player_measurements (
           id,player_id,height_cm,weight_kg,measured_at,measured_by,notes,bmi,
           sprint_speed,stamina,flexibility
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          id(),
          player.id,
          164 + playerIndex * 3 + (2 - monthsAgo) * 0.4,
          54 + playerIndex * 4 + (2 - monthsAgo) * 0.5,
          dateOnly(measuredAt),
          coachUserId,
          `${FIXTURE}: monthly performance measurement`,
          20.1 + playerIndex * 0.4,
          28.8 + playerIndex + (2 - monthsAgo) * 0.7,
          80 + playerIndex + (2 - monthsAgo) * 2,
          76 + playerIndex + (2 - monthsAgo),
        ],
      );
    }
  }
}

async function createMatch(
  client,
  academyId,
  groupId,
  adminId,
  coachId,
  players,
  data,
) {
  const start = dayOffset(data.days);
  const event = await upsertEvent(client, academyId, groupId, adminId, {
    title: data.title,
    type: "match",
    start,
    end: new Date(start.getTime() + 105 * 60 * 1000),
    location: data.location,
    status: data.finished ? "finished" : "scheduled",
    notes: `${FIXTURE}: match event`,
  });
  let match = await one(
    client,
    "SELECT id FROM matches WHERE event_id=$1 LIMIT 1",
    [event.id],
  );
  const values = [
    event.id,
    groupId,
    groupId,
    data.opponent,
    data.finished ? "official" : "friendly",
    dateOnly(start),
    "18:00",
    data.location,
    data.finished ? "home" : "away",
    data.finished ? "completed" : "scheduled",
    data.finished ? "finished" : "scheduled",
    adminId,
  ];
  if (match) {
    match = await one(
      client,
      `UPDATE matches
          SET event_id=$2,team_id=$3,age_group_id=$4,opponent_name=$5,
              match_type=$6,match_date=$7,match_time=$8,location=$9,
              venue_type=$10,status=$11,match_status=$12,
              created_by_admin_id=$13,organizer_notes=$14,
              our_score=$15,opponent_score=$16,
              evaluations_finalized_at=$17,
              evaluations_finalized_by_coach_id=$18,
              deleted_at=NULL,updated_at=CURRENT_TIMESTAMP
        WHERE id=$1 RETURNING *`,
      [
        match.id,
        ...values,
        `${FIXTURE}: configured match`,
        data.finished ? 3 : null,
        data.finished ? 1 : null,
        data.finished ? start : null,
        data.finished ? coachId : null,
      ],
    );
  } else {
    match = await one(
      client,
      `INSERT INTO matches (
         id,event_id,team_id,age_group_id,opponent_name,match_type,match_date,
         match_time,location,venue_type,status,match_status,created_by_admin_id,
         organizer_notes,our_score,opponent_score,evaluations_finalized_at,
         evaluations_finalized_by_coach_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        id(),
        ...values,
        `${FIXTURE}: configured match`,
        data.finished ? 3 : null,
        data.finished ? 1 : null,
        data.finished ? start : null,
        data.finished ? coachId : null,
      ],
    );
  }

  for (let index = 0; index < players.length; index += 1) {
    const player = players[index];
    await client.query(
      `INSERT INTO match_squads (
         id,match_id,player_id,selected_by_coach_id,squad_role,position,
         shirt_number,player_instruction,player_name_snapshot,profile_status_snapshot
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'complete')
       ON CONFLICT (match_id,player_id) DO UPDATE SET
         selected_by_coach_id=EXCLUDED.selected_by_coach_id,
         squad_role=EXCLUDED.squad_role,
         position=EXCLUDED.position,
         shirt_number=EXCLUDED.shirt_number,
         player_instruction=EXCLUDED.player_instruction,
         player_name_snapshot=EXCLUDED.player_name_snapshot,
         profile_status_snapshot='complete',
         updated_at=CURRENT_TIMESTAMP`,
      [
        id(),
        match.id,
        player.id,
        coachId,
        index === 0 ? "starter" : "substitute",
        index === 0 ? "RW" : "CM",
        index === 0 ? 11 : 8,
        "Stay compact, scan before receiving, and attack space quickly.",
        player.full_name,
      ],
    );

    if (data.finished) {
      await client.query(
        `INSERT INTO match_attendance (
           id,match_id,player_id,status,marked_by_coach_id,notes
         ) VALUES ($1,$2,$3,'present',$4,$5)
         ON CONFLICT (match_id,player_id) DO UPDATE SET
           status='present',marked_by_coach_id=EXCLUDED.marked_by_coach_id,
           notes=EXCLUDED.notes,updated_at=CURRENT_TIMESTAMP`,
        [id(), match.id, player.id, coachId, `${FIXTURE}: match attendance`],
      );
      await client.query(
        `INSERT INTO match_player_stats (
           id,match_id,player_id,minutes_played,goals,assists,performance_score,
           pass_accuracy,key_passes,successful_dribbles,tackles,interceptions,
           fouls,yellow_cards,red_cards,man_of_the_match,passes_completed,saves,
           performance_rating,coach_notes,created_by_coach_id,
           pass_accuracy_percentage,shots_total,shots_on_target,defensive_tackles,
           duels_won,duels_lost,possession_losses,technical_rating,tactical_rating,
           physical_rating,mentality_rating,decision_making_rating,work_rate_rating,
           positioning_rating,strengths,weaknesses,improvement_plan,fatigue_rating
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,0,$14,$15,0,$16,$17,$18,
           $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36
         )
         ON CONFLICT (match_id,player_id) DO UPDATE SET
           minutes_played=EXCLUDED.minutes_played,goals=EXCLUDED.goals,
           assists=EXCLUDED.assists,performance_score=EXCLUDED.performance_score,
           pass_accuracy=EXCLUDED.pass_accuracy,key_passes=EXCLUDED.key_passes,
           successful_dribbles=EXCLUDED.successful_dribbles,tackles=EXCLUDED.tackles,
           interceptions=EXCLUDED.interceptions,fouls=EXCLUDED.fouls,
           man_of_the_match=EXCLUDED.man_of_the_match,
           passes_completed=EXCLUDED.passes_completed,
           performance_rating=EXCLUDED.performance_rating,
           coach_notes=EXCLUDED.coach_notes,
           created_by_coach_id=EXCLUDED.created_by_coach_id,
           pass_accuracy_percentage=EXCLUDED.pass_accuracy_percentage,
           shots_total=EXCLUDED.shots_total,shots_on_target=EXCLUDED.shots_on_target,
           defensive_tackles=EXCLUDED.defensive_tackles,duels_won=EXCLUDED.duels_won,
           duels_lost=EXCLUDED.duels_lost,possession_losses=EXCLUDED.possession_losses,
           technical_rating=EXCLUDED.technical_rating,
           tactical_rating=EXCLUDED.tactical_rating,
           physical_rating=EXCLUDED.physical_rating,
           mentality_rating=EXCLUDED.mentality_rating,
           decision_making_rating=EXCLUDED.decision_making_rating,
           work_rate_rating=EXCLUDED.work_rate_rating,
           positioning_rating=EXCLUDED.positioning_rating,
           strengths=EXCLUDED.strengths,weaknesses=EXCLUDED.weaknesses,
           improvement_plan=EXCLUDED.improvement_plan,
           fatigue_rating=EXCLUDED.fatigue_rating,
           updated_at=CURRENT_TIMESTAMP`,
        [
          id(),
          match.id,
          player.id,
          index === 0 ? 90 : 35,
          index === 0 ? 2 : 0,
          index === 0 ? 1 : 1,
          index === 0 ? 9.1 : 7.9,
          index === 0 ? 88 : 84,
          index === 0 ? 4 : 2,
          index === 0 ? 6 : 2,
          index === 0 ? 2 : 4,
          2,
          1,
          index === 0,
          index === 0 ? 42 : 18,
          index === 0 ? 9.1 : 7.9,
          "Good tactical discipline and positive impact.",
          coachId,
          index === 0 ? 88 : 84,
          index === 0 ? 5 : 2,
          index === 0 ? 4 : 1,
          index === 0 ? 2 : 4,
          index === 0 ? 8 : 5,
          index === 0 ? 3 : 4,
          index === 0 ? 6 : 3,
          index === 0 ? 9.2 : 8.0,
          8.5,
          8.6,
          8.8,
          8.7,
          8.9,
          8.6,
          "Acceleration, movement between lines, and final-third decisions.",
          "Can improve defensive tracking after possession loss.",
          "Add one transition recovery block to the weekly plan.",
          4.0,
        ],
      );
    }
  }
  return match;
}

async function upsertParentNote(
  client,
  academyId,
  parentId,
  playerId,
  coachUserId,
) {
  const existing = await one(
    client,
    `SELECT id FROM parent_player_notes
      WHERE parent_user_id=$1 AND player_id=$2 AND title='E2E recovery follow-up'
      ORDER BY deleted_at NULLS FIRST LIMIT 1`,
    [parentId, playerId],
  );
  if (existing) {
    await client.query(
      `UPDATE parent_player_notes
          SET academy_id=$2,coach_user_id=$3,category='wellness',
              body=$4,visibility='family',status='reviewed',
              coach_response=$5,responded_by_user_id=$3,
              responded_at=CURRENT_TIMESTAMP,deleted_at=NULL,
              updated_at=CURRENT_TIMESTAMP
        WHERE id=$1`,
      [
        existing.id,
        academyId,
        coachUserId,
        `${FIXTURE}: Omar slept well and reported no pain after training.`,
        "Thanks. Keep hydration high and use the planned recovery routine.",
      ],
    );
    return;
  }
  await client.query(
    `INSERT INTO parent_player_notes (
       id,academy_id,parent_user_id,player_id,coach_user_id,category,title,body,
       visibility,status,coach_response,responded_by_user_id,responded_at
     ) VALUES ($1,$2,$3,$4,$5,'wellness','E2E recovery follow-up',$6,
       'family','reviewed',$7,$5,CURRENT_TIMESTAMP)`,
    [
      id(),
      academyId,
      parentId,
      playerId,
      coachUserId,
      `${FIXTURE}: Omar slept well and reported no pain after training.`,
      "Thanks. Keep hydration high and use the planned recovery routine.",
    ],
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const academy = await one(
      client,
      `SELECT id FROM academy_academies
        WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`,
    );
    if (!academy) throw new Error("No active academy found");
    const branch = await one(
      client,
      `SELECT id FROM academy_branches
        WHERE academy_id=$1 AND deleted_at IS NULL
        ORDER BY CASE WHEN name='Heliopolis Branch' THEN 0 ELSE 1 END, created_at
        LIMIT 1`,
      [academy.id],
    );
    if (!branch) throw new Error("No active branch found");

    const passwordHash = await bcrypt.hash(
      PASSWORD,
      Number(process.env.BCRYPT_ROUNDS || 12),
    );
    const users = {};
    for (const [key, account] of Object.entries(ACCOUNTS)) {
      users[key] = await upsertAuthUser(
        client,
        account,
        passwordHash,
        academy.id,
        branch.id,
      );
    }
    await resetAuthRuntimeState(client, users);

    await assignRole(client, users.admin.id, academy.id, "academy_admin");
    await assignRole(client, users.coach.id, academy.id, "head_coach", branch.id);
    await assignRole(client, users.player.id, academy.id, "player");
    await assignRole(client, users.playerTwo.id, academy.id, "player");
    await assignRole(client, users.parent.id, academy.id, "parent");

    await client.query(
      `INSERT INTO admin_accounts (id,user_id,academy_id,admin_type,is_active)
       VALUES ($1,$2,$3,'academy_admin',true)
       ON CONFLICT (user_id) DO UPDATE SET
         academy_id=EXCLUDED.academy_id,admin_type='academy_admin',
         is_active=true,disabled_at=NULL,disabled_by=NULL,disabled_reason=NULL,
         deleted_at=NULL,updated_at=CURRENT_TIMESTAMP`,
      [id(), users.admin.id, academy.id],
    );
    await client.query(
      `INSERT INTO admin_profiles (user_id,job_title,department)
       VALUES ($1,'Platform Test Administrator','Quality Assurance')
       ON CONFLICT (user_id) DO UPDATE SET
         job_title=EXCLUDED.job_title,department=EXCLUDED.department,
         updated_at=CURRENT_TIMESTAMP`,
      [users.admin.id],
    );

    const coach = await upsertCoachProfile(
      client,
      users.coach,
      academy.id,
      branch.id,
    );
    const group = await upsertGroup(client, branch.id);
    const playerOne = await upsertPlayerProfile(
      client,
      users.player,
      academy.id,
      branch.id,
      {
        fullName: ACCOUNTS.player.fullName,
        dateOfBirth: "2011-04-14",
        level: "A",
        position: "RW",
        foot: "left",
        code: "E2E-PLAYER-01",
        phone: ACCOUNTS.player.phone,
        shirtNumber: 11,
        style: "Direct winger with strong acceleration and creative passing.",
        experience: 4,
        guardianName: ACCOUNTS.parent.fullName,
        guardianPhone: ACCOUNTS.parent.phone,
      },
    );
    const playerTwo = await upsertPlayerProfile(
      client,
      users.playerTwo,
      academy.id,
      branch.id,
      {
        fullName: ACCOUNTS.playerTwo.fullName,
        dateOfBirth: "2012-09-03",
        level: "B",
        position: "CM",
        foot: "right",
        code: "E2E-PLAYER-02",
        phone: ACCOUNTS.playerTwo.phone,
        shirtNumber: 8,
        style: "Composed central midfielder with good scanning and ball retention.",
        experience: 3,
        guardianName: ACCOUNTS.parent.fullName,
        guardianPhone: ACCOUNTS.parent.phone,
      },
    );

    await attachCoachAndPlayers(client, coach.id, group.id, [
      playerOne.id,
      playerTwo.id,
    ]);
    await upsertParentLinks(
      client,
      users.parent.id,
      academy.id,
      users.admin.id,
      playerOne,
      playerTwo,
    );
    await createTrainingData(
      client,
      academy.id,
      group.id,
      users.admin.id,
      coach.id,
      [playerOne, playerTwo],
    );
    await createMeasurements(client, users.coach.id, [playerOne, playerTwo]);
    await createMatch(
      client,
      academy.id,
      group.id,
      users.admin.id,
      coach.id,
      [playerOne, playerTwo],
      {
        days: -5,
        title: "E2E Goalix vs Future Stars",
        opponent: "Future Stars Academy",
        location: "Goalix Arena",
        finished: true,
      },
    );
    await createMatch(
      client,
      academy.id,
      group.id,
      users.admin.id,
      coach.id,
      [playerOne, playerTwo],
      {
        days: 6,
        title: "E2E Goalix vs City Juniors",
        opponent: "City Juniors",
        location: "City Juniors Stadium",
        finished: false,
      },
    );
    await upsertParentNote(
      client,
      academy.id,
      users.parent.id,
      playerOne.id,
      users.coach.id,
    );

    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          password: PASSWORD,
          accounts: {
            admin: { email: ACCOUNTS.admin.email, role: "admin" },
            coach: {
              email: ACCOUNTS.coach.email,
              username: ACCOUNTS.coach.username,
              role: "coach",
            },
            player: { username: ACCOUNTS.player.username, role: "player" },
            secondaryPlayer: {
              username: ACCOUNTS.playerTwo.username,
              role: "player",
            },
            parent: { username: ACCOUNTS.parent.username, role: "parent" },
          },
          academyId: academy.id,
          branchId: branch.id,
          groupId: group.id,
          coachId: coach.id,
          playerIds: [playerOne.id, playerTwo.id],
          parentUserId: users.parent.id,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
