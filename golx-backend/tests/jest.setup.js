const closeCachedModuleResource = async (modulePath, closeResource) => {
    let resolvedPath;
    try {
        resolvedPath = require.resolve(modulePath);
    } catch (_err) {
        return;
    }

    const cachedModule = require.cache[resolvedPath];
    if (!cachedModule) return;

    await closeResource(cachedModule.exports);
};

afterAll(async () => {
    await closeCachedModuleResource('../src/infrastructure/queue', async (queues) => {
        await Promise.allSettled([
            queues.rankingsQueue?.close?.(),
            queues.notificationsQueue?.close?.(),
            queues.paymentsQueue?.close?.(),
            queues.aiQueue?.close?.(),
        ]);
    });

    await closeCachedModuleResource('../src/infrastructure/redis', async ({ redis }) => {
        if (!redis || redis.status === 'end') return;

        try {
            await redis.quit?.();
        } catch (_err) {
            redis.disconnect?.();
        }
    });

    await closeCachedModuleResource('../src/infrastructure/database', async (db) => {
        await db.destroy?.();
    });
});
