const {
    normalizeRatios,
    parseLoadConfig,
    shardValue,
} = require('../load-tests/load-test-config');

describe('load-test config', () => {
    test('splits target users across shards', () => {
        expect(shardValue(20000, 0, 4)).toBe(5000);
        expect(shardValue(20001, 0, 4)).toBe(5001);
        expect(shardValue(20001, 1, 4)).toBe(5000);
    });

    test('parses 20k target profile with local shard counts', () => {
        const config = parseLoadConfig([
            '--profile=20k-target',
            '--target=https://staging-api.example.com',
            '--shard-count=4',
            '--shard-index=2',
            '--dry-run=true',
        ]);

        expect(config.users).toBe(20000);
        expect(config.localUsers).toBe(5000);
        expect(config.localStages).toEqual([{ global: 20000, local: 5000 }]);
        expect(config.targets).toEqual(['https://staging-api.example.com']);
        expect(config.thresholds.httpErrorRateMax).toBe(0.005);
    });

    test('normalizes role ratios from cli input', () => {
        const config = parseLoadConfig([
            '--role-ratios=player=45,parent=20,coach=25,admin=10',
            '--dry-run=true',
        ]);

        expect(config.roleRatios).toEqual({
            player: 0.45,
            parent: 0.2,
            coach: 0.25,
            admin: 0.1,
        });
    });

    test('normalizes arbitrary ratio maps', () => {
        expect(normalizeRatios({ a: 2, b: 2 })).toEqual({ a: 0.5, b: 0.5 });
    });
});
