require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const DataLifecycleService = require('../src/modules/data-lifecycle/data-lifecycle.service');

function buildRepo(overrides = {}) {
    let runNumber = 0;
    return {
        createRun: jest.fn(async (data) => {
            runNumber += 1;
            return { id: `run-${runNumber}`, ...data };
        }),
        finishRun: jest.fn(async (id, data) => ({ id, ...data })),
        selectIdsOlderThan: jest.fn(async ({ sourceTable }) => {
            if (sourceTable === 'notification_inbox') return ['notif-1'];
            if (sourceTable === 'ai_analyses') return ['ai-1'];
            return [];
        }),
        moveRowsMatchingToArchive: jest.fn(async ({ sourceTable }) => {
            if (sourceTable === 'notification_logs') return { archived: 2, deleted: 2 };
            if (sourceTable === 'notification_inbox') return { archived: 1, deleted: 1 };
            return { archived: 1, deleted: 1 };
        }),
        archiveChatMessages: jest.fn(async () => ({
            archived: 1,
            deleted: 1,
            archivedUserDeletions: 1,
            deletedUserDeletions: 1,
        })),
        deleteRowsByIds: jest.fn(async ({ ids }) => ids.length),
        tableExists: jest.fn(async () => true),
        estimatedRows: jest.fn(async () => 0),
        columnExists: jest.fn(async () => true),
        latestRuns: jest.fn(async () => []),
        ...overrides,
    };
}

describe('data lifecycle service', () => {
    test('notification cleanup archives logs and inbox before removing hot rows', async () => {
        const repo = buildRepo();
        const service = new DataLifecycleService(repo);

        const result = await service.archiveNotifications({
            now: new Date('2026-07-01T00:00:00.000Z'),
            retentionMonths: 4,
        });

        expect(repo.moveRowsMatchingToArchive).toHaveBeenNthCalledWith(1, expect.objectContaining({
            sourceTable: 'notification_logs',
            archiveTable: 'notification_logs_archive',
            whereColumn: 'notification_id',
            values: ['notif-1'],
        }));
        expect(repo.moveRowsMatchingToArchive).toHaveBeenNthCalledWith(2, expect.objectContaining({
            sourceTable: 'notification_inbox',
            archiveTable: 'notification_inbox_archive',
            whereColumn: 'id',
            values: ['notif-1'],
        }));
        expect(result.archivedNotifications).toBe(1);
        expect(result.removedHotNotifications).toBe(1);
    });

    test('dry-run notification cleanup does not move or remove rows', async () => {
        const repo = buildRepo();
        const service = new DataLifecycleService(repo);

        const result = await service.archiveNotifications({ dryRun: true });

        expect(repo.moveRowsMatchingToArchive).not.toHaveBeenCalled();
        expect(result.archivedNotifications).toBe(1);
        expect(result.removedHotNotifications).toBe(0);
        expect(result.dryRun).toBe(true);
    });

    test('AI archival policy preserves the latest output per player and type', async () => {
        const repo = buildRepo();
        const service = new DataLifecycleService(repo);

        await service._runPolicy(
            {
                key: 'ai_analyses',
                sourceTable: 'ai_analyses',
                archiveTable: 'ai_analyses_archive',
                dateColumn: 'created_at',
                retentionMonths: 18,
                excludeLatestAiOutputs: true,
            },
            {
                runId: 'run-1',
                now: new Date('2026-07-01T00:00:00.000Z'),
                batchSize: 1000,
                dryRun: true,
            },
        );

        expect(repo.selectIdsOlderThan).toHaveBeenCalledWith(expect.objectContaining({
            sourceTable: 'ai_analyses',
            excludeLatestAiOutputs: true,
        }));
    });

    test('chat archival uses the chat-specific transaction path for user deletion state', async () => {
        const repo = buildRepo({
            selectIdsOlderThan: jest.fn(async () => ['message-1']),
        });
        const service = new DataLifecycleService(repo);

        const result = await service._runPolicy(
            {
                key: 'chat_messages',
                sourceTable: 'chat_messages',
                archiveTable: 'chat_messages_archive',
                dateColumn: 'created_at',
                retentionMonths: 24,
            },
            {
                runId: 'run-1',
                now: new Date('2026-07-01T00:00:00.000Z'),
                batchSize: 1000,
                dryRun: false,
            },
        );

        expect(repo.archiveChatMessages).toHaveBeenCalledWith({
            messageIds: ['message-1'],
            archiveBatchId: 'run-1',
        });
        expect(result.archivedUserDeletions).toBe(1);
    });

    test('expired authentication artifacts are purged without being archived', async () => {
        const repo = buildRepo({
            selectIdsOlderThan: jest.fn(async ({ sourceTable }) => (
                sourceTable === 'auth_refresh_tokens' ? ['token-1'] : []
            )),
        });
        const service = new DataLifecycleService(repo);

        const result = await service.runLifecycle({
            now: new Date('2026-07-01T00:00:00.000Z'),
            batchSize: 1000,
        });

        expect(repo.deleteRowsByIds).toHaveBeenCalledWith({
            tableName: 'auth_refresh_tokens',
            ids: ['token-1'],
        });
        expect(result.removedHotCounts.auth_refresh_tokens).toBe(1);
    });
});
