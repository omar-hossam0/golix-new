require('dotenv').config();

const CoachesService = require('../coaches.service');
const CoachPlayerAssignmentsService = require(
    '../services/player-assignments.service',
);

describe('coach player-assignment collaborator', () => {
    test('resolves group and birth-year targets inside coach scope', async () => {
        const repository = {
            findCoachGroupsDetailed: jest.fn().mockResolvedValue([
                {
                    id: 'group-1',
                    birth_years: [{ id: 'birth-year-1' }],
                },
                {
                    id: 'group-2',
                    birth_years: [{ id: 'birth-year-2' }],
                },
            ]),
        };
        const service = new CoachPlayerAssignmentsService(repository, {
            getCurrentCoach: jest.fn(),
            assertCoachPermission: jest.fn(),
        });

        await expect(
            service.resolveTargets('coach-1', 'academy-1', {
                targetType: 'group',
                groupIds: ['group-1', 'group-1'],
            }),
        ).resolves.toEqual({
            targetType: 'group',
            groupIds: ['group-1'],
            birthYearIds: [],
        });
        await expect(
            service.resolveTargets('coach-1', 'academy-1', {
                targetType: 'birth_year',
                birthYearIds: ['birth-year-2'],
            }),
        ).resolves.toEqual({
            targetType: 'birth_year',
            groupIds: ['group-2'],
            birthYearIds: ['birth-year-2'],
        });
    });

    test('keeps player-assignment response shaping stable', () => {
        const service = new CoachPlayerAssignmentsService(
            {},
            {
                getCurrentCoach: jest.fn(),
                assertCoachPermission: jest.fn(),
            },
        );

        expect(
            service.shapeAssignment({
                id: 'assignment-1',
                title: 'Recovery plan',
                status: 'active',
                submission_count: '2',
                submissions: [
                    {
                        id: 'submission-1',
                        assignment_id: 'assignment-1',
                        player_id: 'player-1',
                        files: [],
                    },
                ],
            }),
        ).toMatchObject({
            id: 'assignment-1',
            title: 'Recovery plan',
            targetType: 'group',
            submissionCount: 2,
            submissions: [
                {
                    id: 'submission-1',
                    assignmentId: 'assignment-1',
                    reviewStatus: 'pending',
                },
            ],
        });
    });

    test('CoachesService preserves controller-facing delegation', async () => {
        const service = new CoachesService({}, null);
        service.playerAssignments.list = jest
            .fn()
            .mockResolvedValue({ data: [], total: 0 });

        await expect(
            service.getMyPlayerAssignments('user-1', 'academy-1', {
                page: 1,
            }),
        ).resolves.toEqual({ data: [], total: 0 });
        expect(service.playerAssignments.list).toHaveBeenCalledWith(
            'user-1',
            'academy-1',
            { page: 1 },
        );
    });
});
