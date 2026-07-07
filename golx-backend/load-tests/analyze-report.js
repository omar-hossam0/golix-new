const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_REPORT_DIR = path.resolve(__dirname, '../../.tmp/load-tests');

function parseArgs(argv) {
    const values = {};
    for (const argument of argv) {
        if (!argument.startsWith('--')) continue;
        const [key, ...parts] = argument.slice(2).split('=');
        values[key] = parts.length ? parts.join('=') : true;
    }
    return values;
}

async function latestReport(reportDir) {
    const entries = await fs.readdir(reportDir, { withFileTypes: true });
    const reports = await Promise.all(entries
        .filter((entry) => entry.isFile() && /^goalix-mixed-.*\.json$/.test(entry.name))
        .map(async (entry) => {
            const file = path.join(reportDir, entry.name);
            const stat = await fs.stat(file);
            return { file, mtimeMs: stat.mtimeMs };
        }));
    reports.sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (!reports.length) throw new Error(`No mixed load-test reports found in ${reportDir}`);
    return reports[0].file;
}

function percent(value) {
    if (value === null || value === undefined) return '-';
    return `${(value * 100).toFixed(2)}%`;
}

function ms(value) {
    if (value === null || value === undefined) return '-';
    return `${value}ms`;
}

function printHelp() {
    process.stdout.write(`Goalix load-test report analyzer

Usage:
  node load-tests/analyze-report.js
  node load-tests/analyze-report.js --file=.tmp/load-tests/goalix-mixed-abc123-shard-0.json
  node load-tests/analyze-report.js --report-dir=.tmp/load-tests
`);
}

function summarize(report) {
    process.stdout.write(`Report: ${report.kind || 'unknown'} run=${report.runId} profile=${report.config?.profile || '-'} shard=${report.config?.shardIndex ?? 0}/${report.config?.shardCount ?? 1}\n`);
    process.stdout.write(`Overall SLA: ${report.overall?.passed ? 'PASS' : 'FAIL'}\n\n`);

    for (const stage of report.stages || []) {
        const observed = stage.sla?.observed || {};
        process.stdout.write(`Stage ${stage.globalUsers} active (${stage.localUsers} local): ${stage.sla?.passed ? 'PASS' : 'FAIL'}\n`);
        process.stdout.write(`  HTTP: requests=${stage.http.requests} rps=${stage.http.requestsPerSecond} errors=${percent(stage.http.errorRate)} readP95=${ms(stage.http.latencyMs.readP95)} writeP95=${ms(stage.http.latencyMs.writeP95)} p99=${ms(stage.http.latencyMs.p99)} 401/403=${stage.http.unexpectedAuthzErrors}\n`);
        process.stdout.write(`  Socket: connected=${stage.socket.connected}/${stage.socket.attempted} success=${percent(observed.socketConnectSuccessRate)} disconnects=${percent(observed.socketDisconnectRate)} joined=${stage.socket.joined}/${stage.socket.joinAttempted}\n`);
        process.stdout.write(`  Infra: dbPeak=${stage.infrastructure.summary.peakDbConnections} conns/${stage.infrastructure.summary.peakDbActive} active redisPeakOps=${stage.infrastructure.summary.peakRedisOpsPerSec} redisUnavailableSamples=${stage.infrastructure.summary.redisUnavailableSamples}\n`);

        const slowEndpoints = Object.entries(stage.http.endpoints || {})
            .sort((a, b) => (b[1].p95Ms || 0) - (a[1].p95Ms || 0))
            .slice(0, 5);
        if (slowEndpoints.length) {
            process.stdout.write('  Slowest endpoints by p95:\n');
            for (const [endpoint, data] of slowEndpoints) {
                process.stdout.write(`    ${endpoint}: p95=${ms(data.p95Ms)} p99=${ms(data.p99Ms)} req=${data.requests} errors=${data.errors}\n`);
            }
        }
        process.stdout.write('\n');
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || args.h) {
        printHelp();
        return;
    }
    const reportDir = path.resolve(args['report-dir'] || DEFAULT_REPORT_DIR);
    const file = path.resolve(args.file || await latestReport(reportDir));
    const report = JSON.parse(await fs.readFile(file, 'utf8'));
    summarize(report);
}

main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
});
