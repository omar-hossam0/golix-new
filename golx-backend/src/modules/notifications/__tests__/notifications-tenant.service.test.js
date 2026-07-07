process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/goalix_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'test-jwt-secret-with-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-with-at-least-32';

const NotificationsService = require('../notifications.service');

function makeService(repoOverrides = {}) {
    const repo = {
        findTargetUser: jest.fn(),
        targetUsers: jest.fn(),
        createBulk: jest.fn(),
        logNotification: jest.fn(),
        ...repoOverrides,
    };
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    return { repo, queue, service: new NotificationsService(repo, queue) };
}

describe('NotificationsService tenant scoping', () => {
    test('rejects explicit notification recipients outside the academy', async () => {
        const { repo, service } = makeService();
        repo.findTargetUser.mockResolvedValue(null);

        await expect(service.sendNotification({
            userId: 'outside-user',
            type: 'system',
            title: 'Hello',
            body: 'Test',
            channel: 'in_app',
        }, 'academy-1')).rejects.toThrow('User');

        expect(repo.createBulk).not.toHaveBeenCalled();
    });

    test('sends explicit notifications only after recipient academy validation', async () => {
        const { repo, service } = makeService();
        repo.findTargetUser.mockResolvedValue({ user_id: 'inside-user' });
        repo.createBulk.mockResolvedValue([{ id: 'notification-1', user_id: 'inside-user' }]);

        await expect(service.sendNotification({
            userId: 'inside-user',
            type: 'system',
            title: 'Hello',
            body: 'Test',
            channel: 'in_app',
        }, 'academy-1')).resolves.toMatchObject({ count: 1 });

        expect(repo.findTargetUser).toHaveBeenCalledWith('academy-1', 'inside-user');
        expect(repo.createBulk).toHaveBeenCalledTimes(1);
        expect(repo.logNotification).toHaveBeenCalledWith(expect.objectContaining({
            academy_id: 'academy-1',
            user_id: 'inside-user',
        }));
    });
});
