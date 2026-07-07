const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const {
    parseLoadConfig,
    printHelp,
} = require('./load-test-config');

const SYNTHETIC_USER_LIMIT = 10000;
const REPORT_KIND = 'goalix-mixed-load-test';

const ACTIONS = [
    {
        name: 'auth.me',
        category: 'dashboardReads',
        type: 'read',
        roles: ['admin', 'coach', 'player', 'parent'],
        method: 'GET',
        path: '/api/v1/auth/me',
        weight: 8,
    },
    {
        name: 'academy.branches',
        category: 'dashboardReads',
        type: 'read',
        roles: ['admin', 'coach', 'player', 'parent'],
        method: 'GET',
        path: '/api/v1/academy/branches?limit=20',
        weight: 3,
    },
    {
        name: 'player.calendar',
        category: 'dashboardReads',
        type: 'read',
        roles: ['player'],
        method: 'GET',
        path: '/api/v1/player/calendar-events?limit=50',
        weight: 8,
        requiresTokenFile: true,
    },
    {
        name: 'player.trainings',
        category: 'dashboardReads',
        type: 'read',
        roles: ['player'],
        method: 'GET',
        path: '/api/v1/player/trainings?limit=20',
        weight: 4,
        requiresTokenFile: true,
    },
    {
        name: 'parent.children',
        category: 'dashboardReads',
        type: 'read',
        roles: ['parent'],
        method: 'GET',
        path: '/api/v1/parent/children',
        weight: 8,
        requiresTokenFile: true,
    },
    {
        name: 'parent.dashboard',
        category: 'dashboardReads',
        type: 'read',
        roles: ['parent'],
        method: 'GET',
        path: '/api/v1/parent/dashboard',
        weight: 5,
        requiresTokenFile: true,
    },
    {
        name: 'chat.conversations',
        category: 'chatReads',
        type: 'read',
        roles: ['admin', 'coach', 'player', 'parent'],
        method: 'GET',
        path: '/api/v1/chat/conversations',
        weight: 10,
        parse: 'conversations',
    },
    {
        name: 'chat.messages',
        category: 'chatReads',
        type: 'read',
        roles: ['admin', 'coach', 'player', 'parent'],
        kind: 'chatMessages',
        weight: 5,
    },
    {
        name: 'rankings.weekly',
        category: 'rankingsReads',
        type: 'read',
        roles: ['admin', 'coach', 'player', 'parent'],
        method: 'GET',
        path: '/api/v1/rankings/weekly?page=1&limit=50',
        weight: 5,
    },
    {
        name: 'rankings.monthly',
        category: 'rankingsReads',
        type: 'read',
        roles: ['admin', 'coach', 'player', 'parent'],
        method: 'GET',
        path: '/api/v1/rankings/monthly?page=1&limit=50',
        weight: 5,
    },
    {
        name: 'rankings.player',
        category: 'rankingsReads',
        type: 'read',
        roles: ['player'],
        kind: 'playerRankings',
        weight: 2,
        requiresTokenFile: true,
    },
    {
        name: 'notifications.unread',
        category: 'notificationReads',
        type: 'read',
        roles: ['admin', 'coach', 'player', 'parent'],
        method: 'GET',
        path: '/api/v1/notifications/unread-count',
        weight: 5,
    },
    {
        name: 'notifications.list',
        category: 'notificationReads',
        type: 'read',
        roles: ['admin', 'coach', 'player', 'parent'],
        method: 'GET',
        path: '/api/v1/notifications?page=1&limit=20',
        weight: 3,
        parse: 'notifications',
    },
    {
        name: 'coach.permissions',
        category: 'coachReads',
        type: 'read',
        roles: ['coach'],
        method: 'GET',
        path: '/api/v1/coach/permissions',
        weight: 4,
        requiresTokenFile: true,
    },
    {
        name: 'coach.groups',
        category: 'coachReads',
        type: 'read',
        roles: ['coach'],
        method: 'GET',
        path: '/api/v1/coach/groups',
        weight: 3,
        requiresTokenFile: true,
    },
    {
        name: 'coach.players',
        category: 'coachReads',
        type: 'read',
        roles: ['coach'],
        method: 'GET',
        path: '/api/v1/coach/players?page=1&limit=20',
        weight: 3,
        requiresTokenFile: true,
    },
    {
        name: 'coach.calendar',
        category: 'coachReads',
        type: 'read',
        roles: ['coach'],
        method: 'GET',
        path: '/api/v1/coach/calendar-events?limit=50',
        weight: 3,
        requiresTokenFile: true,
    },
    {
        name: 'admin.calendar',
        category: 'adminReads',
        type: 'read',
        roles: ['admin'],
        method: 'GET',
        path: '/api/v1/admin/calendar-events?limit=50',
        weight: 3,
        requiresTokenFile: true,
    },
    {
        name: 'admin.rankings.inputs',
        category: 'adminReads',
        type: 'read',
        roles: ['admin'],
        method: 'GET',
        path: '/api/v1/admin/ranking-system-inputs?page=1&limit=100',
        weight: 3,
        requiresTokenFile: true,
    },
    {
        name: 'admin.matches',
        category: 'adminReads',
        type: 'read',
        roles: ['admin'],
        method: 'GET',
        path: '/api/v1/admin/matches?page=1&limit=20',
        weight: 2,
        requiresTokenFile: true,
    },
    {
        name: 'chat.send',
        category: 'safeWrites',
        type: 'write',
        roles: ['admin', 'coach', 'player', 'parent'],
        kind: 'chatSend',
        weight: 2,
    },
    {
        name: 'chat.readReceipt',
        category: 'safeWrites',
        type: 'write',
        roles: ['admin', 'coach', 'player', 'parent'],
        kind: 'chatRead',
        weight: 2,
    },
    {
        name: 'notifications.readAll',
        category: 'safeWrites',
        type: 'write',
        roles: ['admin', 'coach', 'player', 'parent'],
        method: 'PATCH',
        path: '/api/v1/notifications/read-all',
        body: {},
        weight: 1,
    },
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function syntheticIp(index) {
    const value = index % (256 * 254);
    const thirdOctet = Math.floor(value / 254);
    const fourthOctet = (value % 254) + 1;
    return `198.18.${thirdOctet}.${fourthOctet}`;
}

function safeRunId(value) {
    if (value && !/^[a-f0-9]{12}$/i.test(value)) {
        throw new Error('--run-id must be exactly 12 hexadecimal characters');
    }
    return value ? value.toLowerCase() : crypto.randomBytes(6).toString('hex');
}

function percentile(sortedValues, percentileValue) {
    if (!sortedValues.length) return null;
    const index = Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.ceil((percentileValue / 100) * sortedValues.length) - 1),
    );
    return Math.round(sortedValues[index] * 100) / 100;
}

function parseJson(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function dataArray(payload) {
    const data = payload?.data ?? payload;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.data)) return data.data;
    return [];
}

function extractFirstId(payload) {
    const rows = dataArray(payload);
    return rows.find((row) => row?.id)?.id || null;
}

function createAgent(target, maxSockets) {
    const parsed = new URL(target);
    const Agent = parsed.protocol === 'https:' ? https.Agent : http.Agent;
    return new Agent({
        keepAlive: true,
        keepAliveMsecs: 10000,
        maxSockets,
        maxFreeSockets: Math.min(maxSockets, 512),
    });
}

function resolveTarget(targets, client, actionName) {
    const hash = crypto
        .createHash('sha1')
        .update(`${client.id}:${actionName}`)
        .digest()[0];
    return targets[hash % targets.length];
}

function buildBody(action, client) {
    if (typeof action.body === 'function') return action.body(client);
    if (action.body !== undefined) return action.body;
    return undefined;
}

function requestOnce({
    target,
    client,
    action,
    path: explicitPath,
    method: explicitMethod,
    body: explicitBody,
    timeoutMs,
    agent,
}) {
    return new Promise((resolve) => {
        const requestPath = explicitPath || action.path;
        const method = explicitMethod || action.method || 'GET';
        const body = explicitBody === undefined ? buildBody(action, client) : explicitBody;
        const bodyText = body === undefined || body === null ? null : JSON.stringify(body);
        const url = new URL(requestPath, `${target}/`);
        const transport = url.protocol === 'https:' ? https : http;
        const startedAt = performance.now();
        let settled = false;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve({
                action: action.name,
                endpoint: `${method} ${requestPath.split('?')[0]}`,
                method,
                path: requestPath,
                target,
                type: action.type || (method === 'GET' ? 'read' : 'write'),
                role: client.role,
                latencyMs: performance.now() - startedAt,
                ...result,
            });
        };

        const headers = {
            accept: 'application/json',
            authorization: `Bearer ${client.accessToken}`,
            'user-agent': 'GoalixMixedLoadTest/1.0',
            'x-forwarded-for': client.ip,
        };
        if (bodyText !== null) {
            headers['content-type'] = 'application/json';
            headers['content-length'] = Buffer.byteLength(bodyText);
        }

        const request = transport.request(url, {
            method,
            agent,
            headers,
        }, (response) => {
            let responseBytes = 0;
            let responseText = '';
            response.on('data', (chunk) => {
                responseBytes += chunk.length;
                if (responseText.length < 512 * 1024) responseText += chunk.toString('utf8');
            });
            response.on('end', () => finish({
                status: response.statusCode || null,
                responseBytes,
                responseText,
                error: null,
            }));
            response.on('error', (error) => finish({
                status: response.statusCode || null,
                responseBytes,
                responseText,
                error: error.code || error.message,
            }));
        });

        request.setTimeout(timeoutMs, () => {
            request.destroy(Object.assign(new Error('REQUEST_TIMEOUT'), { code: 'REQUEST_TIMEOUT' }));
        });
        request.on('error', (error) => finish({
            status: null,
            responseBytes: 0,
            responseText: '',
            error: error.code || error.message,
        }));
        if (bodyText !== null) request.write(bodyText);
        request.end();
    });
}

function normalizeTokenEntry(role, entry, index) {
    const token = typeof entry === 'string'
        ? entry
        : entry.accessToken || entry.token || entry.jwt;
    if (!token) return null;
    return {
        id: typeof entry === 'string' ? `${role}-${index}` : entry.userId || entry.id || `${role}-${index}`,
        username: typeof entry === 'string' ? `${role}-${index}` : entry.username || entry.label || `${role}-${index}`,
        role,
        accessToken: token,
        ip: typeof entry === 'string' ? syntheticIp(index) : entry.ip || syntheticIp(index),
        source: 'token-file',
        state: {},
    };
}

async function loadTokenClients(tokenFile) {
    if (!tokenFile) return [];
    const resolved = path.resolve(tokenFile);
    const payload = JSON.parse(await fs.readFile(resolved, 'utf8'));
    const clients = [];
    let index = 0;
    for (const role of ['admin', 'coach', 'player', 'parent']) {
        for (const entry of payload[role] || []) {
            const client = normalizeTokenEntry(role, entry, index);
            index += 1;
            if (client) clients.push(client);
        }
    }
    return clients;
}

function prepareSyntheticClients(clients) {
    return clients.map((client) => ({
        ...client,
        role: 'player',
        source: 'synthetic',
        state: {},
    }));
}

function availableActionsFor(client, workload, options = {}) {
    return ACTIONS
        .filter((action) => action.roles.includes(client.role))
        .filter((action) => !action.requiresTokenFile || client.source === 'token-file')
        .filter((action) => options.includeWrites || action.type !== 'write')
        .map((action) => ({
            ...action,
            effectiveWeight: (workload[action.category] || 0) * (action.weight || 1),
        }))
        .filter((action) => action.effectiveWeight > 0);
}

function weightedPick(actions) {
    const total = actions.reduce((sum, action) => sum + action.effectiveWeight, 0);
    let cursor = Math.random() * total;
    for (const action of actions) {
        cursor -= action.effectiveWeight;
        if (cursor <= 0) return action;
    }
    return actions[actions.length - 1];
}

function selectClientsForStage(clients, count, roleRatios) {
    if (count > clients.length) {
        throw new Error(`Stage needs ${count} local clients but only ${clients.length} are available`);
    }
    const byRole = clients.reduce((acc, client) => {
        acc[client.role] = acc[client.role] || [];
        acc[client.role].push(client);
        return acc;
    }, {});
    const selected = [];
    const selectedIds = new Set();

    for (const [role, ratio] of Object.entries(roleRatios)) {
        const desired = Math.floor(count * ratio);
        const pool = byRole[role] || [];
        for (const client of pool.slice(0, desired)) {
            selected.push(client);
            selectedIds.add(client.id);
        }
    }

    for (const client of clients) {
        if (selected.length >= count) break;
        if (selectedIds.has(client.id)) continue;
        selected.push(client);
        selectedIds.add(client.id);
    }

    return selected.slice(0, count);
}

function recordParsedState(client, action, metric) {
    if (metric.status < 200 || metric.status >= 400 || !metric.responseText) return;
    const payload = parseJson(metric.responseText);
    if (!payload) return;
    if (action.parse === 'conversations') {
        const conversationId = extractFirstId(payload);
        if (conversationId) client.state.conversationId = conversationId;
    }
    if (action.parse === 'notifications') {
        const notificationId = extractFirstId(payload);
        if (notificationId) client.state.notificationId = notificationId;
    }
}

async function performSimpleAction(context, client, action) {
    const target = resolveTarget(context.config.targets, client, action.name);
    const metric = await requestOnce({
        target,
        client,
        action,
        timeoutMs: context.config.timeoutMs,
        agent: context.agents.get(target),
    });
    recordParsedState(client, action, metric);
    context.metrics.push(metric);
    return metric;
}

async function ensureConversationId(context, client) {
    if (client.state.conversationId) return client.state.conversationId;
    const action = ACTIONS.find((candidate) => candidate.name === 'chat.conversations');
    const metric = await performSimpleAction(context, client, action);
    if (metric.status >= 200 && metric.status < 400) return client.state.conversationId || null;
    return null;
}

async function performChatMessagesAction(context, client, action) {
    const conversationId = await ensureConversationId(context, client);
    if (!conversationId) {
        context.skipped[action.name] = (context.skipped[action.name] || 0) + 1;
        return null;
    }
    return performSimpleAction(context, client, {
        ...action,
        method: 'GET',
        path: `/api/v1/chat/conversations/${conversationId}/messages?limit=20`,
    });
}

async function performPlayerRankingsAction(context, client, action) {
    const playerId = client.linkedPlayerId || client.playerId || client.id;
    return performSimpleAction(context, client, {
        ...action,
        method: 'GET',
        path: `/api/v1/rankings/player/${playerId}`,
    });
}

async function performChatSendAction(context, client, action) {
    const conversationId = await ensureConversationId(context, client);
    if (!conversationId) {
        context.skipped[action.name] = (context.skipped[action.name] || 0) + 1;
        return null;
    }
    const target = resolveTarget(context.config.targets, client, action.name);
    const metric = await requestOnce({
        target,
        client,
        action,
        path: `/api/v1/chat/conversations/${conversationId}/messages`,
        method: 'POST',
        body: {
            body: `Load test message ${context.runId} ${Date.now()}`,
            clientMessageId: `${context.runId}:${client.id}:${crypto.randomUUID()}`,
        },
        timeoutMs: context.config.timeoutMs,
        agent: context.agents.get(target),
    });
    context.metrics.push(metric);
    return metric;
}

async function performChatReadAction(context, client, action) {
    const conversationId = await ensureConversationId(context, client);
    if (!conversationId) {
        context.skipped[action.name] = (context.skipped[action.name] || 0) + 1;
        return null;
    }
    const target = resolveTarget(context.config.targets, client, action.name);
    const metric = await requestOnce({
        target,
        client,
        action,
        path: `/api/v1/chat/conversations/${conversationId}/read`,
        method: 'PATCH',
        body: {},
        timeoutMs: context.config.timeoutMs,
        agent: context.agents.get(target),
    });
    context.metrics.push(metric);
    return metric;
}

async function performAction(context, client, action) {
    if (action.kind === 'chatMessages') return performChatMessagesAction(context, client, action);
    if (action.kind === 'playerRankings') return performPlayerRankingsAction(context, client, action);
    if (action.kind === 'chatSend') return performChatSendAction(context, client, action);
    if (action.kind === 'chatRead') return performChatReadAction(context, client, action);
    return performSimpleAction(context, client, action);
}

async function runVirtualUser(context, client, deadlineMs) {
    const actions = availableActionsFor(client, context.config.workload, { includeWrites: true });
    if (!actions.length) {
        context.skipped.noAction = (context.skipped.noAction || 0) + 1;
        return;
    }

    while (performance.now() < deadlineMs) {
        const action = weightedPick(actions);
        await performAction(context, client, action);
        const thinkWindow = Math.max(0, context.config.thinkTimeMaxMs - context.config.thinkTimeMinMs);
        await sleep(context.config.thinkTimeMinMs + Math.floor(Math.random() * (thinkWindow + 1)));
    }
}

function loadSocketClient() {
    try {
        return require('socket.io-client').io;
    } catch (error) {
        throw new Error(
            `socket.io-client is required for socket load tests. Install root dependencies or add it to the backend devDependencies. (${error.message})`,
        );
    }
}

async function connectOneSocket({ io, context, client, target, stats }) {
    stats.attempted += 1;
    return new Promise((resolve) => {
        const socket = io(target, {
            path: context.config.socketPath,
            transports: context.config.socketTransports,
            auth: { token: client.accessToken },
            extraHeaders: {
                authorization: `Bearer ${client.accessToken}`,
                'x-forwarded-for': client.ip,
                'user-agent': 'GoalixMixedLoadTest/1.0',
            },
            timeout: context.config.timeoutMs,
            reconnection: false,
        });
        let settled = false;

        const finish = async (connected) => {
            if (settled) return;
            settled = true;
            if (!connected) {
                socket.close();
                resolve(null);
                return;
            }

            stats.connected += 1;
            socket.onAny((event) => {
                stats.events[event] = (stats.events[event] || 0) + 1;
            });
            socket.on('disconnect', () => {
                stats.disconnected += 1;
            });

            if (context.config.socketJoinChats) {
                const conversationId = await ensureConversationId(context, client);
                if (conversationId) {
                    stats.joinAttempted += 1;
                    socket.timeout(context.config.timeoutMs).emit('chat:join', { conversationId }, (err, ack) => {
                        if (!err && ack?.ok) stats.joined += 1;
                        else stats.joinFailed += 1;
                    });
                } else {
                    stats.joinSkipped += 1;
                }
            }

            resolve(socket);
        };

        socket.once('connect', () => {
            finish(true);
        });
        socket.once('connect_error', (error) => {
            stats.failed += 1;
            const key = error.message || 'connect_error';
            stats.errors[key] = (stats.errors[key] || 0) + 1;
            finish(false);
        });
    });
}

async function connectSockets(context, clients) {
    const stats = {
        attempted: 0,
        connected: 0,
        failed: 0,
        disconnected: 0,
        joinAttempted: 0,
        joined: 0,
        joinFailed: 0,
        joinSkipped: 0,
        errors: {},
        events: {},
    };
    if (context.config.socketDisabled || !clients.length) return { sockets: [], stats };

    const io = loadSocketClient();
    const sockets = [];
    for (let index = 0; index < clients.length; index += context.config.connectBatchSize) {
        const batch = clients.slice(index, index + context.config.connectBatchSize);
        const connected = await Promise.all(batch.map((client) => connectOneSocket({
            io,
            context,
            client,
            target: resolveTarget(context.config.targets, client, 'socket'),
            stats,
        })));
        sockets.push(...connected.filter(Boolean));
        if (index + context.config.connectBatchSize < clients.length) {
            await sleep(context.config.connectBatchDelayMs);
        }
    }
    return { sockets, stats };
}

function closeSockets(sockets) {
    for (const socket of sockets) {
        socket.removeAllListeners('disconnect');
        socket.close();
    }
}

async function createQueueSamplers() {
    try {
        const { Queue } = require('bullmq');
        const env = require('../src/config/env');
        const { isRedisAvailable } = require('../src/infrastructure/redis');
        const redisConnectionFromUrl = require('../src/infrastructure/redis-connection');
        if (!isRedisAvailable()) {
            return {
                sample: async () => ({ unavailable: 'Redis is not connected' }),
                close: async () => null,
            };
        }
        const connection = {
            ...redisConnectionFromUrl(env.REDIS_URL),
            connectTimeout: 1000,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
        };
        const queues = ['rankings', 'notifications', 'payments', 'ai'].map((name) => ({
            name,
            queue: new Queue(`${env.BULLMQ_PREFIX}-${name}`, { connection }),
        }));
        return {
            sample: async () => {
                const counts = {};
                for (const { name, queue } of queues) {
                    counts[name] = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
                }
                return counts;
            },
            close: async () => {
                await Promise.allSettled(queues.map(({ queue }) => queue.close()));
                if (typeof connection.quit === 'function') await connection.quit();
                else if (typeof connection.disconnect === 'function') connection.disconnect();
            },
        };
    } catch (error) {
        return {
            sample: async () => ({ unavailable: error.message }),
            close: async () => null,
        };
    }
}

async function sampleRedis() {
    try {
        const { redis, isRedisAvailable } = require('../src/infrastructure/redis');
        if (!isRedisAvailable() || typeof redis.info !== 'function') {
            return { available: false };
        }
        const [statsInfo, memoryInfo, clientsInfo] = await Promise.all([
            redis.info('stats'),
            redis.info('memory'),
            redis.info('clients'),
        ]);
        const readInfoNumber = (text, key) => {
            const match = text.match(new RegExp(`^${key}:(\\d+)`, 'm'));
            return match ? Number(match[1]) : null;
        };
        return {
            available: true,
            connectedClients: readInfoNumber(clientsInfo, 'connected_clients'),
            instantaneousOpsPerSec: readInfoNumber(statsInfo, 'instantaneous_ops_per_sec'),
            usedMemory: readInfoNumber(memoryInfo, 'used_memory'),
            evictedKeys: readInfoNumber(statsInfo, 'evicted_keys'),
        };
    } catch (error) {
        return { available: false, error: error.message };
    }
}

async function sampleDatabase(db) {
    const result = await db.raw(`
        SELECT
            COUNT(*)::int AS connections,
            COUNT(*) FILTER (WHERE state = 'active')::int AS active,
            COUNT(*) FILTER (WHERE state = 'idle')::int AS idle,
            COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL)::int AS waiting
        FROM pg_stat_activity
        WHERE datname = current_database()
    `);
    return result.rows[0];
}

async function monitorInfrastructure(db, stopSignal) {
    const queueSampler = await createQueueSamplers();
    const samples = [];

    while (!stopSignal.stopped) {
        const sample = { at: new Date().toISOString() };
        try {
            sample.database = await sampleDatabase(db);
        } catch (error) {
            sample.database = { error: error.message };
        }
        sample.redis = await sampleRedis();
        try {
            sample.queues = await queueSampler.sample();
        } catch (error) {
            sample.queues = { error: error.message };
        }
        samples.push(sample);
        await sleep(2000);
    }

    await queueSampler.close();
    return samples;
}

function summarizeInfrastructure(samples) {
    const summary = {
        samples: samples.length,
        peakDbConnections: 0,
        peakDbActive: 0,
        peakDbWaiting: 0,
        peakRedisOpsPerSec: 0,
        redisUnavailableSamples: 0,
        redisEvictedKeysMax: 0,
    };

    for (const sample of samples) {
        if (sample.database && !sample.database.error) {
            summary.peakDbConnections = Math.max(summary.peakDbConnections, Number(sample.database.connections || 0));
            summary.peakDbActive = Math.max(summary.peakDbActive, Number(sample.database.active || 0));
            summary.peakDbWaiting = Math.max(summary.peakDbWaiting, Number(sample.database.waiting || 0));
        }
        if (sample.redis?.available) {
            summary.peakRedisOpsPerSec = Math.max(summary.peakRedisOpsPerSec, Number(sample.redis.instantaneousOpsPerSec || 0));
            summary.redisEvictedKeysMax = Math.max(summary.redisEvictedKeysMax, Number(sample.redis.evictedKeys || 0));
        } else {
            summary.redisUnavailableSamples += 1;
        }
    }

    return summary;
}

function summarizeMetrics(metrics, skipped, durationMs) {
    const completed = metrics.filter((metric) => metric.status !== null);
    const successful = completed.filter((metric) => metric.status >= 200 && metric.status < 400);
    const failed = metrics.filter((metric) => metric.status === null || metric.status < 200 || metric.status >= 400);
    const latencyValues = completed.map((metric) => metric.latencyMs).sort((a, b) => a - b);
    const readLatencies = completed
        .filter((metric) => metric.type === 'read')
        .map((metric) => metric.latencyMs)
        .sort((a, b) => a - b);
    const writeLatencies = completed
        .filter((metric) => metric.type === 'write')
        .map((metric) => metric.latencyMs)
        .sort((a, b) => a - b);
    const statusCounts = {};
    const errorCounts = {};
    const endpoints = {};

    for (const metric of metrics) {
        const statusKey = metric.status === null ? 'network_error' : String(metric.status);
        statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
        if (metric.error) errorCounts[metric.error] = (errorCounts[metric.error] || 0) + 1;

        endpoints[metric.endpoint] = endpoints[metric.endpoint] || {
            requests: 0,
            successful: 0,
            errors: 0,
            read: 0,
            write: 0,
            latencies: [],
        };
        const endpoint = endpoints[metric.endpoint];
        endpoint.requests += 1;
        if (metric.status >= 200 && metric.status < 400) endpoint.successful += 1;
        else endpoint.errors += 1;
        if (metric.type === 'write') endpoint.write += 1;
        else endpoint.read += 1;
        if (metric.status !== null) endpoint.latencies.push(metric.latencyMs);
    }

    for (const endpoint of Object.values(endpoints)) {
        endpoint.latencies.sort((a, b) => a - b);
        endpoint.p50Ms = percentile(endpoint.latencies, 50);
        endpoint.p95Ms = percentile(endpoint.latencies, 95);
        endpoint.p99Ms = percentile(endpoint.latencies, 99);
        delete endpoint.latencies;
    }

    return {
        requests: metrics.length,
        completed: completed.length,
        successful: successful.length,
        errors: failed.length,
        errorRate: metrics.length ? failed.length / metrics.length : 0,
        readRequests: metrics.filter((metric) => metric.type === 'read').length,
        writeRequests: metrics.filter((metric) => metric.type === 'write').length,
        skipped,
        durationMs: Math.round(durationMs * 100) / 100,
        requestsPerSecond: durationMs > 0
            ? Math.round((completed.length / (durationMs / 1000)) * 100) / 100
            : 0,
        latencyMs: {
            p50: percentile(latencyValues, 50),
            p95: percentile(latencyValues, 95),
            p99: percentile(latencyValues, 99),
            readP95: percentile(readLatencies, 95),
            writeP95: percentile(writeLatencies, 95),
        },
        statusCounts,
        errorCounts,
        endpoints,
        unexpectedAuthzErrors: Number(statusCounts['401'] || 0) + Number(statusCounts['403'] || 0),
    };
}

function evaluateSla(summary, socketStats, thresholds) {
    const socketConnectSuccessRate = socketStats.attempted
        ? socketStats.connected / socketStats.attempted
        : 1;
    const socketDisconnectRate = socketStats.connected
        ? socketStats.disconnected / socketStats.connected
        : 0;
    const checks = {
        httpErrorRate: summary.errorRate < thresholds.httpErrorRateMax,
        readP95: summary.latencyMs.readP95 === null || summary.latencyMs.readP95 < thresholds.readP95MsMax,
        writeP95: summary.latencyMs.writeP95 === null || summary.latencyMs.writeP95 < thresholds.writeP95MsMax,
        p99: summary.latencyMs.p99 === null || summary.latencyMs.p99 < thresholds.p99MsMax,
        socketConnectSuccess: socketConnectSuccessRate >= thresholds.socketConnectSuccessRateMin,
        socketDisconnectRate: socketDisconnectRate < thresholds.socketDisconnectRateMax,
        noUnexpected401403: summary.unexpectedAuthzErrors === 0,
    };
    return {
        passed: Object.values(checks).every(Boolean),
        checks,
        observed: {
            httpErrorRate: summary.errorRate,
            readP95Ms: summary.latencyMs.readP95,
            writeP95Ms: summary.latencyMs.writeP95,
            p99Ms: summary.latencyMs.p99,
            socketConnectSuccessRate,
            socketDisconnectRate,
            unexpected401403: summary.unexpectedAuthzErrors,
        },
    };
}

async function runStage({ config, db, runId, clients, stage, agents }) {
    const activeClients = selectClientsForStage(clients, stage.local, config.roleRatios);
    const socketCount = config.socketDisabled
        ? 0
        : Math.min(activeClients.length, Math.floor(activeClients.length * config.socketRatio));
    const socketClients = activeClients.slice(0, socketCount);
    const context = {
        config,
        runId,
        agents,
        metrics: [],
        skipped: {},
    };
    const stopSignal = { stopped: false };
    const infrastructureMonitor = monitorInfrastructure(db, stopSignal);

    const startedAt = performance.now();
    const { sockets, stats: socketStats } = await connectSockets(context, socketClients);
    const deadlineMs = performance.now() + (config.stageDurationSec * 1000);

    if (!config.httpDisabled) {
        await Promise.all(activeClients.map((client) => runVirtualUser(context, client, deadlineMs)));
    } else {
        await sleep(Math.max(0, deadlineMs - performance.now()));
    }

    closeSockets(sockets);
    const durationMs = performance.now() - startedAt;
    stopSignal.stopped = true;
    const infrastructureSamples = await infrastructureMonitor;
    const httpSummary = summarizeMetrics(context.metrics, context.skipped, durationMs);
    const infrastructure = {
        summary: summarizeInfrastructure(infrastructureSamples),
        samples: infrastructureSamples,
    };
    const sla = evaluateSla(httpSummary, socketStats, config.thresholds);

    return {
        globalUsers: stage.global,
        localUsers: stage.local,
        activeRoleCounts: activeClients.reduce((acc, client) => {
            acc[client.role] = (acc[client.role] || 0) + 1;
            return acc;
        }, {}),
        socketUsers: socketCount,
        durationMs: Math.round(durationMs * 100) / 100,
        http: httpSummary,
        socket: socketStats,
        infrastructure,
        sla,
    };
}

function redactConfig(config) {
    return {
        ...config,
        tokenFile: config.tokenFile ? path.basename(config.tokenFile) : null,
    };
}

async function writeReport(config, report) {
    await fs.mkdir(config.reportDir, { recursive: true });
    const file = path.join(config.reportDir, `goalix-mixed-${report.runId}-shard-${config.shardIndex}.json`);
    await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
    return file;
}

async function main() {
    const config = parseLoadConfig();
    if (config.help) {
        printHelp();
        return;
    }

    if (config.dryRun) {
        const preview = {
            kind: REPORT_KIND,
            dryRun: true,
            config: redactConfig(config),
            note: 'Dry run only parses profile/config/sharding; it does not provision users or send traffic.',
        };
        process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
        return;
    }

    const runId = safeRunId(config.runId);
    const tokenClients = await loadTokenClients(config.tokenFile);
    const generatedNeeded = Math.max(0, config.localUsers - tokenClients.length);
    if (generatedNeeded > SYNTHETIC_USER_LIMIT) {
        throw new Error(
            `This shard needs ${generatedNeeded} generated users, but the safe synthetic limit is ${SYNTHETIC_USER_LIMIT}. Increase --shard-count or provide --tokens-file.`,
        );
    }

    const {
        cleanupExactRun,
        closeInfrastructure,
        db,
        identityFingerprint,
        provisionLoadUsers,
    } = require('./data');

    const beforeFingerprint = generatedNeeded ? await identityFingerprint() : null;
    let provisioning = null;
    let cleanup = null;
    let clients = [...tokenClients];
    const agents = new Map(config.targets.map((target) => [target, createAgent(target, config.keepaliveMaxSockets)]));

    try {
        if (generatedNeeded) {
            provisioning = await provisionLoadUsers({
                count: generatedNeeded,
                runId,
                warmCache: config.warmSessionCache,
            });
            clients = clients.concat(prepareSyntheticClients(provisioning.clients));
        }

        clients = clients.slice(0, config.localUsers);
        const report = {
            kind: REPORT_KIND,
            runId,
            runGroup: config.runGroup,
            generatedAt: new Date().toISOString(),
            config: redactConfig(config),
            clients: {
                totalLocal: clients.length,
                tokenFile: tokenClients.length,
                synthetic: generatedNeeded,
                byRole: clients.reduce((acc, client) => {
                    acc[client.role] = (acc[client.role] || 0) + 1;
                    return acc;
                }, {}),
            },
            provisioning: provisioning
                ? {
                    prefix: provisioning.prefix,
                    academy: provisioning.academy,
                    counts: provisioning.counts,
                    sessionCacheWarmed: provisioning.sessionCacheWarmed,
                }
                : null,
            stages: [],
        };

        for (const stage of config.localStages) {
            if (!stage.local) continue;
            process.stdout.write(`Running ${config.profile} stage ${stage.global} active (${stage.local} local shard users)...\n`);
            const stageReport = await runStage({
                config,
                db,
                runId,
                clients,
                stage,
                agents,
            });
            report.stages.push(stageReport);
            process.stdout.write(
                `Stage ${stage.global}: errorRate=${(stageReport.http.errorRate * 100).toFixed(2)}% readP95=${stageReport.http.latencyMs.readP95}ms writeP95=${stageReport.http.latencyMs.writeP95}ms socket=${stageReport.socket.connected}/${stageReport.socket.attempted} SLA=${stageReport.sla.passed ? 'pass' : 'fail'}\n`,
            );
            if (config.cooldownMs) await sleep(config.cooldownMs);
        }

        report.overall = {
            passed: report.stages.every((stage) => stage.sla.passed),
            stages: report.stages.length,
        };

        const reportFile = await writeReport(config, report);
        process.stdout.write(`Report written: ${reportFile}\n`);
    } finally {
        for (const agent of agents.values()) agent.destroy();
        if (config.cleanup && provisioning?.prefix) {
            cleanup = await cleanupExactRun(provisioning.prefix);
            process.stdout.write(`Cleaned load users: ${JSON.stringify(cleanup)}\n`);
            const afterFingerprint = await identityFingerprint();
            if (beforeFingerprint && JSON.stringify(beforeFingerprint) !== JSON.stringify(afterFingerprint)) {
                throw new Error('Pre-existing identity fingerprint changed during load test cleanup');
            }
        }
        await closeInfrastructure();
    }
}

main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
});
