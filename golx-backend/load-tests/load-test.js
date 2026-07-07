const fs = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const crypto = require('node:crypto');

const {
    cleanupExactRun,
    closeInfrastructure,
    db,
    identityFingerprint,
    provisionLoadUsers,
} = require('./data');

const ENDPOINTS = [
    ...Array(8).fill('/api/v1/auth/me'),
    ...Array(5).fill('/api/v1/notifications/unread-count'),
    ...Array(4).fill('/api/v1/academy/branches?limit=20'),
    ...Array(3).fill('/api/v1/chat/conversations'),
];

function parseArgs(argv) {
    const values = {};
    for (const argument of argv) {
        if (!argument.startsWith('--')) continue;
        const [key, ...parts] = argument.slice(2).split('=');
        values[key] = parts.length ? parts.join('=') : true;
    }

    const users = Number(values.users || 10000);
    const stages = String(values.stages || '100,500,1000,2500,5000,10000')
        .split(',')
        .map((value) => Number(value.trim()))
        .filter(Number.isFinite);
    const targets = String(values.targets || values.target || 'http://127.0.0.1:3000')
        .split(',')
        .map((value) => value.trim().replace(/\/$/, ''))
        .filter(Boolean);

    if (!Number.isInteger(users) || users < 1 || users > 10000) {
        throw new Error('--users must be an integer from 1 to 10000');
    }
    if (!stages.length || stages.some((stage) => !Number.isInteger(stage) || stage < 1 || stage > users)) {
        throw new Error('--stages must contain integers no larger than --users');
    }
    if (!targets.length) throw new Error('At least one target URL is required');

    return {
        users,
        stages,
        targets,
        timeoutMs: Number(values['timeout-ms'] || 30000),
        cooldownMs: Number(values['cooldown-ms'] || 2000),
        connectionMode: String(values['connection-mode'] || 'preconnected'),
        connectBatchSize: Number(values['connect-batch-size'] || 100),
        connectBatchDelayMs: Number(values['connect-batch-delay-ms'] || 25),
        warmSessionCache: values['warm-session-cache'] !== 'false',
    };
}

function percentile(sortedValues, percentileValue) {
    if (!sortedValues.length) return null;
    const index = Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.ceil((percentileValue / 100) * sortedValues.length) - 1),
    );
    return Math.round(sortedValues[index] * 100) / 100;
}

function summarizeMetrics(metrics, durationMs, dbActivity) {
    const completed = metrics.filter((metric) => metric.status !== null);
    const successful = completed.filter((metric) => metric.status >= 200 && metric.status < 400);
    const latencies = completed.map((metric) => metric.latencyMs).sort((a, b) => a - b);
    const statusCounts = {};
    const errorCounts = {};
    const endpoints = {};

    for (const metric of metrics) {
        const statusKey = metric.status === null ? 'network_error' : String(metric.status);
        statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
        if (metric.error) errorCounts[metric.error] = (errorCounts[metric.error] || 0) + 1;

        if (!endpoints[metric.endpoint]) {
            endpoints[metric.endpoint] = {
                requests: 0,
                successful: 0,
                errors: 0,
                latencies: [],
            };
        }
        const endpoint = endpoints[metric.endpoint];
        endpoint.requests += 1;
        if (metric.status >= 200 && metric.status < 400) endpoint.successful += 1;
        else endpoint.errors += 1;
        if (metric.status !== null) endpoint.latencies.push(metric.latencyMs);
    }

    for (const endpoint of Object.values(endpoints)) {
        endpoint.latencies.sort((a, b) => a - b);
        endpoint.p50Ms = percentile(endpoint.latencies, 50);
        endpoint.p95Ms = percentile(endpoint.latencies, 95);
        endpoint.p99Ms = percentile(endpoint.latencies, 99);
        delete endpoint.latencies;
    }

    const total = metrics.length;
    const errorCount = total - successful.length;
    return {
        requests: total,
        completed: completed.length,
        successful: successful.length,
        errors: errorCount,
        errorRate: total ? errorCount / total : 0,
        rateLimited: Number(statusCounts['429'] || 0),
        durationMs: Math.round(durationMs * 100) / 100,
        requestsPerSecond: Math.round((completed.length / (durationMs / 1000)) * 100) / 100,
        latencyMs: {
            min: latencies.length ? Math.round(latencies[0] * 100) / 100 : null,
            p50: percentile(latencies, 50),
            p95: percentile(latencies, 95),
            p99: percentile(latencies, 99),
            max: latencies.length ? Math.round(latencies.at(-1) * 100) / 100 : null,
        },
        responseBytes: completed.reduce((sum, metric) => sum + metric.responseBytes, 0),
        statusCounts,
        errorCounts,
        endpoints,
        dbActivity,
        thresholds: {
            errorRateUnder1Percent: total ? errorCount / total < 0.01 : false,
            p95Under2Seconds: latencies.length ? percentile(latencies, 95) < 2000 : false,
            noRateLimiting: !statusCounts['429'],
        },
    };
}

function requestOnce({ target, client, endpoint, timeoutMs, agent }) {
    return new Promise((resolve) => {
        const url = new URL(endpoint, `${target}/`);
        const transport = url.protocol === 'https:' ? https : http;
        const startedAt = performance.now();
        let settled = false;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve({
                endpoint,
                latencyMs: performance.now() - startedAt,
                ...result,
            });
        };

        const request = transport.request(url, {
            method: 'GET',
            agent,
            localAddress: client.localAddress,
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${client.accessToken}`,
                'user-agent': 'GoalixLoadTest/1.0',
                'x-forwarded-for': client.ip,
            },
        }, (response) => {
            let responseBytes = 0;
            response.on('data', (chunk) => {
                responseBytes += chunk.length;
            });
            response.on('end', () => finish({
                status: response.statusCode || null,
                responseBytes,
                error: null,
            }));
            response.on('error', (error) => finish({
                status: response.statusCode || null,
                responseBytes,
                error: error.code || error.message,
            }));
        });

        request.setTimeout(timeoutMs, () => {
            request.destroy(Object.assign(new Error('REQUEST_TIMEOUT'), { code: 'REQUEST_TIMEOUT' }));
        });
        request.on('error', (error) => finish({
            status: null,
            responseBytes: 0,
            error: error.code || error.message,
        }));
        request.end();
    });
}

async function monitorDatabase(stopSignal) {
    const activity = {
        samples: 0,
        peakConnections: 0,
        peakActive: 0,
        peakIdle: 0,
    };

    while (!stopSignal.stopped) {
        try {
            const result = await db.raw(`
                SELECT
                    COUNT(*)::int AS connections,
                    COUNT(*) FILTER (WHERE state = 'active')::int AS active,
                    COUNT(*) FILTER (WHERE state = 'idle')::int AS idle
                FROM pg_stat_activity
                WHERE datname = current_database()
            `);
            const row = result.rows[0];
            activity.samples += 1;
            activity.peakConnections = Math.max(activity.peakConnections, Number(row.connections));
            activity.peakActive = Math.max(activity.peakActive, Number(row.active));
            activity.peakIdle = Math.max(activity.peakIdle, Number(row.idle));
        } catch (error) {
            activity.monitorError = error.message;
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return activity;
}

async function runAgentStage({ target, clients, concurrency, timeoutMs, agent }) {
    const gate = {};
    gate.promise = new Promise((resolve) => {
        gate.release = resolve;
    });
    const stopSignal = { stopped: false };
    const dbMonitor = monitorDatabase(stopSignal);

    const requests = clients.slice(0, concurrency).map((client, index) => (
        gate.promise.then(() => requestOnce({
            target,
            client,
            endpoint: ENDPOINTS[index % ENDPOINTS.length],
            timeoutMs,
            agent,
        }))
    ));

    await new Promise((resolve) => setTimeout(resolve, 250));
    const startedAt = performance.now();
    gate.release();
    const metrics = await Promise.all(requests);
    const durationMs = performance.now() - startedAt;
    stopSignal.stopped = true;
    const dbActivity = await dbMonitor;

    return summarizeMetrics(metrics, durationMs, dbActivity);
}

function openRawSocket(targetUrl, client, connectTimeoutMs) {
    return new Promise((resolve) => {
        const socket = net.createConnection({
            host: targetUrl.hostname,
            port: Number(targetUrl.port || 80),
            localAddress: client.localAddress,
        });
        let settled = false;
        const timer = setTimeout(() => {
            socket.destroy();
            if (!settled) {
                settled = true;
                resolve({ socket: null, error: 'CONNECT_TIMEOUT' });
            }
        }, connectTimeoutMs);

        socket.setNoDelay(true);
        socket.once('connect', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ socket, error: null });
        });
        socket.once('error', (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ socket: null, error: error.code || error.message });
        });
    });
}

async function preconnectSockets({
    target,
    clients,
    concurrency,
    connectBatchSize,
    connectBatchDelayMs,
}) {
    const targetUrl = new URL(target);
    if (targetUrl.protocol !== 'http:') {
        throw new Error('Preconnected mode currently supports local HTTP targets only');
    }

    const connections = new Array(concurrency);
    const connectionPromises = [];
    for (let start = 0; start < concurrency; start += connectBatchSize) {
        const end = Math.min(concurrency, start + connectBatchSize);
        for (let index = start; index < end; index += 1) {
            const promise = openRawSocket(targetUrl, clients[index], 15000)
                .then((connection) => {
                    connections[index] = connection;
                });
            connectionPromises.push(promise);
        }
        if (end < concurrency && connectBatchDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, connectBatchDelayMs));
        }
    }
    await Promise.all(connectionPromises);
    return { targetUrl, connections };
}

function requestOverSocket({
    socket,
    connectionError,
    targetUrl,
    client,
    endpoint,
    timeoutMs,
}) {
    if (!socket) {
        return Promise.resolve({
            endpoint,
            latencyMs: 0,
            status: null,
            responseBytes: 0,
            error: `PRECONNECT_${connectionError || 'FAILED'}`,
        });
    }

    return new Promise((resolve) => {
        const startedAt = performance.now();
        let responseBytes = 0;
        let status = null;
        let headerBuffer = Buffer.alloc(0);
        let settled = false;
        const timer = setTimeout(() => {
            socket.destroy();
            finish('REQUEST_TIMEOUT');
        }, timeoutMs);

        const finish = (error = null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({
                endpoint,
                latencyMs: performance.now() - startedAt,
                status,
                responseBytes,
                error,
            });
        };

        socket.on('data', (chunk) => {
            responseBytes += chunk.length;
            if (status === null && headerBuffer.length < 8192) {
                headerBuffer = Buffer.concat([headerBuffer, chunk]);
                const firstLineEnd = headerBuffer.indexOf('\r\n');
                if (firstLineEnd !== -1) {
                    const firstLine = headerBuffer.subarray(0, firstLineEnd).toString('ascii');
                    const match = /^HTTP\/1\.[01]\s+(\d{3})/.exec(firstLine);
                    if (match) status = Number(match[1]);
                }
            }
        });
        socket.once('end', () => finish());
        socket.once('close', () => finish());
        socket.once('error', (error) => finish(error.code || error.message));

        const requestTarget = `${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        socket.write([
            `GET ${requestTarget} HTTP/1.1`,
            `Host: ${targetUrl.host}`,
            'Accept: application/json',
            `Authorization: Bearer ${client.accessToken}`,
            'User-Agent: GoalixLoadTest/1.0',
            `X-Forwarded-For: ${client.ip}`,
            'Connection: close',
            '',
            '',
        ].join('\r\n'));
    });
}

async function runPreconnectedStage({
    target,
    clients,
    concurrency,
    timeoutMs,
    connectBatchSize,
    connectBatchDelayMs,
}) {
    const { targetUrl, connections } = await preconnectSockets({
        target,
        clients,
        concurrency,
        connectBatchSize,
        connectBatchDelayMs,
    });
    const connected = connections.filter((connection) => connection?.socket).length;
    const stopSignal = { stopped: false };
    const dbMonitor = monitorDatabase(stopSignal);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const startedAt = performance.now();
    const metrics = await Promise.all(connections.map((connection, index) => requestOverSocket({
        socket: connection?.socket,
        connectionError: connection?.error,
        targetUrl,
        client: clients[index],
        endpoint: ENDPOINTS[index % ENDPOINTS.length],
        timeoutMs,
    })));
    const durationMs = performance.now() - startedAt;
    stopSignal.stopped = true;
    const dbActivity = await dbMonitor;
    const summary = summarizeMetrics(metrics, durationMs, dbActivity);
    summary.preconnectedSockets = connected;
    summary.preconnectFailures = concurrency - connected;
    return summary;
}

async function databaseStats() {
    const result = await db.raw(`
        SELECT
            numbackends,
            xact_commit,
            xact_rollback,
            blks_read,
            blks_hit,
            tup_returned,
            tup_fetched,
            tup_inserted,
            tup_updated,
            tup_deleted
        FROM pg_stat_database
        WHERE datname = current_database()
    `);
    return result.rows[0];
}

function printStage(target, concurrency, summary) {
    const latency = summary.latencyMs;
    console.log(
        [
            `[${target}] ${concurrency.toLocaleString()} concurrent`,
            `ok=${summary.successful.toLocaleString()}/${summary.requests.toLocaleString()}`,
            `errors=${(summary.errorRate * 100).toFixed(2)}%`,
            `rps=${summary.requestsPerSecond}`,
            `p95=${latency.p95 ?? '-'}ms`,
            `p99=${latency.p99 ?? '-'}ms`,
            `max=${latency.max ?? '-'}ms`,
            `db=${summary.dbActivity.peakConnections} connections`,
            summary.preconnectedSockets !== undefined
                ? `sockets=${summary.preconnectedSockets.toLocaleString()}/${summary.requests.toLocaleString()}`
                : null,
        ].filter(Boolean).join(' | '),
    );
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const runId = crypto.randomBytes(6).toString('hex');
    const baselineFingerprint = await identityFingerprint();
    const report = {
        runId,
        startedAt: new Date().toISOString(),
        options,
        environment: {
            hostname: os.hostname(),
            platform: `${os.platform()} ${os.release()}`,
            cpu: os.cpus()[0]?.model,
            logicalCpus: os.cpus().length,
            totalMemoryBytes: os.totalmem(),
            freeMemoryBytesAtStart: os.freemem(),
            nodeVersion: process.version,
            dbPoolMax: Number(process.env.DB_POOL_MAX || 20),
        },
        baselineFingerprint,
        targets: [],
    };

    let provisioned;
    let failure;
    try {
        console.log(`Provisioning ${options.users.toLocaleString()} isolated load-test users...`);
        provisioned = await provisionLoadUsers({
            count: options.users,
            runId,
            warmCache: options.warmSessionCache,
        });
        report.provisioned = {
            prefix: provisioned.prefix,
            academy: provisioned.academy,
            counts: provisioned.counts,
            sessionCacheWarmed: provisioned.sessionCacheWarmed,
        };
        report.databaseStatsBefore = await databaseStats();

        for (const target of options.targets) {
            const targetResult = { target, stages: [] };
            report.targets.push(targetResult);
            const targetUrl = new URL(target);
            const Agent = targetUrl.protocol === 'https:' ? https.Agent : http.Agent;
            const agent = options.connectionMode === 'agent' ? new Agent({
                keepAlive: true,
                maxSockets: options.users,
                maxFreeSockets: options.users,
            }) : null;

            try {
                for (const concurrency of options.stages) {
                    const summary = options.connectionMode === 'agent'
                        ? await runAgentStage({
                            target,
                            clients: provisioned.clients,
                            concurrency,
                            timeoutMs: options.timeoutMs,
                            agent,
                        })
                        : await runPreconnectedStage({
                            target,
                            clients: provisioned.clients,
                            concurrency,
                            timeoutMs: options.timeoutMs,
                            connectBatchSize: options.connectBatchSize,
                            connectBatchDelayMs: options.connectBatchDelayMs,
                        });
                    targetResult.stages.push({ concurrency, ...summary });
                    printStage(target, concurrency, summary);
                    if (options.cooldownMs > 0) {
                        await new Promise((resolve) => setTimeout(resolve, options.cooldownMs));
                    }
                }
            } finally {
                agent?.destroy();
            }
        }

        report.databaseStatsAfter = await databaseStats();
    } catch (error) {
        failure = error;
        report.failure = {
            message: error.message,
            stack: error.stack,
        };
    } finally {
        if (provisioned?.prefix) {
            try {
                report.cleanup = await cleanupExactRun(provisioned.prefix);
            } catch (cleanupError) {
                report.cleanup = { error: cleanupError.message };
                failure ||= cleanupError;
            }
        }

        report.fingerprintAfterCleanup = await identityFingerprint();
        report.originalUsersUnchanged = (
            report.fingerprintAfterCleanup.authUsers.count === baselineFingerprint.authUsers.count
            && report.fingerprintAfterCleanup.authUsers.hash === baselineFingerprint.authUsers.hash
            && report.fingerprintAfterCleanup.iamUsers.count === baselineFingerprint.iamUsers.count
            && report.fingerprintAfterCleanup.iamUsers.hash === baselineFingerprint.iamUsers.hash
        );
        report.finishedAt = new Date().toISOString();
        report.environment.freeMemoryBytesAtEnd = os.freemem();

        const outputDirectory = path.resolve(__dirname, '../../.tmp/load-tests');
        await fs.mkdir(outputDirectory, { recursive: true });
        const outputPath = path.join(outputDirectory, `goalix-load-${runId}.json`);
        await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        console.log(`Report: ${outputPath}`);
        console.log(`Cleanup: ${JSON.stringify(report.cleanup)}`);
        console.log(`Original users unchanged: ${report.originalUsersUnchanged}`);
        await closeInfrastructure();
    }

    if (!report.originalUsersUnchanged) {
        throw new Error('Original-user fingerprint changed during the load test');
    }
    if (failure) throw failure;
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
