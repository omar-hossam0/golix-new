process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/goalix_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'test-jwt-secret-with-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-with-at-least-32';

const AiService = require('../ai.service');

function makeAuditDb() {
    const insert = jest.fn().mockResolvedValue(undefined);
    const db = jest.fn(() => ({ insert }));
    db.insert = insert;
    return db;
}

function makeService(repoOverrides = {}) {
    const repo = {
        db: makeAuditDb(),
        verifyPlayerOwnership: jest.fn(),
        findCoachProfileByUserId: jest.fn(),
        coachCanAccessPlayer: jest.fn(),
        findParentLinkedPlayer: jest.fn(),
        getAiScore: jest.fn(),
        getAiScores: jest.fn(),
        getAiScoresForCoach: jest.fn(),
        getAiScoresForPlayer: jest.fn(),
        getAiScoresForParent: jest.fn(),
        ...repoOverrides,
    };
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    return { repo, queue, service: new AiService(repo, queue) };
}

describe('AiService access policy', () => {
    test('denies coach access to unassigned player AI insights', async () => {
        const { repo, service } = makeService();
        repo.verifyPlayerOwnership.mockResolvedValue({
            id: 'player-1',
            academy_id: 'academy-1',
            user_id: 'player-user',
        });
        repo.findCoachProfileByUserId.mockResolvedValue({ id: 'coach-1' });
        repo.coachCanAccessPlayer.mockResolvedValue(null);

        await expect(service.getPerformanceScore('player-1', 'academy-1', {
            role: 'coach',
            userId: 'coach-user',
            academyId: 'academy-1',
        })).rejects.toThrow('You cannot access AI insights for this player');

        expect(repo.getAiScore).not.toHaveBeenCalled();
    });

    test('allows coach access to assigned player AI insights', async () => {
        const { repo, service } = makeService();
        repo.verifyPlayerOwnership.mockResolvedValue({
            id: 'player-1',
            academy_id: 'academy-1',
            user_id: 'player-user',
        });
        repo.findCoachProfileByUserId.mockResolvedValue({ id: 'coach-1' });
        repo.coachCanAccessPlayer.mockResolvedValue({ player_id: 'player-1' });
        repo.getAiScore.mockResolvedValue({ id: 'score-1', player_id: 'player-1' });

        await expect(service.getPerformanceScore('player-1', 'academy-1', {
            role: 'coach',
            userId: 'coach-user',
            academyId: 'academy-1',
        })).resolves.toEqual({ id: 'score-1', player_id: 'player-1' });
    });

    test('scopes score lists for coaches', async () => {
        const { repo, service } = makeService();
        repo.findCoachProfileByUserId.mockResolvedValue({ id: 'coach-1' });
        repo.getAiScoresForCoach.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 1 });

        await service.getAllScores('academy-1', { page: 1, limit: 20 }, {
            role: 'coach',
            userId: 'coach-user',
            academyId: 'academy-1',
        });

        expect(repo.getAiScores).not.toHaveBeenCalled();
        expect(repo.getAiScoresForCoach).toHaveBeenCalledWith('academy-1', 'coach-1', { page: 1, limit: 20 });
    });

    test('denies parent AI access when progress visibility is disabled', async () => {
        const { repo, service } = makeService();
        repo.verifyPlayerOwnership.mockResolvedValue({
            id: 'player-1',
            academy_id: 'academy-1',
            user_id: 'player-user',
        });
        repo.findParentLinkedPlayer.mockResolvedValue({
            id: 'player-1',
            can_view_progress: false,
        });

        await expect(service.getInjuryRisk('player-1', 'academy-1', {
            role: 'parent',
            userId: 'parent-user',
            academyId: 'academy-1',
        })).rejects.toThrow('You cannot access AI insights for this player');
    });
});
