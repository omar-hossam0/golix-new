require("dotenv").config();

const { Client } = require("pg");
const { generate: generateTotp } = require("otplib");

const BASE_URL = process.env.E2E_API_URL || "http://127.0.0.1:3000";
const PASSWORD = process.env.E2E_PASSWORD;
const RUN_ID = Date.now().toString(36);
const NOTE_TITLE = `E2E API note ${RUN_ID}`;
const CHAT_BODY = `E2E parent-coach message ${RUN_ID}`;

const results = [];

if (!PASSWORD) {
  throw new Error("E2E_PASSWORD is required before running role E2E tests.");
}

function record(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function rowsOf(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function cookieMap(cookie = "") {
  return Object.fromEntries(
    cookie
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1 ? [part, ""] : [part.slice(0, index), part.slice(index + 1)];
      }),
  );
}

function serializeCookies(cookies) {
  return Object.entries(cookies)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function mergeResponseCookies(cookie, response) {
  const merged = cookieMap(cookie);
  const rawCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie().join(", ")
    : response.headers.get("set-cookie") || "";

  for (const name of ["accessToken", "refreshToken", "csrfToken"]) {
    const match = rawCookies.match(new RegExp(`${name}=([^;]+)`));
    if (match) merged[name] = match[1];
  }

  return serializeCookies(merged);
}

function csrfFromCookie(cookie) {
  return cookieMap(cookie).csrfToken || null;
}

async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const csrfToken = ["POST", "PUT", "PATCH", "DELETE"].includes(method) && options.cookie
    ? csrfFromCookie(options.cookie)
    : null;
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body, cookie: mergeResponseCookies(options.cookie || "", response) };
}

async function ensureCsrfCookie(cookie) {
  const { response, body, cookie: nextCookie } = await request("/api/v1/csrf-token", { cookie });
  assert(response.status === 200, `CSRF bootstrap returned ${response.status}: ${JSON.stringify(body)}`);
  let mergedCookie = nextCookie;
  if (!csrfFromCookie(mergedCookie) && body?.data?.csrfToken) {
    const cookies = cookieMap(mergedCookie);
    cookies.csrfToken = body.data.csrfToken;
    mergedCookie = serializeCookies(cookies);
  }
  assert(csrfFromCookie(mergedCookie), "CSRF bootstrap did not provide csrfToken");
  return mergedCookie;
}

async function setupMfaIfRequired(name, cookie, loginBody) {
  if (!loginBody?.data?.mfaSetupRequired) return cookie;

  let nextCookie = await ensureCsrfCookie(cookie);
  const setup = await request("/api/v1/auth/2fa/setup", {
    method: "POST",
    cookie: nextCookie,
  });
  assert(setup.response.status === 200, `${name} MFA setup returned ${setup.response.status}: ${JSON.stringify(setup.body)}`);
  const secret = setup.body?.data?.secret;
  assert(secret, `${name} MFA setup did not return a TOTP secret`);

  nextCookie = setup.cookie || nextCookie;
  const token = await generateTotp({ secret });
  const verified = await request("/api/v1/auth/2fa/verify-setup", {
    method: "POST",
    cookie: nextCookie,
    body: JSON.stringify({ token }),
  });
  assert(verified.response.status === 200, `${name} MFA verify setup returned ${verified.response.status}: ${JSON.stringify(verified.body)}`);
  record(`${name} MFA setup`, true, "enabled");
  return verified.cookie || nextCookie;
}

async function login(name, path, payload, expectedRole) {
  const { response, body } = await request(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  assert(response.status === 200, `${name} login returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.success === true, `${name} login did not return success`);
  assert(body?.data?.user?.role === expectedRole, `${name} role mismatch`);
  let cookie = mergeResponseCookies("", response);
  assert(cookieMap(cookie).accessToken, "Login response did not set accessToken cookie");
  cookie = await setupMfaIfRequired(name, cookie, body);
  record(`${name} login`, true, expectedRole);
  return { cookie, user: body.data.user };
}

async function expectOk(name, path, cookie, validate) {
  const { response, body } = await request(path, { cookie });
  assert(response.status >= 200 && response.status < 300, `${path} returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.success === true, `${path} did not return success`);
  if (validate) validate(body.data, body);
  record(name, true, `${response.status}`);
  return body.data;
}

async function expectDenied(name, path, cookie) {
  const { response } = await request(path, { cookie });
  assert([401, 403].includes(response.status), `${path} should be denied but returned ${response.status}`);
  record(name, true, `${response.status}`);
}

async function postOk(name, path, cookie, payload, validate) {
  const { response, body } = await request(path, {
    method: "POST",
    cookie,
    body: JSON.stringify(payload),
  });
  assert(response.status >= 200 && response.status < 300, `${path} returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.success === true, `${path} did not return success`);
  if (validate) validate(body.data, body);
  record(name, true, `${response.status}`);
  return body.data;
}

async function patchOk(name, path, cookie, payload, validate) {
  const { response, body } = await request(path, {
    method: "PATCH",
    cookie,
    body: JSON.stringify(payload),
  });
  assert(response.status >= 200 && response.status < 300, `${path} returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.success === true, `${path} did not return success`);
  if (validate) validate(body.data, body);
  record(name, true, `${response.status}`);
  return body.data;
}

async function loadFixtureIds(db) {
  const query = async (text, params = []) => {
    const result = await db.query(text, params);
    return result.rows[0] || null;
  };
  const coach = await query(
    `SELECT cp.id,cp.user_id FROM coach_profiles cp
      JOIN auth_users au ON au.id=cp.user_id
      WHERE au.username='e2e.coach' AND cp.deleted_at IS NULL`,
  );
  const player = await query(
    `SELECT pp.id,pp.user_id FROM player_profiles pp
      JOIN auth_users au ON au.id=pp.user_id
      WHERE au.username='e2e.player' AND pp.deleted_at IS NULL`,
  );
  const playerTwo = await query(
    `SELECT pp.id,pp.user_id FROM player_profiles pp
      JOIN auth_users au ON au.id=pp.user_id
      WHERE au.username='e2e.player2' AND pp.deleted_at IS NULL`,
  );
  const parent = await query(
    "SELECT id FROM auth_users WHERE username='e2e.parent' AND deleted_at IS NULL",
  );
  assert(coach && player && playerTwo && parent, "E2E fixture records are incomplete");
  return { coach, player, playerTwo, parent };
}

async function cleanup(db) {
  await db.query(
    "DELETE FROM parent_player_notes WHERE title=$1",
    [NOTE_TITLE],
  );
  await db.query(
    "DELETE FROM chat_messages WHERE body=$1",
    [CHAT_BODY],
  );
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const fixture = await loadFixtureIds(db);

  try {
    const health = await request("/health");
    assert(health.response.status === 200 && health.body?.status === "ok", "Backend health check failed");
    record("Backend health", true, BASE_URL);

    const admin = await login(
      "Admin",
      "/api/v1/auth/admin/login",
      { email: "e2e.admin@goalix.local", password: PASSWORD },
      "admin",
    );
    const coach = await login(
      "Coach",
      "/api/v1/auth/admin/login",
      { email: "e2e.coach@goalix.local", password: PASSWORD, role: "coach" },
      "coach",
    );
    const player = await login(
      "Player",
      "/api/v1/auth/login",
      { username: "e2e.player", password: PASSWORD, role: "player" },
      "player",
    );
    const parent = await login(
      "Parent",
      "/api/v1/auth/login",
      { username: "e2e.parent", password: PASSWORD, role: "parent" },
      "parent",
    );

    for (const [name, session] of Object.entries({ Admin: admin, Coach: coach, Player: player, Parent: parent })) {
      await expectOk(`${name} session`, "/api/v1/auth/me", session.cookie, (data) => {
        const role = data?.role || data?.user?.role;
        assert(role === name.toLowerCase(), `${name} /me role mismatch`);
      });
      await expectOk(`${name} notifications`, "/api/v1/notifications?limit=5", session.cookie);
    }

    await expectOk("Admin dashboard data", "/api/v1/admin/dashboard", admin.cookie);
    await expectOk("Admin academy groups", "/api/v1/academy/groups?limit=50", admin.cookie, (data) => {
      const rows = Array.isArray(data) ? data : data?.data || [];
      assert(rows.some((row) => row.name === "E2E Elite Squad"), "E2E group is missing from admin API");
    });

    await expectOk("Coach dashboard data", "/api/v1/coaches/me/dashboard", coach.cookie);
    await expectOk("Coach assigned groups", "/api/v1/coach/groups", coach.cookie, (data) => {
      const rows = Array.isArray(data) ? data : data?.data || [];
      assert(
        rows.some((row) => (row.name || row.group_name) === "E2E Elite Squad"),
        "Coach cannot see E2E group",
      );
    });
    await expectOk("Coach assigned players", "/api/v1/coach/players?limit=50", coach.cookie, (data) => {
      const rows = data?.data || data || [];
      assert(rows.some((row) => row.id === fixture.player.id), "Coach cannot see primary E2E player");
      assert(rows.some((row) => row.id === fixture.playerTwo.id), "Coach cannot see secondary E2E player");
    });
    await expectOk("Coach matches", "/api/v1/coach/matches?limit=20", coach.cookie);
    await expectOk("Coach trainings", "/api/v1/coach/calendar-events?eventType=training&limit=20", coach.cookie);

    await expectOk("Player profile", "/api/v1/player/profile", player.cookie, (data) => {
      assert(data?.id === fixture.player.id || data?.profile?.id === fixture.player.id, "Wrong player profile returned");
    });
    await expectOk("Player calendar", "/api/v1/player/calendar-events?limit=20", player.cookie);
    await expectOk("Player trainings", "/api/v1/player/trainings?limit=20", player.cookie);
    await expectOk("Player matches", "/api/v1/player/matches?limit=20", player.cookie);
    await expectOk("Player attendance", "/api/v1/player/attendance?limit=20", player.cookie, (data) => {
      assert(rowsOf(data).length >= 3, "Player attendance fixture is missing");
    });
    await expectOk("Player evaluations", "/api/v1/player/evaluations?limit=20", player.cookie, (data) => {
      assert(rowsOf(data).length >= 3, "Player evaluation fixture is missing");
    });
    await expectOk("Player progress", "/api/v1/player/progress", player.cookie, (data) => {
      assert(Number.isFinite(Number(data?.attendancePercentage)), "Player progress has no attendance percentage");
    });

    const children = await expectOk("Parent children", "/api/v1/parent/children", parent.cookie, (data) => {
      assert(Array.isArray(data) && data.length >= 2, "Parent should have at least two linked players");
      assert(data.some((child) => child.isPrimary || child.is_primary), "Parent has no primary child");
    });
    const childIds = children.map((child) => child.id);
    assert(childIds.includes(fixture.player.id) && childIds.includes(fixture.playerTwo.id), "Parent child links do not match fixtures");

    await expectOk(
      "Parent dashboard",
      `/api/v1/parent/dashboard?childId=${fixture.player.id}`,
      parent.cookie,
      (data) => {
        assert(data?.selectedChild?.id === fixture.player.id, "Parent dashboard selected the wrong child");
        assert((data?.attendance?.data || []).length >= 3, "Parent dashboard attendance is empty");
      },
    );
    await expectOk("Parent child calendar", `/api/v1/parent/children/${fixture.player.id}/calendar-events?limit=20`, parent.cookie);
    await expectOk("Parent child matches", `/api/v1/parent/children/${fixture.player.id}/matches?limit=20`, parent.cookie);
    await expectOk("Parent child trainings", `/api/v1/parent/children/${fixture.player.id}/trainings?limit=20`, parent.cookie);
    await expectOk("Parent child attendance", `/api/v1/parent/children/${fixture.player.id}/attendance?limit=20`, parent.cookie);
    await expectOk("Parent child evaluations", `/api/v1/parent/children/${fixture.player.id}/evaluations?limit=20`, parent.cookie);
    await expectOk("Parent child measurements", `/api/v1/parent/children/${fixture.player.id}/measurements?limit=20`, parent.cookie, (data) => {
      assert(rowsOf(data).length >= 3, "Parent measurements are missing");
    });
    await expectOk("Parent child progress", `/api/v1/parent/children/${fixture.player.id}/progress`, parent.cookie);
    await expectOk("Parent weekly report", `/api/v1/parent/children/${fixture.player.id}/weekly-report`, parent.cookie);

    const createdNote = await postOk(
      "Parent creates coach note",
      `/api/v1/parent/children/${fixture.player.id}/notes`,
      parent.cookie,
      {
        coachUserId: fixture.coach.user_id,
        category: "wellness",
        title: NOTE_TITLE,
        body: "The player completed recovery and has no pain today.",
        visibility: "parent_and_coach",
      },
      (data) => assert(data?.id, "Created parent note has no id"),
    );
    await expectOk("Coach receives parent note", `/api/v1/coach/parent-notes?playerId=${fixture.player.id}&limit=50`, coach.cookie, (data) => {
      assert(rowsOf(data).some((note) => note.id === createdNote.id), "Coach cannot see new parent note");
    });
    await patchOk(
      "Coach responds to parent note",
      `/api/v1/coach/parent-notes/${createdNote.id}/respond`,
      coach.cookie,
      {
        status: "resolved",
        visibility: "family",
        coachResponse: "Recovery looks good. The player can follow the normal training plan.",
      },
    );
    await expectOk("Player receives family note", "/api/v1/player/parent-notes?limit=50", player.cookie, (data) => {
      assert(rowsOf(data).some((note) => note.id === createdNote.id), "Player cannot see family-visible note");
    });

    const contacts = await expectOk("Parent chat contacts", "/api/v1/chat/contacts", parent.cookie, (data) => {
      assert((data?.coaches || []).some((item) => item.id === fixture.coach.id), "Parent cannot see assigned coach in chat");
    });
    const coachContact = (contacts.coaches || []).find(
      (item) => item.id === fixture.coach.id && item.player_id === fixture.player.id,
    ) || (contacts.coaches || []).find((item) => item.id === fixture.coach.id);
    assert(coachContact, "Matching parent-coach contact is missing");
    const conversation = await postOk(
      "Parent opens coach chat",
      "/api/v1/chat/conversations",
      parent.cookie,
      {
        type: "parent_coach",
        coachId: fixture.coach.id,
        playerId: fixture.player.id,
      },
      (data) => assert(data?.id, "Conversation has no id"),
    );
    const messageResult = await postOk(
      "Parent sends coach message",
      `/api/v1/chat/conversations/${conversation.id}/messages`,
      parent.cookie,
      { body: CHAT_BODY },
      (data) => assert(data?.message?.id || data?.id, "Message has no id"),
    );
    const message = messageResult.message || messageResult;
    await expectOk(
      "Coach receives parent chat",
      `/api/v1/chat/conversations/${conversation.id}/messages?limit=50`,
      coach.cookie,
      (data) => {
        const rows = rowsOf(data);
        assert(rows.some((row) => row.id === message.id), "Coach cannot see parent message");
      },
    );

    await expectDenied("Admin blocked from parent API", "/api/v1/parent/children", admin.cookie);
    await expectDenied("Coach blocked from admin dashboard", "/api/v1/admin/dashboard", coach.cookie);
    await expectDenied("Player blocked from parent API", "/api/v1/parent/children", player.cookie);
    await expectDenied("Parent blocked from coach API", "/api/v1/coach/groups", parent.cookie);
    await expectDenied(
      "Parent blocked from unrelated child",
      "/api/v1/parent/children/00000000-0000-4000-8000-000000000001/progress",
      parent.cookie,
    );

    for (const [name, session] of Object.entries({ Admin: admin, Coach: coach, Player: player, Parent: parent })) {
      const { response } = await request("/api/v1/auth/logout", {
        method: "POST",
        cookie: session.cookie,
        body: JSON.stringify({}),
      });
      assert(response.status === 200, `${name} logout returned ${response.status}`);
      record(`${name} logout`, true);
    }
  } finally {
    await cleanup(db);
    await db.end();
  }

  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  record("E2E role suite", false, error.message);
  console.error(error);
  process.exit(1);
});
