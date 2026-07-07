class AttendanceRepository {
    constructor(db) {
        this.db = db;
    }

    async getAttendanceOverview({ groupId, branchId, dateFrom, dateTo, academyId }) {
        const applyDateFilters = (query) => query.modify((q) => {
            if (dateFrom) q.whereRaw('ce.start_datetime >= ?::date', [dateFrom]);
            if (dateTo) q.whereRaw("ce.start_datetime < (?::date + interval '1 day')", [dateTo]);
        });

        const applyTrainingTargetFilters = (query) => query.modify((q) => {
            if (groupId) {
                q.whereExists(
                    this.db('calendar_event_groups as target_group')
                        .whereRaw('target_group.event_id = ce.id')
                        .where('target_group.group_id', groupId)
                        .select(this.db.raw('1')),
                );
            }

            if (branchId) {
                q.where((branchScope) => {
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
        });

        const trainingQuery = applyTrainingTargetFilters(
            applyDateFilters(
                this.db('calendar_events as ce')
                    .where('ce.academy_id', academyId)
                    .where('ce.event_type', 'training')
                    .whereNull('ce.deleted_at'),
            ),
        );

        const attendanceQuery = applyDateFilters(
            this.db('event_attendance as ea')
                .join('calendar_events as ce', 'ce.id', 'ea.event_id')
                .join('player_profiles as pp', 'pp.id', 'ea.player_id')
                .where('ce.academy_id', academyId)
                .where('ce.event_type', 'training')
                .whereNull('ce.deleted_at')
                .whereNull('pp.deleted_at')
                .modify((q) => {
                    if (branchId) q.where('pp.branch_id', branchId);
                    if (groupId) {
                        q.whereExists(
                            this.db('player_group_assignments as scoped_pga')
                                .whereRaw('scoped_pga.player_id = ea.player_id')
                                .where('scoped_pga.group_id', groupId)
                                .whereNull('scoped_pga.left_at')
                                .select(this.db.raw('1')),
                        );
                    }
                }),
        );

        const [trainingSummary, attendanceSummary, byGroup, byBranch, recentSessions, lowAttendancePlayers] = await Promise.all([
            trainingQuery
                .clone()
                .select(
                    this.db.raw('COUNT(DISTINCT ce.id)::int as total'),
                    this.db.raw("COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'scheduled')::int as scheduled"),
                    this.db.raw("COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'finished')::int as completed"),
                    this.db.raw("COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'cancelled')::int as cancelled"),
                )
                .first(),
            attendanceQuery
                .clone()
                .select(
                    this.db.raw('COUNT(ea.id)::int as total'),
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
            attendanceQuery
                .clone()
                .join('player_group_assignments as pga', function joinActiveGroup() {
                    this.on('pga.player_id', '=', 'ea.player_id').andOnNull('pga.left_at');
                })
                .join('academy_groups as ag', 'ag.id', 'pga.group_id')
                .join('academy_branches as ab', 'ab.id', 'ag.branch_id')
                .whereNull('ag.deleted_at')
                .modify((q) => {
                    if (groupId) q.where('ag.id', groupId);
                    if (branchId) q.where('ab.id', branchId);
                })
                .groupBy('ag.id', 'ag.name')
                .select(
                    'ag.id as groupId',
                    'ag.name as groupName',
                    this.db.raw('COUNT(DISTINCT ea.id)::int as total'),
                    this.db.raw(
                        "COUNT(DISTINCT ea.id) FILTER (WHERE ea.status IN ('present', 'late'))::int as attended",
                    ),
                )
                .orderBy('ag.name', 'asc'),
            attendanceQuery
                .clone()
                .join('academy_branches as ab', 'ab.id', 'pp.branch_id')
                .whereNull('ab.deleted_at')
                .groupBy('ab.id', 'ab.name')
                .select(
                    'ab.id as branchId',
                    'ab.name as branchName',
                    this.db.raw('COUNT(DISTINCT ea.id)::int as total'),
                    this.db.raw(
                        "COUNT(DISTINCT ea.id) FILTER (WHERE ea.status IN ('present', 'late'))::int as attended",
                    ),
                    this.db.raw("COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'present')::int as present"),
                    this.db.raw("COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'late')::int as late"),
                    this.db.raw("COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'absent')::int as absent"),
                    this.db.raw("COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'excused')::int as excused"),
                    this.db.raw("COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'injured')::int as injured"),
                )
                .orderBy('ab.name', 'asc'),
            applyTrainingTargetFilters(
                applyDateFilters(
                    this.db('calendar_events as ce')
                        .leftJoin('training_sessions as ts', 'ts.event_id', 'ce.id')
                        .leftJoin('coach_profiles as cp', 'cp.id', 'ts.coach_id')
                        .leftJoin('iam_users as coach_user', 'coach_user.id', 'cp.user_id')
                        .where('ce.academy_id', academyId)
                        .where('ce.event_type', 'training')
                        .whereNull('ce.deleted_at'),
                ),
            )
                .select(
                    'ce.id',
                    'ce.title',
                    'ce.start_datetime as startDatetime',
                    'ce.end_datetime as endDatetime',
                    'ce.location',
                    'ce.status',
                    'ts.training_focus as trainingFocus',
                    'ts.intensity_level as intensityLevel',
                    'coach_user.full_name as coachName',
                    this.db.raw(`(
                        SELECT STRING_AGG(DISTINCT ag.name, ', ' ORDER BY ag.name)
                        FROM calendar_event_groups ceg
                        JOIN academy_groups ag ON ag.id = ceg.group_id
                        WHERE ceg.event_id = ce.id
                    ) as "groupNames"`),
                    this.db.raw(`(
                        SELECT COUNT(*)::int
                        FROM event_attendance ea
                        WHERE ea.event_id = ce.id
                    ) as "recordedCount"`),
                    this.db.raw(`(
                        SELECT COUNT(*)::int
                        FROM event_attendance ea
                        WHERE ea.event_id = ce.id AND ea.status IN ('present', 'late')
                    ) as "attendedCount"`),
                    this.db.raw(`(
                        SELECT COUNT(*)::int
                        FROM event_attendance ea
                        WHERE ea.event_id = ce.id AND ea.status = 'absent'
                    ) as "absentCount"`),
                    this.db.raw(`(
                        SELECT COUNT(*)::int
                        FROM event_attendance ea
                        WHERE ea.event_id = ce.id AND ea.status = 'injured'
                    ) as "injuredCount"`),
                )
                .orderBy('ce.start_datetime', 'desc')
                .limit(12),
            attendanceQuery
                .clone()
                .join('player_group_assignments as pga', function joinActiveGroup() {
                    this.on('pga.player_id', '=', 'ea.player_id').andOnNull('pga.left_at');
                })
                .join('academy_groups as ag', 'ag.id', 'pga.group_id')
                .join('academy_branches as ab', 'ab.id', 'ag.branch_id')
                .whereNull('ag.deleted_at')
                .groupBy('pp.id', 'pp.full_name', 'pp.position', 'ag.id', 'ag.name', 'ab.name')
                .select(
                    'pp.id as playerId',
                    'pp.full_name as playerName',
                    'pp.position',
                    'ag.id as groupId',
                    'ag.name as groupName',
                    'ab.name as branchName',
                    this.db.raw('COUNT(DISTINCT ea.id)::int as total'),
                    this.db.raw(
                        "COUNT(DISTINCT ea.id) FILTER (WHERE ea.status IN ('present', 'late'))::int as attended",
                    ),
                    this.db.raw("COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'absent')::int as absent"),
                    this.db.raw("COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'injured')::int as injured"),
                    this.db.raw("MAX(ce.start_datetime) as \"lastSessionAt\""),
                )
                .havingRaw('COUNT(DISTINCT ea.id) >= 1')
                .orderByRaw(`
                    COALESCE(
                        ROUND(
                            100.0 * COUNT(DISTINCT ea.id) FILTER (WHERE ea.status IN ('present', 'late'))
                            / NULLIF(COUNT(DISTINCT ea.id), 0)
                        ),
                        0
                    ) ASC
                `)
                .limit(10),
        ]);

        const total = Number(attendanceSummary?.total || 0);
        const present = Number(attendanceSummary?.present || 0);
        const late = Number(attendanceSummary?.late || 0);
        const statusCounts = {
            present,
            late,
            absent: Number(attendanceSummary?.absent || 0),
            excused: Number(attendanceSummary?.excused || 0),
            injured: Number(attendanceSummary?.injured || 0),
        };

        const withRate = (row, idKey, nameKey) => {
            const rowTotal = Number(row.total || 0);
            const attended = Number(row.attended || 0);
            return {
                [idKey]: row[idKey],
                [nameKey]: row[nameKey],
                rate: rowTotal ? Math.round((attended / rowTotal) * 100) : 0,
                total: rowTotal,
                attended,
                present: Number(row.present || 0),
                late: Number(row.late || 0),
                absent: Number(row.absent || 0),
                excused: Number(row.excused || 0),
                injured: Number(row.injured || 0),
            };
        };

        return {
            totalTrainings: Number(trainingSummary?.total || 0),
            avgRate: total ? Math.round(((present + late) / total) * 100) : 0,
            presentCount: present,
            absentCount: statusCounts.absent,
            lateCount: late,
            excusedCount: statusCounts.excused,
            injuredCount: statusCounts.injured,
            totalRecords: total,
            attendedCount: present + late,
            missedCount: statusCounts.absent + statusCounts.excused + statusCounts.injured,
            statusCounts,
            trainingStatusCounts: {
                scheduled: Number(trainingSummary?.scheduled || 0),
                completed: Number(trainingSummary?.completed || 0),
                cancelled: Number(trainingSummary?.cancelled || 0),
            },
            byGroup: byGroup.map((row) => withRate(row, 'groupId', 'groupName')),
            byBranch: byBranch.map((row) => withRate(row, 'branchId', 'branchName')),
            recentSessions: recentSessions.map((row) => {
                const recordedCount = Number(row.recordedCount || 0);
                const attendedCount = Number(row.attendedCount || 0);
                return {
                    ...row,
                    recordedCount,
                    attendedCount,
                    absentCount: Number(row.absentCount || 0),
                    injuredCount: Number(row.injuredCount || 0),
                    rate: recordedCount ? Math.round((attendedCount / recordedCount) * 100) : 0,
                };
            }),
            lowAttendancePlayers: lowAttendancePlayers.map((row) => {
                const playerTotal = Number(row.total || 0);
                const attended = Number(row.attended || 0);
                return {
                    ...row,
                    total: playerTotal,
                    attended,
                    absent: Number(row.absent || 0),
                    injured: Number(row.injured || 0),
                    rate: playerTotal ? Math.round((attended / playerTotal) * 100) : 0,
                };
            }),
        };
    }
}

module.exports = AttendanceRepository;
