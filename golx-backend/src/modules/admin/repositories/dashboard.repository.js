const BaseRepository = require('../../../shared/base.repository');

class AdminDashboardRepository extends BaseRepository {
    constructor(db) {
        super('auth_users', db);
    }

    async getKPIs(academyId) {
        const byAcademy = (q, table, col = 'academy_id') =>
            academyId ? q.where(`${table}.${col}`, academyId) : q;

        const [
            playerCount,
            coachCount,
            activeSubsCount,
            overdueCount,
            monthlyRevenue,
            attendanceStats,
        ] = await Promise.all([
            // Total active players
            byAcademy(this.db('player_profiles'), 'player_profiles')
                .whereNull('deleted_at')
                .count('id as count')
                .first(),

            // Total active coaches
            byAcademy(this.db('coach_profiles'), 'coach_profiles')
                .whereNull('deleted_at')
                .count('id as count')
                .first(),

            // Active subscriptions
            (() => {
                const q = this.db('payment_subscriptions as ps')
                    .join('player_profiles as pp', 'ps.player_id', 'pp.id')
                    .where('ps.status', 'active');
                return (academyId ? q.where('pp.academy_id', academyId) : q)
                    .count('ps.id as count').first();
            })(),

            // Overdue invoices (payment_invoices.status = 'overdue')
            (() => {
                const q = this.db('payment_invoices as pi')
                    .join('payment_subscriptions as ps', 'pi.subscription_id', 'ps.id')
                    .join('player_profiles as pp', 'ps.player_id', 'pp.id')
                    .where('pi.status', 'overdue');
                return (academyId ? q.where('pp.academy_id', academyId) : q)
                    .count('pi.id as count').first();
            })(),

            // Monthly revenue (current month paid invoices)
            (() => {
                const q = this.db('payment_invoices as pi')
                    .join('payment_subscriptions as ps', 'pi.subscription_id', 'ps.id')
                    .join('player_profiles as pp', 'ps.player_id', 'pp.id')
                    .where('pi.status', 'paid')
                    .whereRaw("pi.paid_at >= date_trunc('month', now())")
                    .whereRaw("pi.paid_at < date_trunc('month', now()) + interval '1 month'");
                return (academyId ? q.where('pp.academy_id', academyId) : q)
                    .sum('pi.amount as total').first();
            })(),

            // Attendance rate — last 30 days
            (() => {
                const q = this.db('event_attendance as ea')
                    .join('calendar_events as ce', 'ea.event_id', 'ce.id')
                    .where('ce.event_type', 'training')
                    .whereNull('ce.deleted_at')
                    .whereRaw("ce.start_datetime >= now() - interval '30 days'")
                    .select(
                        this.db.raw('COUNT(*) as total'),
                        this.db.raw("COUNT(*) FILTER (WHERE ea.status IN ('present','late')) as attended"),
                    );
                return (academyId ? q.where('ce.academy_id', academyId) : q).first();
            })(),
        ]);

        const total = Number(attendanceStats?.total || 0);
        const attended = Number(attendanceStats?.attended || 0);
        const avgAttendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;

        return {
            totalPlayers: Number(playerCount?.count || 0),
            totalCoaches: Number(coachCount?.count || 0),
            activeSubscriptions: Number(activeSubsCount?.count || 0),
            overduePayments: Number(overdueCount?.count || 0),
            monthlyRevenue: Number(monthlyRevenue?.total || 0),
            avgAttendanceRate,
        };
    }

    // ─── Attendance Trend (last 8 weeks) ─────────────────────────────────
    async getAttendanceTrend(academyId) {
        const rows = await this.db.raw(`
            WITH weeks AS (
                SELECT generate_series(0, 7) AS w
            ),
            week_ranges AS (
                SELECT
                    w,
                    date_trunc('week', now()) - (w * interval '1 week') AS week_start,
                    date_trunc('week', now()) - (w * interval '1 week') + interval '6 days' AS week_end
                FROM weeks
            ),
            attendance_data AS (
                SELECT
                    wr.w,
                    wr.week_start,
                    COUNT(ea.id) AS total,
                    COUNT(ea.id) FILTER (WHERE ea.status IN ('present','late')) AS attended
                FROM week_ranges wr
                LEFT JOIN calendar_events ce
                    ON ce.start_datetime >= wr.week_start
                   AND ce.start_datetime < (wr.week_end + interval '1 day')
                   AND ce.event_type = 'training'
                   AND ce.deleted_at IS NULL
                   AND (:academyId::uuid IS NULL OR ce.academy_id = :academyId)
                LEFT JOIN event_attendance ea ON ea.event_id = ce.id
                GROUP BY wr.w, wr.week_start
            )
            SELECT
                w,
                to_char(week_start, 'Mon DD') AS label,
                CASE WHEN total > 0 THEN ROUND((attended::numeric / total) * 100) ELSE 0 END AS value
            FROM attendance_data
            ORDER BY w DESC
        `, { academyId });

        return rows.rows.map((r) => ({
            label: r.label,
            value: Number(r.value),
        }));
    }

    // ─── Revenue Trend (last 6 months) ───────────────────────────────────
    async getRevenueTrend(academyId) {
        const rows = await this.db.raw(`
            WITH months AS (
                SELECT generate_series(0, 5) AS m
            ),
            month_ranges AS (
                SELECT
                    m,
                    date_trunc('month', now()) - (m * interval '1 month') AS month_start
                FROM months
            )
            SELECT
                mr.m,
                to_char(mr.month_start, 'Mon YYYY') AS label,
                COALESCE(SUM(
                    CASE
                        WHEN :academyId::uuid IS NULL OR pp.academy_id = :academyId
                        THEN pi.amount
                        ELSE 0
                    END
                ), 0) AS value
            FROM month_ranges mr
            LEFT JOIN payment_invoices pi
                ON pi.paid_at >= mr.month_start
                AND pi.paid_at < (mr.month_start + interval '1 month')
                AND pi.status = 'paid'
            LEFT JOIN payment_subscriptions ps ON pi.subscription_id = ps.id
            LEFT JOIN player_profiles pp ON ps.player_id = pp.id
            GROUP BY mr.m, mr.month_start
            ORDER BY mr.m DESC
        `, { academyId });

        return rows.rows.map((r) => ({
            label: r.label,
            value: Number(r.value),
        }));
    }

    // ─── Top Players (last ranking snapshot) ────────────────────────────
    async getTopPlayers(academyId, limit = 5) {
        const rows = await this.db.raw(`
            WITH scoped_rankings AS (
                SELECT
                    pp.id,
                    pp.full_name,
                    rs.total_score,
                    rs.rank,
                    rs.period,
                    rs.calculated_at
                FROM ranking_snapshots rs
                JOIN player_profiles pp ON rs.player_id = pp.id
                WHERE pp.deleted_at IS NULL
                  AND (:academyId::uuid IS NULL OR pp.academy_id = :academyId)
            ),
            latest_period AS (
                SELECT period
                FROM scoped_rankings
                ORDER BY calculated_at DESC NULLS LAST, period DESC
                LIMIT 1
            ),
            latest_rankings AS (
                SELECT
                    sr.*,
                    COALESCE(
                        sr.rank::int,
                        ROW_NUMBER() OVER (
                            ORDER BY sr.total_score DESC NULLS LAST, sr.full_name ASC
                        )::int
                    ) AS display_rank
                FROM scoped_rankings sr
                JOIN latest_period lp ON lp.period = sr.period
            )
            SELECT
                id,
                full_name AS "fullName",
                total_score AS "totalScore",
                display_rank AS rank,
                period
            FROM latest_rankings
            ORDER BY display_rank ASC, total_score DESC NULLS LAST
            LIMIT :limit
        `, { academyId, limit });

        return rows.rows.map((row) => ({
            ...row,
            totalScore: Number(row.totalScore || 0),
            rank: Number(row.rank || 0),
        }));
    }

    async getReportsOverview(academyId, { branchId, dateFrom, dateTo }) {
        const scopeBranch = (query, column) => {
            if (branchId) query.where(column, branchId);
            return query;
        };

        const attendanceScope = () => {
            const query = this.db('event_attendance as ea')
                .join('calendar_events as ce', 'ea.event_id', 'ce.id')
                .join('player_profiles as attendance_player', 'attendance_player.id', 'ea.player_id')
                .where('ce.academy_id', academyId)
                .where('ce.event_type', 'training')
                .whereNull('ce.deleted_at')
                .whereNull('attendance_player.deleted_at')
                .whereRaw("ce.start_datetime >= ?::date AND ce.start_datetime < (?::date + interval '1 day')", [
                    dateFrom,
                    dateTo,
                ]);
            if (branchId) query.where('attendance_player.branch_id', branchId);
            return query;
        };

        const trainingScope = () => {
            const query = this.db('calendar_events as ce')
                .where('ce.academy_id', academyId)
                .where('ce.event_type', 'training')
                .whereNull('ce.deleted_at')
                .whereRaw("ce.start_datetime >= ?::date AND ce.start_datetime < (?::date + interval '1 day')", [
                    dateFrom,
                    dateTo,
                ]);

            if (branchId) {
                query.where((branchScope) => {
                    branchScope
                        .whereExists(
                            this.db('calendar_event_groups as target_group')
                                .join('academy_groups as target_ag', 'target_ag.id', 'target_group.group_id')
                                .whereRaw('target_group.event_id = ce.id')
                                .where('target_ag.branch_id', branchId)
                                .select(this.db.raw('1')),
                        )
                        .orWhereExists(
                            this.db('calendar_event_players as target_player')
                                .join('player_profiles as target_pp', 'target_pp.id', 'target_player.player_id')
                                .whereRaw('target_player.event_id = ce.id')
                                .where('target_pp.branch_id', branchId)
                                .select(this.db.raw('1')),
                        )
                        .orWhereExists(
                            this.db('calendar_event_birth_years as target_birth_year')
                                .join(
                                    'academy_birth_years as target_aby',
                                    'target_aby.id',
                                    'target_birth_year.birth_year_id',
                                )
                                .whereRaw('target_birth_year.event_id = ce.id')
                                .where('target_aby.branch_id', branchId)
                                .select(this.db.raw('1')),
                        );
                });
            }

            return query;
        };

        const [
            playerSummary,
            coachSummary,
            sessionSummary,
            attendanceSummary,
            levelDistribution,
            attendanceTrend,
            groupPerformance,
            coachPerformance,
            playerProgress,
        ] = await Promise.all([
            scopeBranch(
                this.db('player_profiles as pp')
                    .where('pp.academy_id', academyId)
                    .whereNull('pp.deleted_at')
                    .select(
                        this.db.raw('COUNT(*)::int as total'),
                        this.db.raw('COUNT(*) FILTER (WHERE pp.is_active IS TRUE)::int as active'),
                        this.db.raw(
                            "COUNT(*) FILTER (WHERE pp.created_at >= ?::date AND pp.created_at < (?::date + interval '1 day'))::int as \"newPlayers\"",
                            [dateFrom, dateTo],
                        ),
                    ),
                'pp.branch_id',
            ).first(),
            scopeBranch(
                this.db('coach_profiles as cp')
                    .where('cp.academy_id', academyId)
                    .whereNull('cp.deleted_at')
                    .count('cp.id as total'),
                'cp.branch_id',
            ).first(),
            trainingScope()
                .select(
                    this.db.raw('COUNT(DISTINCT ce.id)::int as total'),
                    this.db.raw(
                        "COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'finished')::int as completed",
                    ),
                )
                .first(),
            attendanceScope()
                .select(
                    this.db.raw('COUNT(ea.id)::int as total'),
                    this.db.raw(
                        "COUNT(ea.id) FILTER (WHERE ea.status IN ('present', 'late'))::int as attended",
                    ),
                    this.db.raw(
                        "COUNT(ea.id) FILTER (WHERE ea.status = 'present')::int as present",
                    ),
                    this.db.raw(
                        "COUNT(ea.id) FILTER (WHERE ea.status = 'late')::int as late",
                    ),
                    this.db.raw(
                        "COUNT(ea.id) FILTER (WHERE ea.status = 'absent')::int as absent",
                    ),
                    this.db.raw(
                        "COUNT(ea.id) FILTER (WHERE ea.status = 'excused')::int as excused",
                    ),
                    this.db.raw(
                        "COUNT(ea.id) FILTER (WHERE ea.status = 'injured')::int as injured",
                    ),
                )
                .first(),
            scopeBranch(
                this.db('player_profiles as pp')
                    .where('pp.academy_id', academyId)
                    .whereNull('pp.deleted_at')
                    .where('pp.is_active', true)
                    .select(this.db.raw("COALESCE(pp.level::text, 'Unrated') as level"))
                    .count('pp.id as count')
                    .groupByRaw("COALESCE(pp.level::text, 'Unrated')"),
                'pp.branch_id',
            ).orderByRaw(
                "CASE COALESCE(pp.level::text, 'Unrated') WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 WHEN 'F' THEN 5 ELSE 6 END",
            ),
            attendanceScope()
                .select(
                    this.db.raw("to_char(date_trunc('week', ce.start_datetime), 'Mon DD') as label"),
                    this.db.raw("date_trunc('week', ce.start_datetime) as week_start"),
                    this.db.raw(
                        "ROUND(100.0 * COUNT(ea.id) FILTER (WHERE ea.status IN ('present', 'late')) / NULLIF(COUNT(ea.id), 0))::int as rate",
                    ),
                )
                .groupByRaw("date_trunc('week', ce.start_datetime)")
                .orderBy('week_start', 'asc'),
            scopeBranch(
                this.db('academy_groups as ag')
                    .join('academy_branches as ab', 'ag.branch_id', 'ab.id')
                    .where('ab.academy_id', academyId)
                    .whereNull('ag.deleted_at')
                    .select(
                        'ag.id',
                        'ag.name',
                        'ab.name as branchName',
                        this.db.raw(`(
                            SELECT COUNT(DISTINCT pga.player_id)::int
                            FROM player_group_assignments pga
                            WHERE pga.group_id = ag.id
                              AND pga.left_at IS NULL
                        ) as players`),
                        this.db.raw(`(
                            SELECT COUNT(DISTINCT ce.id)::int
                            FROM calendar_events ce
                            JOIN calendar_event_groups ceg ON ceg.event_id = ce.id
                            WHERE ceg.group_id = ag.id
                              AND ce.academy_id = ?
                              AND ce.event_type = 'training'
                              AND ce.deleted_at IS NULL
                              AND ce.start_datetime >= ?::date
                              AND ce.start_datetime < (?::date + interval '1 day')
                        ) as sessions`, [academyId, dateFrom, dateTo]),
                        this.db.raw(
                            `COALESCE((
                                SELECT ROUND(
                                    100.0 * COUNT(DISTINCT ea.id) FILTER (
                                        WHERE ea.status IN ('present', 'late')
                                    ) / NULLIF(COUNT(DISTINCT ea.id), 0)
                                )::int
                                FROM event_attendance ea
                                JOIN calendar_events ce ON ce.id = ea.event_id
                                WHERE ce.academy_id = ?
                                  AND ce.event_type = 'training'
                                  AND ce.deleted_at IS NULL
                                  AND ce.start_datetime >= ?::date
                                  AND ce.start_datetime < (?::date + interval '1 day')
                                  AND EXISTS (
                                      SELECT 1
                                      FROM player_group_assignments attendance_pga
                                      WHERE attendance_pga.player_id = ea.player_id
                                        AND attendance_pga.group_id = ag.id
                                        AND attendance_pga.left_at IS NULL
                                  )
                            ), 0) as "attendanceRate"`,
                            [academyId, dateFrom, dateTo],
                        ),
                    ),
                'ab.id',
            )
                .orderBy('attendanceRate', 'desc')
                .orderBy('players', 'desc')
                .limit(8),
            scopeBranch(
                this.db('coach_profiles as cp')
                    .leftJoin('academy_branches as cb', 'cp.branch_id', 'cb.id')
                    .leftJoin('training_sessions as ts', 'ts.coach_id', 'cp.id')
                    .leftJoin('calendar_events as ce', (join) => {
                        join.on('ce.id', '=', 'ts.event_id')
                            .andOnVal('ce.event_type', '=', 'training')
                            .andOnNull('ce.deleted_at')
                            .andOn(
                                this.db.raw(
                                    "ce.start_datetime >= ?::date AND ce.start_datetime < (?::date + interval '1 day')",
                                    [dateFrom, dateTo],
                                ),
                            );
                    })
                    .leftJoin('event_attendance as ea', 'ea.event_id', 'ce.id')
                    .where('cp.academy_id', academyId)
                    .whereNull('cp.deleted_at')
                    .select(
                        'cp.id',
                        'cp.full_name as name',
                        'cp.specialization',
                        'cp.role',
                        'cb.name as branchName',
                        this.db.raw(`(
                            SELECT COUNT(DISTINCT cga.group_id)::int
                            FROM coach_group_assignments cga
                            WHERE cga.coach_id = cp.id
                        ) as "groupCount"`),
                        this.db.raw(`(
                            SELECT COUNT(DISTINCT pga.player_id)::int
                            FROM coach_group_assignments cga
                            JOIN player_group_assignments pga
                              ON pga.group_id = cga.group_id
                             AND pga.left_at IS NULL
                            WHERE cga.coach_id = cp.id
                        ) as "playerCount"`),
                        this.db.raw('COUNT(DISTINCT ce.id)::int as sessions'),
                        this.db.raw(
                            "COALESCE(ROUND(100.0 * COUNT(DISTINCT ea.id) FILTER (WHERE ea.status IN ('present', 'late')) / NULLIF(COUNT(DISTINCT ea.id), 0)), 0)::int as \"attendanceRate\"",
                        ),
                    )
                    .groupBy(
                        'cp.id',
                        'cp.full_name',
                        'cp.specialization',
                        'cp.role',
                        'cb.name',
                    ),
                'cp.branch_id',
            )
                .orderBy('sessions', 'desc')
                .limit(8),
            this.db.raw(`
                SELECT
                    pp.id,
                    pp.full_name AS "fullName",
                    pp.player_code AS "playerCode",
                    pp.level::text AS level,
                    COALESCE(custom_position.position, pp.position) AS position,
                    pp.preferred_foot::text AS "preferredFoot",
                    pp.profile_status::text AS "profileStatus",
                    pp.is_active AS "isActive",
                    pp.date_joined::text AS "dateJoined",
                    ab.name AS "branchName",
                    current_group.group_name AS "groupName",
                    latest_measurement.measured_at::text AS "measuredAt",
                    latest_measurement.height_cm::float AS "heightCm",
                    latest_measurement.weight_kg::float AS "weightKg",
                    latest_measurement.sprint_speed::float AS "sprintSpeed",
                    latest_measurement.stamina::int AS stamina,
                    attendance.total::int AS "attendanceTotal",
                    attendance.attended::int AS "attendanceAttended",
                    CASE
                        WHEN COALESCE(attendance.total, 0) > 0
                        THEN ROUND(100.0 * attendance.attended / attendance.total)::int
                        ELSE 0
                    END AS "attendanceRate"
                FROM player_profiles pp
                LEFT JOIN academy_branches ab ON ab.id = pp.branch_id
                LEFT JOIN LATERAL (
                    SELECT ag.name AS group_name
                    FROM player_group_assignments pga
                    JOIN academy_groups ag ON ag.id = pga.group_id
                    WHERE pga.player_id = pp.id
                      AND pga.left_at IS NULL
                      AND ag.deleted_at IS NULL
                    ORDER BY pga.joined_at DESC
                    LIMIT 1
                ) current_group ON true
                LEFT JOIN LATERAL (
                    SELECT pm.*
                    FROM player_measurements pm
                    WHERE pm.player_id = pp.id
                    ORDER BY pm.measured_at DESC, pm.id DESC
                    LIMIT 1
                ) latest_measurement ON true
                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(ea.id) AS total,
                        COUNT(ea.id) FILTER (
                            WHERE ea.status IN ('present', 'late')
                        ) AS attended
                    FROM event_attendance ea
                    JOIN calendar_events ce ON ce.id = ea.event_id
                    WHERE ea.player_id = pp.id
                      AND ce.academy_id = :academyId
                      AND ce.event_type = 'training'
                      AND ce.deleted_at IS NULL
                      AND ce.start_datetime >= :dateFrom::date
                      AND ce.start_datetime < (:dateTo::date + interval '1 day')
                ) attendance ON true
                LEFT JOIN LATERAL (
                    SELECT COALESCE(
                        cfo.label,
                        cfo_text.label,
                        pcv.value_text,
                        pcv.value_long_text,
                        json_options.labels
                    ) AS position
                    FROM player_custom_values pcv
                    JOIN custom_fields cf ON cf.id = pcv.field_id
                    LEFT JOIN custom_field_options cfo
                      ON cfo.id = pcv.value_option_id
                    LEFT JOIN custom_field_options cfo_text
                      ON cfo_text.field_id = cf.id
                     AND cfo_text.id::text = pcv.value_text
                    LEFT JOIN LATERAL (
                        SELECT string_agg(
                            COALESCE(cfo_json.label, option_id),
                            ', '
                            ORDER BY option_id
                        ) AS labels
                        FROM jsonb_array_elements_text(
                            CASE
                                WHEN jsonb_typeof(pcv.value_json) = 'array'
                                    THEN pcv.value_json
                                WHEN jsonb_typeof(pcv.value_json) = 'string'
                                    THEN jsonb_build_array(pcv.value_json #>> '{}')
                                ELSE '[]'::jsonb
                            END
                        ) option_values(option_id)
                        LEFT JOIN custom_field_options cfo_json
                          ON cfo_json.field_id = cf.id
                         AND cfo_json.id::text = option_values.option_id
                    ) json_options ON true
                    WHERE pcv.player_id = pp.id
                      AND regexp_replace(
                          lower(cf.key),
                          '[^a-z0-9]+',
                          '_',
                          'g'
                      ) = 'main_position'
                    ORDER BY pcv.updated_at DESC NULLS LAST
                    LIMIT 1
                ) custom_position ON true
                WHERE pp.academy_id = :academyId
                  AND pp.deleted_at IS NULL
                  AND (
                      :branchId::uuid IS NULL
                      OR pp.branch_id = :branchId::uuid
                  )
                ORDER BY pp.full_name ASC
            `, {
                academyId,
                branchId,
                dateFrom,
                dateTo,
            }),
        ]);

        const totalAttendance = Number(attendanceSummary?.total || 0);
        const attended = Number(attendanceSummary?.attended || 0);

        return {
            filters: { branchId, dateFrom, dateTo },
            summary: {
                totalPlayers: Number(playerSummary?.total || 0),
                activePlayers: Number(playerSummary?.active || 0),
                newPlayers: Number(playerSummary?.newPlayers || 0),
                totalCoaches: Number(coachSummary?.total || 0),
                totalSessions: Number(sessionSummary?.total || 0),
                completedSessions: Number(sessionSummary?.completed || 0),
                attendanceRate: totalAttendance > 0
                    ? Math.round((attended / totalAttendance) * 100)
                    : 0,
            },
            attendance: {
                total: totalAttendance,
                present: Number(attendanceSummary?.present || 0),
                late: Number(attendanceSummary?.late || 0),
                absent: Number(attendanceSummary?.absent || 0),
                excused: Number(attendanceSummary?.excused || 0),
                injured: Number(attendanceSummary?.injured || 0),
            },
            levelDistribution: levelDistribution.map((row) => ({
                level: row.level,
                count: Number(row.count || 0),
            })),
            attendanceTrend: attendanceTrend.map((row) => ({
                label: row.label,
                rate: Number(row.rate || 0),
            })),
            groups: groupPerformance.map((row) => ({
                ...row,
                players: Number(row.players || 0),
                sessions: Number(row.sessions || 0),
                attendanceRate: Number(row.attendanceRate || 0),
            })),
            coaches: coachPerformance.map((row) => ({
                ...row,
                groupCount: Number(row.groupCount || 0),
                playerCount: Number(row.playerCount || 0),
                sessions: Number(row.sessions || 0),
                attendanceRate: Number(row.attendanceRate || 0),
            })),
            players: playerProgress.rows.map((row) => ({
                ...row,
                attendanceTotal: Number(row.attendanceTotal || 0),
                attendanceAttended: Number(row.attendanceAttended || 0),
                attendanceRate: Number(row.attendanceRate || 0),
            })),
        };
    }

    async getWeeklyMatches(academyId) {
        const rows = await this.db.raw(`
            WITH days AS (
                SELECT generate_series(
                    date_trunc('week', current_date)::date,
                    (date_trunc('week', current_date)::date + interval '6 days')::date,
                    interval '1 day'
                )::date AS day_date
            )
            SELECT
                d.day_date::text AS date,
                to_char(d.day_date, 'Dy') AS "dayLabel",
                to_char(d.day_date, 'DD Mon') AS "dateLabel",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', m.id::text,
                            'opponentName', m.opponent_name,
                            'matchTime', to_char(m.match_time, 'HH24:MI'),
                            'venueType', m.venue_type::text,
                            'status', m.status::text,
                            'matchStatus', m.match_status::text,
                            'ourScore', m.our_score,
                            'opponentScore', m.opponent_score,
                            'played', (
                                m.status::text IN ('completed', 'finished')
                                OR m.match_status::text = 'finished'
                            )
                        )
                        ORDER BY m.match_time ASC
                    ) FILTER (WHERE m.id IS NOT NULL),
                    '[]'::json
                ) AS matches
            FROM days d
            LEFT JOIN matches m
              ON m.match_date = d.day_date
             AND m.deleted_at IS NULL
             AND m.status::text <> 'cancelled'
             AND (
                :academyId::uuid IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM calendar_events ce
                    WHERE ce.id = m.event_id
                      AND ce.academy_id = :academyId
                      AND ce.deleted_at IS NULL
                )
             )
            GROUP BY d.day_date
            ORDER BY d.day_date ASC
        `, { academyId });

        return rows.rows;
    }

    // ─── Access Control Settings ────────────────────────────────────────
}

module.exports = AdminDashboardRepository;
