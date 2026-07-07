/**
 * Seed: Full dashboard data for GOALIX Academy
 * Run: npx knex seed:run --specific=01_dashboard_data.js
 */
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

// ── helpers ──────────────────────────────────────────────────────────────────
const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
};
const monthsAgo = (n) => {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d.toISOString().slice(0, 10);
};
const weeksAgo = (n) => daysAgo(n * 7);
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD;

if (!DEMO_USER_PASSWORD) {
    throw new Error('DEMO_USER_PASSWORD is required before running 01_dashboard_data.js');
}

// ── fixed IDs ─────────────────────────────────────────────────────────────────
const IDs = {
    admin: 'c71a308e-4883-46a0-871c-bbd390ff0141', // existing admin user
    coach1: '9b967af7-1680-4abf-b6eb-3486dc4a2f2e', // existing coach1 user

    academy: randomUUID(),
    b1: randomUUID(), b2: randomUUID(), b3: randomUUID(),   // branches
    by1: randomUUID(), by2: randomUUID(), by3: randomUUID(), // birth years b1
    by4: randomUUID(), by5: randomUUID(), by6: randomUUID(), // birth years b2
    by7: randomUUID(), by8: randomUUID(),                   // birth years b3

    g1: randomUUID(), g2: randomUUID(), g3: randomUUID(),
    g4: randomUUID(), g5: randomUUID(), g6: randomUUID(),

    coachProfile1: randomUUID(), coachProfile2: randomUUID(),
    coachProfile3: randomUUID(), coachProfile4: randomUUID(),
    coachUser2: randomUUID(), coachUser3: randomUUID(), coachUser4: randomUUID(),
};

// Generate player IDs
const PLAYER_COUNT = 24;
const playerUserIds = Array.from({ length: PLAYER_COUNT }, () => randomUUID());
const playerIds = Array.from({ length: PLAYER_COUNT }, () => randomUUID());

exports.seed = async function (knex) {
    // ── 1. CLEAR in dependency order (no CASCADE to avoid touching auth_users) ─
    await knex('notification_inbox').delete();
    await knex('notification_device_tokens').delete();
    await knex('ranking_snapshots').delete();
    await knex('attendance_marks').delete();
    await knex('attendance_sessions').delete();
    await knex('payment_invoices').delete();
    await knex('payment_subscriptions').delete();
    await knex('player_group_assignments').delete();
    await knex('coach_group_assignments').delete();
    await knex('player_measurements').delete();
    await knex('player_injury_history').delete();
    await knex('evaluation_coach_ratings').delete();
    await knex('evaluation_discipline_scores').delete();
    await knex('match_player_stats').delete();
    await knex('match_records').delete();
    await knex('coach_performance_scores').delete();
    await knex('player_profiles').delete();
    await knex('coach_profiles').delete();
    await knex('group_birth_years').delete();
    await knex('group_labels').delete();
    await knex('academy_schedules').delete();
    await knex('academy_groups').delete();
    await knex('academy_birth_years').delete();
    await knex('academy_branches').delete();
    // Remove all users, then re-insert admin + coach1 fresh
    await knex('auth_users').delete();
    await knex('academy_academies').delete();

    const pw = await bcrypt.hash(DEMO_USER_PASSWORD, 10);

    // ── 1b. RE-CREATE ADMIN & COACH1 USERS ──────────────────────────────────
    await knex('auth_users').insert([
        {
            id: IDs.admin,
            email: 'admin@goalix.com',
            password_hash: pw,
            role: 'admin',
            is_active: true,
            is_verified: true,
        },
        {
            id: IDs.coach1,
            email: 'coach1@goalix.com',
            password_hash: pw,
            role: 'coach',
            is_active: true,
            is_verified: true,
        },
    ]);

    // ── 2. ACADEMY ───────────────────────────────────────────────────────────
    await knex('academy_academies').insert({
        id: IDs.academy,
        name: 'GOALIX Football Academy',
        owner_user_id: IDs.admin,
        settings: JSON.stringify({ currency: 'EGP', timezone: 'Africa/Cairo' }),
    });

    // ── 3. LINK ADMIN → ACADEMY ──────────────────────────────────────────────
    await knex('auth_users')
        .where('id', IDs.admin)
        .update({ academy_id: IDs.academy });
    await knex('auth_users')
        .where('id', IDs.coach1)
        .update({ academy_id: IDs.academy });

    // ── 4. BRANCHES ──────────────────────────────────────────────────────────
    await knex('academy_branches').insert([
        { id: IDs.b1, academy_id: IDs.academy, name: 'Heliopolis Branch', address: 'Heliopolis, Cairo' },
        { id: IDs.b2, academy_id: IDs.academy, name: 'Maadi Branch', address: 'Maadi, Cairo' },
        { id: IDs.b3, academy_id: IDs.academy, name: 'October Branch', address: '6th October City' },
    ]);

    // ── 5. BIRTH YEARS ───────────────────────────────────────────────────────
    await knex('academy_birth_years').insert([
        { id: IDs.by1, branch_id: IDs.b1, from_year: 2012, to_year: 2012, label: 'Heliopolis 2012', normalized_label: 'heliopolis 2012' },
        { id: IDs.by2, branch_id: IDs.b1, from_year: 2013, to_year: 2013, label: 'Heliopolis 2013', normalized_label: 'heliopolis 2013' },
        { id: IDs.by3, branch_id: IDs.b1, from_year: 2014, to_year: 2014, label: 'Heliopolis 2014', normalized_label: 'heliopolis 2014' },
        { id: IDs.by4, branch_id: IDs.b2, from_year: 2012, to_year: 2012, label: 'Maadi 2012', normalized_label: 'maadi 2012' },
        { id: IDs.by5, branch_id: IDs.b2, from_year: 2013, to_year: 2013, label: 'Maadi 2013', normalized_label: 'maadi 2013' },
        { id: IDs.by6, branch_id: IDs.b2, from_year: 2014, to_year: 2014, label: 'Maadi 2014', normalized_label: 'maadi 2014' },
        { id: IDs.by7, branch_id: IDs.b3, from_year: 2012, to_year: 2012, label: 'October 2012', normalized_label: 'october 2012' },
        { id: IDs.by8, branch_id: IDs.b3, from_year: 2013, to_year: 2013, label: 'October 2013', normalized_label: 'october 2013' },
    ]);

    // ── 6. GROUPS ────────────────────────────────────────────────────────────
    await knex('academy_groups').insert([
        { id: IDs.g1, branch_id: IDs.b1, name: 'Heliopolis 2012 - A', max_players: 18 },
        { id: IDs.g2, branch_id: IDs.b1, name: 'Heliopolis 2013 - A', max_players: 18 },
        { id: IDs.g3, branch_id: IDs.b2, name: 'Maadi 2012 - A', max_players: 18 },
        { id: IDs.g4, branch_id: IDs.b2, name: 'Maadi 2013 - A', max_players: 18 },
        { id: IDs.g5, branch_id: IDs.b3, name: 'October 2012 - A', max_players: 18 },
        { id: IDs.g6, branch_id: IDs.b3, name: 'October 2013 - A', max_players: 18 },
    ]);

    // ── 6b. GROUP LABELS ──────────────────────────────────────────────────────
    await knex('group_labels').insert([
        { group_id: IDs.g1, normalized_label: 'heliopolis 2012' },
        { group_id: IDs.g2, normalized_label: 'heliopolis 2013' },
        { group_id: IDs.g3, normalized_label: 'maadi 2012' },
        { group_id: IDs.g4, normalized_label: 'maadi 2013' },
        { group_id: IDs.g5, normalized_label: 'october 2012' },
        { group_id: IDs.g6, normalized_label: 'october 2013' },
    ]);

    // ── 6c. GROUP BIRTH YEARS ─────────────────────────────────────────────────
    await knex('group_birth_years').insert([
        { group_id: IDs.g1, birth_year_id: IDs.by1 },
        { group_id: IDs.g2, birth_year_id: IDs.by2 },
        { group_id: IDs.g3, birth_year_id: IDs.by4 },
        { group_id: IDs.g4, birth_year_id: IDs.by5 },
        { group_id: IDs.g5, birth_year_id: IDs.by7 },
        { group_id: IDs.g6, birth_year_id: IDs.by8 },
    ]);

    // ── 7. COACH AUTH USERS ──────────────────────────────────────────────────
    await knex('auth_users').insert([
        { id: IDs.coachUser2, email: 'coach2@goalix.com', password_hash: pw, role: 'coach', academy_id: IDs.academy, is_verified: true },
        { id: IDs.coachUser3, email: 'coach3@goalix.com', password_hash: pw, role: 'coach', academy_id: IDs.academy, is_verified: true },
        { id: IDs.coachUser4, email: 'coach4@goalix.com', password_hash: pw, role: 'coach', academy_id: IDs.academy, is_verified: true },
    ]);

    // ── 8. COACH PROFILES ────────────────────────────────────────────────────
    await knex('coach_profiles').insert([
        {
            id: IDs.coachProfile1,
            user_id: IDs.coach1,
            academy_id: IDs.academy,
            branch_id: IDs.b1,
            full_name: 'Omar Mostafa',
            first_name: 'Omar',
            last_name: 'Mostafa',
            email: 'coach1@goalix.com',
            phone: '+201010000001',
            role: 'head_coach',
            specialization: 'Technical Skills',
        },
        {
            id: IDs.coachProfile2,
            user_id: IDs.coachUser2,
            academy_id: IDs.academy,
            branch_id: IDs.b2,
            full_name: 'Kareem El-Sayed',
            first_name: 'Kareem',
            last_name: 'El-Sayed',
            email: 'coach2@goalix.com',
            phone: '+201010000002',
            role: 'head_coach',
            specialization: 'Tactical Training',
        },
        {
            id: IDs.coachProfile3,
            user_id: IDs.coachUser3,
            academy_id: IDs.academy,
            branch_id: IDs.b2,
            full_name: 'Tamer Adel',
            first_name: 'Tamer',
            last_name: 'Adel',
            email: 'coach3@goalix.com',
            phone: '+201010000003',
            role: 'head_coach',
            specialization: 'Physical Conditioning',
        },
        {
            id: IDs.coachProfile4,
            user_id: IDs.coachUser4,
            academy_id: IDs.academy,
            branch_id: IDs.b3,
            full_name: 'Mohamed Nabil',
            first_name: 'Mohamed',
            last_name: 'Nabil',
            email: 'coach4@goalix.com',
            phone: '+201010000004',
            role: 'head_coach',
            specialization: 'Goalkeeping',
        },
    ]);

    // ── 9. COACH GROUP ASSIGNMENTS ───────────────────────────────────────────
    await knex('coach_group_assignments').insert([
        { coach_id: IDs.coachProfile1, group_id: IDs.g1, role: 'head' },
        { coach_id: IDs.coachProfile1, group_id: IDs.g2, role: 'head' },
        { coach_id: IDs.coachProfile2, group_id: IDs.g3, role: 'head' },
        { coach_id: IDs.coachProfile3, group_id: IDs.g4, role: 'head' },
        { coach_id: IDs.coachProfile3, group_id: IDs.g5, role: 'head' },
        { coach_id: IDs.coachProfile4, group_id: IDs.g6, role: 'head' },
    ]);

    // ── 10. PLAYER USERS ─────────────────────────────────────────────────────
    const playerNames = [
        'Ahmed Youssef', 'Mohamed Tarek', 'Omar Khaled', 'Ziad Hassan',
        'Karim Amir', 'Seif Nasser', 'Nour El-Din', 'Youssef Samir',
        'Tamer Fouad', 'Ali Mostafa', 'Hazem Essam', 'Rami Ashraf',
        'Khaled Walid', 'Adel Ibrahim', 'Samy Gamal', 'Hossam Farouk',
        'Badr Magdy', 'Sherif Adel', 'Wael Nabil', 'Islam Reda',
        'Mostafa Hany', 'Amr Hesham', 'Fares Osama', 'Nader Saad',
    ];

    const groups = [IDs.g1, IDs.g2, IDs.g3, IDs.g4, IDs.g5, IDs.g6];
    const positions = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper', 'Winger'];
    const feet = ['right', 'left', 'both'];
    const levels = ['A', 'B', 'C', 'D', 'F'];

    const playerUserRows = playerUserIds.map((uid, i) => ({
        id: uid,
        email: `player${i + 1}@goalix.com`,
        password_hash: pw,
        role: 'player',
        academy_id: IDs.academy,
        is_verified: true,
    }));
    await knex('auth_users').insert(playerUserRows);

    // ── 11. PLAYER PROFILES ──────────────────────────────────────────────────
    const birthYears = [2012, 2012, 2013, 2013, 2014, 2014];
    const playerProfileRows = playerIds.map((pid, i) => ({
        id: pid,
        user_id: playerUserIds[i],
        academy_id: IDs.academy,
        full_name: playerNames[i],
        date_of_birth: `${birthYears[i % 6]}-${String((i % 12) + 1).padStart(2, '0')}-15`,
        level: levels[i % levels.length],
        position: positions[i % 5],
        preferred_foot: feet[i % 3],
        guardian_name: `Guardian of ${playerNames[i].split(' ')[0]}`,
        guardian_phone: `+20100${String(i).padStart(7, '0')}`,
    }));
    await knex('player_profiles').insert(playerProfileRows);

    // ── 12. PLAYER GROUP ASSIGNMENTS ─────────────────────────────────────────
    const groupAssignments = playerIds.map((pid, i) => ({
        player_id: pid,
        group_id: groups[i % 6],
        joined_at: new Date(daysAgo(90)).toISOString(),
    }));
    await knex('player_group_assignments').insert(groupAssignments);

    // ── 13. PAYMENT SUBSCRIPTIONS ────────────────────────────────────────────
    // status enum: active | expired | cancelled | pending
    const subStatuses = Array.from({ length: PLAYER_COUNT }, (_, i) => {
        if (i < 18) return 'active';
        if (i < 21) return 'pending';
        return 'expired';
    });

    const subIds = playerIds.map(() => randomUUID());
    const subRows = playerIds.map((pid, i) => ({
        id: subIds[i],
        player_id: pid,
        amount: 1200,
        currency: 'EGP',
        starts_at: monthsAgo(3),
        ends_at: monthsAgo(-3),
        status: subStatuses[i],
    }));
    await knex('payment_subscriptions').insert(subRows);

    // ── 14. PAYMENT INVOICES ─────────────────────────────────────────────────
    // invoice status: pending | paid | overdue | cancelled
    // Create invoices for the last 6 months for active subscriptions
    const invoiceRows = [];
    for (let m = 0; m < 6; m++) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - m);
        monthStart.setDate(1);
        const dueDate = monthStart.toISOString().slice(0, 10);
        const paidAt = new Date(monthStart);
        paidAt.setDate(10);

        // active players get paid invoices for past months; current month mixed
        subIds.slice(0, 18).forEach((sid, i) => {
            let status, paid_at;
            if (m > 0) {
                // past months: most paid, a few overdue
                if (i < 15) { status = 'paid'; paid_at = paidAt.toISOString(); }
                else { status = 'overdue'; paid_at = null; }
            } else {
                // current month: 12 paid, 4 pending, 2 overdue
                if (i < 12) { status = 'paid'; paid_at = new Date().toISOString(); }
                else if (i < 16) { status = 'pending'; paid_at = null; }
                else { status = 'overdue'; paid_at = null; }
            }
            invoiceRows.push({
                id: randomUUID(),
                subscription_id: sid,
                amount: 1200,
                due_date: dueDate,
                status,
                paid_at,
            });
        });
    }
    await knex('payment_invoices').insert(invoiceRows);

    // ── 15. ATTENDANCE SESSIONS (last 8 weeks × 3 days/week × 6 groups) ──────
    const sessionRows = [];
    const sessionMap = {}; // "groupId|date" -> sessionId

    // coach_profiles.id for sessions, auth_users.id for marked_by
    const coachProfileForGroup = {
        [IDs.g1]: IDs.coachProfile1, [IDs.g2]: IDs.coachProfile1,
        [IDs.g3]: IDs.coachProfile2, [IDs.g4]: IDs.coachProfile3,
        [IDs.g5]: IDs.coachProfile3, [IDs.g6]: IDs.coachProfile4,
    };
    const coachUserForGroup = {
        [IDs.g1]: IDs.coach1, [IDs.g2]: IDs.coach1,
        [IDs.g3]: IDs.coachUser2, [IDs.g4]: IDs.coachUser3,
        [IDs.g5]: IDs.coachUser3, [IDs.g6]: IDs.coachUser4,
    };

    for (let week = 0; week < 8; week++) {
        for (const dayOffset of [0, 2, 4]) { // Mon, Wed, Fri pattern
            const d = new Date();
            d.setDate(d.getDate() - (week * 7) - dayOffset);
            const dateStr = d.toISOString().slice(0, 10);

            for (const gid of groups) {
                const key = `${gid}|${dateStr}`;
                if (!sessionMap[key]) {
                    const sid = randomUUID();
                    sessionMap[key] = sid;
                    sessionRows.push({
                        id: sid,
                        group_id: gid,
                        coach_id: coachProfileForGroup[gid],
                        session_date: dateStr,
                        status: 'completed',
                    });
                }
            }
        }
    }
    await knex('attendance_sessions').insert(sessionRows);

    // ── 16. ATTENDANCE MARKS ─────────────────────────────────────────────────
    const markRows = [];
    const attendanceProb = [0.95, 0.90, 0.88, 0.85, 0.80, 0.75,
        0.93, 0.87, 0.92, 0.78, 0.83, 0.96,
        0.89, 0.84, 0.91, 0.77, 0.86, 0.82,
        0.70, 0.65, 0.88, 0.79, 0.94, 0.81];

    for (const [key, sessionId] of Object.entries(sessionMap)) {
        const groupId = key.split('|')[0];
        const groupIndex = groups.indexOf(groupId);

        for (let pi = 0; pi < PLAYER_COUNT; pi++) {
            if (pi % 6 !== groupIndex) continue; // each player belongs to one group
            const prob = attendanceProb[pi];
            const rand = Math.random();
            let status;
            if (rand < prob) status = 'present';
            else if (rand < prob + 0.05) status = 'late';
            else if (rand < prob + 0.08) status = 'excused';
            else status = 'absent';

            markRows.push({
                session_id: sessionId,
                player_id: playerIds[pi],
                status,
                marked_by: coachUserForGroup[groupId],
            });
        }
    }
    await knex('attendance_marks').insert(markRows);

    // ── 17. RANKING SNAPSHOTS ─────────────────────────────────────────────────
    const periods = ['2026-W14', '2026-W15', '2026-W16'];
    const rankRows = [];
    for (const period of periods) {
        const scores = playerIds.map((pid, i) => ({
            pid,
            score: 60 + Math.round(Math.random() * 35) + (i % 3 === 0 ? 5 : 0),
        })).sort((a, b) => b.score - a.score);

        scores.forEach((s, rank) => {
            rankRows.push({
                id: randomUUID(),
                player_id: s.pid,
                group_id: groups[playerIds.indexOf(s.pid) % 6],
                total_score: s.score,
                rank: rank + 1,
                period,
                trend: rank < 5 ? 'up' : 'same',
            });
        });
    }
    await knex('ranking_snapshots').insert(rankRows);

    // ── 18. NOTIFICATION INBOX (for admin) ───────────────────────────────────
    await knex('notification_inbox').insert([
        {
            id: randomUUID(), user_id: IDs.admin,
            type: 'warning', title: 'Payment Overdue',
            body: `${playerNames[15]}'s subscription payment is overdue by 12 days.`,
            is_read: false,
        },
        {
            id: randomUUID(), user_id: IDs.admin,
            type: 'info', title: 'New Player Registered',
            body: `${playerNames[23]} has been registered at Heliopolis Branch.`,
            is_read: false,
        },
        {
            id: randomUUID(), user_id: IDs.admin,
            type: 'alert', title: 'Attendance Alert',
            body: `${playerNames[19]} has missed 3 consecutive sessions.`,
            is_read: true,
        },
        {
            id: randomUUID(), user_id: IDs.admin,
            type: 'success', title: 'Evaluations Submitted',
            body: 'Coach Omar Mostafa submitted evaluations for 15 players.',
            is_read: true,
        },
        {
            id: randomUUID(), user_id: IDs.admin,
            type: 'alert', title: 'Injury Report',
            body: `${playerNames[9]} reported an ankle sprain. Expected recovery: 2 weeks.`,
            is_read: false,
        },
    ]);

    console.log('✅ Seed complete:');
    console.log(`   Academy: GOALIX Football Academy (${IDs.academy})`);
    console.log(`   Branches: 3 | Birth Years: 8 | Groups: 6`);
    console.log(`   Coaches: 4 | Players: ${PLAYER_COUNT}`);
    console.log(`   Attendance sessions: ${sessionRows.length} | Marks: ${markRows.length}`);
    console.log(`   Subscriptions: ${subRows.length} | Invoices: ${invoiceRows.length}`);
    console.log(`   Ranking snapshots: ${rankRows.length}`);
};
