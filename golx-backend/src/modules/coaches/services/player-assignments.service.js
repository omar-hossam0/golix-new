const {
    BadRequestError,
    NotFoundError,
} = require('../../../shared/errors');

const toNumber = (value, fallback = 0) => {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

class CoachPlayerAssignmentsService {
    constructor(
        repository,
        { getCurrentCoach, assertCoachPermission },
        { now = () => new Date() } = {},
    ) {
        this.repo = repository;
        this.getCurrentCoach = getCurrentCoach;
        this.assertCoachPermission = assertCoachPermission;
        this.now = now;
    }

    shapeFile(file) {
        return {
            id: file.id,
            submissionId: file.submission_id,
            fileType: file.file_type,
            fileName: file.file_name,
            fileUrl: file.file_url,
            mimeType: file.mime_type,
            sizeBytes: toNumber(file.size_bytes),
            uploadedBy: file.uploaded_by,
            createdAt: file.created_at,
        };
    }

    shapeSubmission(submission) {
        return {
            id: submission.id,
            assignmentId: submission.assignment_id,
            playerId: submission.player_id,
            playerName: submission.player_name || null,
            notes: submission.notes || '',
            submittedAt: submission.submitted_at,
            reviewStatus: submission.review_status || 'pending',
            coachComment: submission.coach_comment || '',
            reviewedAt: submission.reviewed_at || null,
            files: (submission.files || []).map((file) => this.shapeFile(file)),
        };
    }

    shapeAssignment(assignment) {
        return {
            id: assignment.id,
            academyId: assignment.academy_id,
            createdByCoachId: assignment.created_by_coach_id,
            coachName: assignment.coach_name || null,
            title: assignment.title,
            description: assignment.description || '',
            openAt: assignment.open_at,
            dueAt: assignment.due_at,
            targetType: assignment.target_type || 'group',
            status: assignment.status,
            acceptedFileTypes: assignment.accepted_file_types || ['pdf', 'word', 'image'],
            createdAt: assignment.created_at,
            updatedAt: assignment.updated_at,
            groups: assignment.groups || [],
            birthYears: assignment.birth_years || [],
            submissionCount: Number(assignment.submission_count || 0),
            submissions: (assignment.submissions || [])
                .map((submission) => this.shapeSubmission(submission)),
        };
    }

    async resolveTargets(coachId, academyId, data = {}) {
        const targetType = data.targetType === 'birth_year' ? 'birth_year' : 'group';
        const groups = await this.repo.findCoachGroupsDetailed(coachId, academyId);

        if (targetType === 'group') {
            const groupIds = [...new Set((data.groupIds || []).filter(Boolean))];
            if (!groupIds.length) {
                throw new BadRequestError('Select at least one target group.');
            }
            const allowed = new Set(groups.map((group) => group.id));
            const invalid = groupIds.find((groupId) => !allowed.has(groupId));
            if (invalid) throw new NotFoundError('Group', invalid);
            return { targetType, groupIds, birthYearIds: [] };
        }

        const birthYearIds = [
            ...new Set((data.birthYearIds || []).filter(Boolean)),
        ];
        if (!birthYearIds.length) {
            throw new BadRequestError('Select at least one target birthday.');
        }
        const allowedBirthYears = new Set(
            groups.flatMap((group) =>
                (group.birth_years || [])
                    .map((birthYear) => birthYear.id)
                    .filter(Boolean),
            ),
        );
        const invalid = birthYearIds.find(
            (birthYearId) => !allowedBirthYears.has(birthYearId),
        );
        if (invalid) throw new NotFoundError('Birth year', invalid);

        const requestedBirthYears = new Set(birthYearIds);
        const groupIds = [
            ...new Set(
                groups
                    .filter((group) =>
                        (group.birth_years || []).some((birthYear) =>
                            requestedBirthYears.has(birthYear.id),
                        ),
                    )
                    .map((group) => group.id),
            ),
        ];
        if (!groupIds.length) {
            throw new BadRequestError(
                'Selected birthday is not linked to an available group.',
            );
        }
        return { targetType, groupIds, birthYearIds };
    }

    assignmentDate(value) {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new BadRequestError('Assignment date is invalid.');
        }
        return date;
    }

    nowFloor() {
        const now = this.now();
        now.setSeconds(0, 0);
        return now;
    }

    async list(userId, academyId, filters) {
        const coach = await this.getCurrentCoach(userId, academyId);
        const result = await this.repo.findCoachPlayerAssignments(
            coach.id,
            academyId,
            filters,
        );
        return {
            ...result,
            data: result.data.map((assignment) => this.shapeAssignment(assignment)),
        };
    }

    async create(userId, academyId, data) {
        const coach = await this.getCurrentCoach(userId, academyId);
        const targets = await this.resolveTargets(coach.id, academyId, data);
        await this.assertCoachPermission(
            coach,
            academyId,
            'can_manage_player_assignments',
            { groupIds: targets.groupIds },
        );
        const openAt = this.assignmentDate(data.openAt);
        const dueAt = this.assignmentDate(data.dueAt);
        const now = this.nowFloor();
        if (openAt && openAt < now) {
            throw new BadRequestError('Open date must be now or later.');
        }
        if (dueAt && dueAt < now) {
            throw new BadRequestError('Due date must be now or later.');
        }
        if (openAt && dueAt && dueAt < openAt) {
            throw new BadRequestError('Due date must be after open date.');
        }

        const assignment = await this.repo.createPlayerAssignment(
            {
                academy_id: academyId,
                created_by_coach_id: coach.id,
                created_by_user_id: userId,
                title: data.title,
                description: data.description || null,
                open_at: openAt,
                due_at: dueAt,
                target_type: targets.targetType,
                status: 'active',
            },
            targets.groupIds,
            targets.birthYearIds,
        );

        const [groups, birthYears] = await Promise.all([
            this.repo.findPlayerAssignmentGroups([assignment.id]),
            this.repo.findPlayerAssignmentBirthYears([assignment.id]),
        ]);
        return this.shapeAssignment({
            ...assignment,
            coach_name: coach.full_name,
            groups: groups.map((group) => ({ id: group.id, name: group.name })),
            birth_years: birthYears.map((birthYear) => ({
                id: birthYear.id,
                label: birthYear.label,
                fromYear: birthYear.from_year,
                toYear: birthYear.to_year,
            })),
            submission_count: 0,
        });
    }

    async update(userId, academyId, assignmentId, data) {
        const coach = await this.getCurrentCoach(userId, academyId);
        const existing = await this.repo.findCoachPlayerAssignmentById(
            assignmentId,
            coach.id,
            academyId,
        );
        if (!existing) {
            throw new NotFoundError('Player assignment', assignmentId);
        }
        await this.assertCoachPermission(
            coach,
            academyId,
            'can_manage_player_assignments',
            { groupIds: (existing.groups || []).map((group) => group.id) },
        );

        const shouldUpdateTargets =
            data.targetType !== undefined ||
            data.groupIds !== undefined ||
            data.birthYearIds !== undefined;
        const targets = shouldUpdateTargets
            ? await this.resolveTargets(coach.id, academyId, {
                targetType: data.targetType || existing.target_type || 'group',
                groupIds: data.groupIds || [],
                birthYearIds: data.birthYearIds || [],
            })
            : null;
        if (targets) {
            await this.assertCoachPermission(
                coach,
                academyId,
                'can_manage_player_assignments',
                { groupIds: targets.groupIds },
            );
        }

        const openAt =
            data.openAt === undefined
                ? undefined
                : this.assignmentDate(data.openAt);
        const dueAt =
            data.dueAt === undefined
                ? undefined
                : this.assignmentDate(data.dueAt);
        const now = this.nowFloor();
        const existingOpenAt = existing.open_at
            ? new Date(existing.open_at)
            : null;
        const existingDueAt = existing.due_at
            ? new Date(existing.due_at)
            : null;
        const isExistingOpen =
            existing.status === 'active' &&
            existingOpenAt &&
            existingOpenAt <= now &&
            (!existingDueAt || existingDueAt >= now);
        if (
            isExistingOpen &&
            openAt !== undefined &&
            (!existingOpenAt || openAt?.getTime() !== existingOpenAt.getTime())
        ) {
            throw new BadRequestError(
                'Open date cannot be changed after the assignment opens.',
            );
        }
        if (isExistingOpen && dueAt && dueAt < now) {
            throw new BadRequestError(
                'Due date must be now or later for an open assignment.',
            );
        }
        const nextOpen = openAt === undefined ? existing.open_at : openAt;
        const nextDue = dueAt === undefined ? existing.due_at : dueAt;
        if (nextOpen && nextDue && new Date(nextDue) < new Date(nextOpen)) {
            throw new BadRequestError('Due date must be after open date.');
        }

        await this.repo.updatePlayerAssignment(
            assignmentId,
            {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.description !== undefined
                    ? { description: data.description || null }
                    : {}),
                ...(openAt !== undefined ? { open_at: openAt } : {}),
                ...(dueAt !== undefined ? { due_at: dueAt } : {}),
                ...(targets ? { target_type: targets.targetType } : {}),
                ...(data.status !== undefined ? { status: data.status } : {}),
            },
            targets?.groupIds ?? null,
            targets?.birthYearIds ?? null,
        );

        const updated = await this.repo.findCoachPlayerAssignmentById(
            assignmentId,
            coach.id,
            academyId,
        );
        return this.shapeAssignment(updated);
    }

    async remove(userId, academyId, assignmentId) {
        const coach = await this.getCurrentCoach(userId, academyId);
        const existing = await this.repo.findCoachPlayerAssignmentById(
            assignmentId,
            coach.id,
            academyId,
        );
        if (!existing) {
            throw new NotFoundError('Player assignment', assignmentId);
        }
        await this.assertCoachPermission(
            coach,
            academyId,
            'can_manage_player_assignments',
            { groupIds: (existing.groups || []).map((group) => group.id) },
        );
        await this.repo.deletePlayerAssignment(assignmentId);
        return { id: assignmentId, deleted: true };
    }

    async listSubmissions(userId, academyId, assignmentId) {
        const coach = await this.getCurrentCoach(userId, academyId);
        const assignment = await this.repo.findCoachPlayerAssignmentById(
            assignmentId,
            coach.id,
            academyId,
        );
        if (!assignment) {
            throw new NotFoundError('Player assignment', assignmentId);
        }
        const submissions = await this.repo.findPlayerAssignmentSubmissions(
            assignmentId,
        );
        return submissions.map((submission) =>
            this.shapeSubmission(submission),
        );
    }

    async reviewSubmission(
        userId,
        academyId,
        assignmentId,
        submissionId,
        data,
    ) {
        const coach = await this.getCurrentCoach(userId, academyId);
        const assignment = await this.repo.findCoachPlayerAssignmentById(
            assignmentId,
            coach.id,
            academyId,
        );
        if (!assignment) {
            throw new NotFoundError('Player assignment', assignmentId);
        }
        await this.assertCoachPermission(
            coach,
            academyId,
            'can_manage_player_assignments',
            { groupIds: (assignment.groups || []).map((group) => group.id) },
        );
        const submissions = await this.repo.findPlayerAssignmentSubmissions(
            assignmentId,
        );
        const submission = submissions.find((row) => row.id === submissionId);
        if (!submission) {
            throw new NotFoundError(
                'Player assignment submission',
                submissionId,
            );
        }
        const updated = await this.repo.reviewPlayerAssignmentSubmission(
            submissionId,
            {
                status: data.status,
                comment: data.comment,
                coachId: coach.id,
                userId,
            },
        );
        return this.shapeSubmission({
            ...submission,
            ...updated,
            files: submission.files || [],
            player_name: submission.player_name,
        });
    }

    async listDailyAiInputs(userId, academyId) {
        const coach = await this.getCurrentCoach(userId, academyId);
        const players = await this.repo.findCoachPlayers(coach.id, academyId);
        const playerIds = players.map((player) => player.id);
        const { rows } = await this.repo.db.raw(`
            SELECT
              date_trunc('week', current_date)::date::text AS week_start,
              (date_trunc('week', current_date)::date + 6)::text AS week_end
        `);
        const weekStart = rows[0]?.week_start;
        const weekEnd = rows[0]?.week_end;
        if (!playerIds.length) return { weekStart, weekEnd, data: [] };

        const inputRows = await this.repo.db('player_daily_ai_inputs as pdai')
            .join('player_profiles as pp', 'pdai.player_id', 'pp.id')
            .whereIn('pdai.player_id', playerIds)
            .where('pdai.academy_id', academyId)
            .where('pdai.input_date', '>=', weekStart)
            .where('pdai.input_date', '<=', weekEnd)
            .select('pdai.*', 'pp.full_name as player_name')
            .orderBy('pdai.input_date', 'desc')
            .orderBy('pp.full_name', 'asc');

        return {
            weekStart,
            weekEnd,
            data: inputRows.map((row) => ({
                id: row.id,
                playerId: row.player_id,
                playerName: row.player_name,
                inputDate: row.input_date,
                sleepHours: Number(row.sleep_hours),
                trainedToday: Number(row.trained_today),
                mealsCount: Number(row.meals_count),
                dailyAiScore: Number(row.daily_ai_score),
                submittedAt: row.submitted_at,
            })),
        };
    }
}

module.exports = CoachPlayerAssignmentsService;
