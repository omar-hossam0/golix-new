const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_THRESHOLDS = {
    httpErrorRateMax: 0.005,
    readP95MsMax: 800,
    writeP95MsMax: 1500,
    p99MsMax: 3000,
    socketConnectSuccessRateMin: 0.99,
    socketDisconnectRateMax: 0.01,
};

const DEFAULT_ROLE_RATIOS = {
    player: 0.45,
    parent: 0.20,
    coach: 0.25,
    admin: 0.10,
};

const DEFAULT_WORKLOAD = {
    dashboardReads: 45,
    chatReads: 15,
    socketChat: 10,
    rankingsReads: 10,
    notificationReads: 8,
    coachReads: 7,
    adminReads: 3,
    safeWrites: 2,
};

const PROFILES = {
    smoke: {
        users: 1000,
        stages: [100, 500, 1000],
        stageDurationSec: 60,
        cooldownMs: 5000,
    },
    '10k-baseline': {
        users: 10000,
        stages: [1000, 2500, 5000, 10000],
        stageDurationSec: 120,
        cooldownMs: 10000,
    },
    '16k-stress': {
        users: 16000,
        stages: [12000, 16000],
        stageDurationSec: 180,
        cooldownMs: 15000,
    },
    '20k-target': {
        users: 20000,
        stages: [20000],
        stageDurationSec: 300,
        cooldownMs: 20000,
    },
    '30min-soak': {
        users: 10000,
        stages: [10000],
        stageDurationSec: 1800,
        cooldownMs: 15000,
    },
    soak: {
        users: 10000,
        stages: [10000],
        stageDurationSec: 1800,
        cooldownMs: 15000,
    },
    socket: {
        users: 10000,
        stages: [1000, 2500, 5000, 10000],
        stageDurationSec: 120,
        cooldownMs: 10000,
        socketRatio: 1,
        httpDisabled: true,
    },
};

function parseCliArgs(argv) {
    const values = {};
    for (const argument of argv) {
        if (!argument.startsWith('--')) continue;
        const [key, ...parts] = argument.slice(2).split('=');
        values[key] = parts.length ? parts.join('=') : true;
    }
    return values;
}

function splitCsv(value, fallback = []) {
    if (value === undefined || value === null || value === '') return fallback;
    return String(value)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
}

function splitNumberCsv(value, fallback = []) {
    return splitCsv(value, fallback)
        .map((part) => Number(part))
        .filter(Number.isFinite);
}

function coerceBool(value, fallback = false) {
    if (value === undefined) return fallback;
    if (typeof value === 'boolean') return value;
    return !['false', '0', 'no', 'off'].includes(String(value).toLowerCase());
}

function coerceNumber(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function readJsonConfig(configPath) {
    if (!configPath) return {};
    const resolved = path.resolve(configPath);
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function parseRatioMap(value, fallback) {
    if (!value) return { ...fallback };
    if (typeof value === 'object' && !Array.isArray(value)) {
        return normalizeRatios({ ...fallback, ...value });
    }
    const entries = {};
    for (const pair of splitCsv(value)) {
        const [key, rawNumber] = pair.split('=');
        if (!key || rawNumber === undefined) continue;
        const number = Number(rawNumber);
        if (Number.isFinite(number) && number >= 0) entries[key.trim()] = number;
    }
    return normalizeRatios({ ...fallback, ...entries });
}

function normalizeRatios(ratios) {
    const normalized = {};
    let total = 0;
    for (const [key, value] of Object.entries(ratios || {})) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) continue;
        normalized[key] = number;
        total += number;
    }
    if (!total) return {};
    for (const key of Object.keys(normalized)) {
        normalized[key] = normalized[key] / total;
    }
    return normalized;
}

function shardValue(total, shardIndex, shardCount) {
    const whole = Math.floor(total / shardCount);
    const remainder = total % shardCount;
    return whole + (shardIndex < remainder ? 1 : 0);
}

function parseLoadConfig(argv = process.argv.slice(2)) {
    const cli = parseCliArgs(argv);
    if (cli.help || cli.h) {
        return { help: true };
    }

    const fileConfig = readJsonConfig(cli.config);
    const profileName = String(cli.profile || fileConfig.profile || 'smoke');
    const profile = PROFILES[profileName];
    if (!profile) {
        throw new Error(`Unknown load-test profile "${profileName}". Known profiles: ${Object.keys(PROFILES).join(', ')}`);
    }

    const merged = {
        ...profile,
        ...fileConfig,
        profile: profileName,
    };

    const users = coerceNumber(cli.users, merged.users);
    const stages = splitNumberCsv(cli.stages, merged.stages || []);
    const shardCount = coerceNumber(cli['shard-count'], merged.shardCount || 1);
    const shardIndex = coerceNumber(cli['shard-index'], merged.shardIndex || 0);
    const targets = splitCsv(cli.targets || cli.target, merged.targets || ['http://127.0.0.1:3000'])
        .map((target) => target.replace(/\/$/, ''));

    if (!Number.isInteger(users) || users < 1 || users > 200000) {
        throw new Error('--users must be an integer from 1 to 200000');
    }
    if (!Number.isInteger(shardCount) || shardCount < 1 || shardCount > 1000) {
        throw new Error('--shard-count must be an integer from 1 to 1000');
    }
    if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
        throw new Error('--shard-index must be an integer from 0 to shard-count - 1');
    }
    if (!stages.length || stages.some((stage) => !Number.isInteger(stage) || stage < 1 || stage > users)) {
        throw new Error('--stages must contain positive integers no larger than --users');
    }
    if (!targets.length) throw new Error('At least one --target URL is required');

    const localUsers = shardValue(users, shardIndex, shardCount);
    const localStages = stages.map((stage) => ({
        global: stage,
        local: shardValue(stage, shardIndex, shardCount),
    }));

    return {
        profile: profileName,
        runId: cli['run-id'] || merged.runId || null,
        runGroup: cli['run-group'] || merged.runGroup || null,
        users,
        localUsers,
        stages,
        localStages,
        shardIndex,
        shardCount,
        targets,
        tokenFile: cli['tokens-file'] || merged.tokenFile || null,
        reportDir: cli['report-dir'] || merged.reportDir || path.resolve(__dirname, '../../.tmp/load-tests'),
        stageDurationSec: coerceNumber(cli['stage-duration-sec'], merged.stageDurationSec || 60),
        cooldownMs: coerceNumber(cli['cooldown-ms'], merged.cooldownMs || 5000),
        timeoutMs: coerceNumber(cli['timeout-ms'], merged.timeoutMs || 30000),
        thinkTimeMinMs: coerceNumber(cli['think-min-ms'], merged.thinkTimeMinMs || 250),
        thinkTimeMaxMs: coerceNumber(cli['think-max-ms'], merged.thinkTimeMaxMs || 1500),
        connectBatchSize: coerceNumber(cli['connect-batch-size'], merged.connectBatchSize || 100),
        connectBatchDelayMs: coerceNumber(cli['connect-batch-delay-ms'], merged.connectBatchDelayMs || 25),
        socketRatio: Math.max(0, Math.min(1, coerceNumber(cli['socket-ratio'], merged.socketRatio ?? 0.10))),
        socketPath: cli['socket-path'] || merged.socketPath || '/socket.io',
        socketTransports: splitCsv(cli['socket-transports'], merged.socketTransports || ['websocket', 'polling']),
        socketJoinChats: coerceBool(cli['socket-join-chats'], merged.socketJoinChats ?? true),
        httpDisabled: coerceBool(cli['http-disabled'], merged.httpDisabled || false),
        socketDisabled: coerceBool(cli['socket-disabled'], merged.socketDisabled || false),
        dryRun: coerceBool(cli['dry-run'], merged.dryRun || false),
        warmSessionCache: coerceBool(cli['warm-session-cache'], merged.warmSessionCache ?? true),
        cleanup: coerceBool(cli.cleanup, merged.cleanup ?? true),
        keepaliveMaxSockets: coerceNumber(cli['max-sockets'], merged.keepaliveMaxSockets || 2048),
        roleRatios: parseRatioMap(cli['role-ratios'] || merged.roleRatios, DEFAULT_ROLE_RATIOS),
        workload: parseRatioMap(cli.workload || merged.workload, DEFAULT_WORKLOAD),
        thresholds: {
            ...DEFAULT_THRESHOLDS,
            ...(merged.thresholds || {}),
        },
    };
}

function printHelp(stream = process.stdout) {
    stream.write(`Goalix mixed load test

Usage:
  node load-tests/mixed-load-test.js --profile=10k-baseline --target=https://staging.example.com
  node load-tests/mixed-load-test.js --profile=20k-target --shard-count=4 --shard-index=0 --target=https://staging.example.com

Profiles:
  ${Object.keys(PROFILES).join(', ')}

Common options:
  --config=load-tests/load-test.config.json
  --tokens-file=load-tests/staging-tokens.json
  --users=10000
  --stages=1000,2500,5000,10000
  --stage-duration-sec=120
  --shard-count=4 --shard-index=0
  --socket-ratio=0.10
  --dry-run=true
`);
}

module.exports = {
    DEFAULT_ROLE_RATIOS,
    DEFAULT_THRESHOLDS,
    DEFAULT_WORKLOAD,
    PROFILES,
    normalizeRatios,
    parseLoadConfig,
    printHelp,
    shardValue,
};
