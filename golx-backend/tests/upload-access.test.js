const { canAccessMediaFile } = require('../src/shared/upload-access');

function queryReturning(row) {
    const builder = {};
    ['join', 'leftJoin', 'where', 'whereNull', 'select'].forEach((method) => {
        builder[method] = jest.fn(() => builder);
    });
    builder.first = jest.fn(async () => row);
    return builder;
}

function dbForCoachAssignment({ coachProfile, assignment }) {
    return jest.fn((table) => {
        if (table === 'coach_profiles') return queryReturning(coachProfile);
        if (table === 'coach_assignments') return queryReturning(assignment);
        return queryReturning(null);
    });
}

function dbForPlayerAssignmentSubmission(submission) {
    return jest.fn(() => queryReturning(submission));
}

describe('upload access policy', () => {
    test('admin and uploader keep direct access to sensitive media', async () => {
        const db = jest.fn();
        await expect(canAccessMediaFile(
            { role: 'admin', userId: 'admin-1', academyId: 'academy-1' },
            { academy_id: 'academy-1', scope: 'assignments', is_sensitive: true },
            db,
        )).resolves.toBe(true);

        await expect(canAccessMediaFile(
            { role: 'player', userId: 'player-1', academyId: 'academy-1' },
            {
                academy_id: 'academy-1',
                scope: 'player-assignments',
                uploader_id: 'player-1',
                is_sensitive: true,
            },
            db,
        )).resolves.toBe(true);

        expect(db).not.toHaveBeenCalled();
    });

    test('coach assignment media requires a linked assignment for that coach', async () => {
        const coach = { role: 'coach', userId: 'coach-user', academyId: 'academy-1' };
        const mediaFile = {
            academy_id: 'academy-1',
            scope: 'assignments',
            entity_type: 'coach_assignment',
            entity_id: 'assignment-1',
            is_sensitive: true,
        };

        await expect(canAccessMediaFile(
            coach,
            mediaFile,
            dbForCoachAssignment({
                coachProfile: { id: 'coach-1' },
                assignment: { id: 'assignment-1' },
            }),
        )).resolves.toBe(true);

        await expect(canAccessMediaFile(
            coach,
            mediaFile,
            dbForCoachAssignment({
                coachProfile: { id: 'coach-1' },
                assignment: null,
            }),
        )).resolves.toBe(false);
    });

    test('sensitive assignment media without entity metadata is denied by default', async () => {
        await expect(canAccessMediaFile(
            { role: 'coach', userId: 'coach-user', academyId: 'academy-1' },
            {
                academy_id: 'academy-1',
                scope: 'assignments',
                is_sensitive: true,
            },
            dbForCoachAssignment({ coachProfile: { id: 'coach-1' }, assignment: null }),
        )).resolves.toBe(false);
    });

    test('player assignment submission media is not exposed to same-academy parents by default', async () => {
        const mediaFile = {
            academy_id: 'academy-1',
            scope: 'player-assignments',
            entity_type: 'player_assignment_submission',
            entity_id: 'submission-1',
            is_sensitive: true,
        };
        const submission = {
            player_id: 'player-profile-1',
            submitted_by_user_id: 'player-user',
            player_user_id: 'player-user',
            coach_user_id: 'coach-user',
        };

        await expect(canAccessMediaFile(
            { role: 'parent', userId: 'parent-user', academyId: 'academy-1' },
            mediaFile,
            dbForPlayerAssignmentSubmission(submission),
        )).resolves.toBe(false);

        await expect(canAccessMediaFile(
            { role: 'player', userId: 'player-user', academyId: 'academy-1' },
            mediaFile,
            dbForPlayerAssignmentSubmission(submission),
        )).resolves.toBe(true);

        await expect(canAccessMediaFile(
            { role: 'coach', userId: 'coach-user', academyId: 'academy-1' },
            mediaFile,
            dbForPlayerAssignmentSubmission(submission),
        )).resolves.toBe(true);
    });
});
