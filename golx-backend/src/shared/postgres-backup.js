const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { createReadStream } = require('node:fs');
const { mkdir, readdir, readFile, stat, unlink, writeFile } = require('node:fs/promises');
const path = require('node:path');

function parseDatabaseUrl(value) {
    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error('DATABASE_URL is not a valid URL.');
    }

    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
        throw new Error('DATABASE_URL must use postgres:// or postgresql://.');
    }

    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!parsed.hostname || !parsed.username || !database) {
        throw new Error('DATABASE_URL must include host, user, and database name.');
    }

    return {
        host: parsed.hostname,
        port: parsed.port || '5432',
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password || ''),
        database,
    };
}

function safeFilePart(value) {
    return String(value || 'database').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '');
}

function runPostgresCommand(command, args, connection) {
    const child = spawn(command, args, {
        env: {
            ...process.env,
            PGPASSWORD: connection.password,
        },
        stdio: ['ignore', 'inherit', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        process.stderr.write(text);
    });

    return new Promise((resolve, reject) => {
        child.on('error', (err) => {
            reject(new Error(`Could not start ${command}. Is PostgreSQL client installed? ${err.message}`));
        });
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} exited with code ${code}.${stderr ? ` ${stderr.trim()}` : ''}`));
        });
    });
}

function runPgDump({ connection, outputFile }) {
    const args = [
        '-h',
        connection.host,
        '-p',
        connection.port,
        '-U',
        connection.user,
        '-d',
        connection.database,
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--file',
        outputFile,
    ];

    return runPostgresCommand('pg_dump', args, connection);
}

function runPgRestore({ connection, inputFile }) {
    const args = [
        '-h',
        connection.host,
        '-p',
        connection.port,
        '-U',
        connection.user,
        '-d',
        connection.database,
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        inputFile,
    ];

    return runPostgresCommand('pg_restore', args, connection);
}

function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(filePath);
        stream.on('error', reject);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function createPostgresBackup({
    databaseUrl,
    backupDir,
    prefix = 'golx',
    label = '',
}) {
    const connection = parseDatabaseUrl(databaseUrl);
    const resolvedBackupDir = path.resolve(backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const labelPart = label ? `${safeFilePart(label)}_` : '';
    const fileName = `${prefix}_${safeFilePart(connection.database)}_${labelPart}${timestamp}.dump`;
    const outputFile = path.join(resolvedBackupDir, fileName);

    await mkdir(resolvedBackupDir, { recursive: true });
    await runPgDump({ connection, outputFile });

    const checksum = await sha256File(outputFile);
    await writeFile(
        `${outputFile}.sha256`,
        `${checksum}  ${fileName}\n`,
        'utf8',
    );
    const fileStat = await stat(outputFile);

    return {
        fileName,
        filePath: outputFile,
        sizeBytes: fileStat.size,
        createdAt: fileStat.mtime.toISOString(),
        checksum,
    };
}

async function checksumForBackup(filePath) {
    try {
        const text = await readFile(`${filePath}.sha256`, 'utf8');
        return text.trim().split(/\s+/)[0] || null;
    } catch {
        return null;
    }
}

async function listPostgresBackups(backupDir) {
    const resolvedBackupDir = path.resolve(backupDir);
    let entries = [];
    try {
        entries = await readdir(resolvedBackupDir, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }

    const backups = await Promise.all(
        entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.dump'))
            .map(async (entry) => {
                const filePath = path.join(resolvedBackupDir, entry.name);
                const fileStat = await stat(filePath);
                return {
                    fileName: entry.name,
                    sizeBytes: fileStat.size,
                    createdAt: fileStat.mtime.toISOString(),
                    checksum: await checksumForBackup(filePath),
                };
            }),
    );

    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function resolveBackupFile(backupDir, fileName) {
    if (path.basename(fileName) !== fileName || !fileName.endsWith('.dump')) {
        throw new Error('Invalid backup file name.');
    }

    const resolvedBackupDir = path.resolve(backupDir);
    const filePath = path.resolve(resolvedBackupDir, fileName);
    if (!filePath.startsWith(`${resolvedBackupDir}${path.sep}`)) {
        throw new Error('Invalid backup file path.');
    }

    await stat(filePath);
    return filePath;
}

async function restorePostgresBackup({ databaseUrl, backupDir, fileName }) {
    const connection = parseDatabaseUrl(databaseUrl);
    const inputFile = await resolveBackupFile(backupDir, fileName);
    await runPgRestore({ connection, inputFile });
    return { fileName, restoredAt: new Date().toISOString() };
}

async function prunePostgresBackups(backupDir, retentionDays) {
    if (!retentionDays || retentionDays < 1) return { deleted: [] };
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const backups = await listPostgresBackups(backupDir);
    const deleted = [];

    for (const backup of backups) {
        if (new Date(backup.createdAt).getTime() >= cutoff) continue;
        const filePath = await resolveBackupFile(backupDir, backup.fileName);
        await unlink(filePath);
        try {
            await unlink(`${filePath}.sha256`);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        deleted.push(backup.fileName);
    }

    return { deleted };
}

module.exports = {
    createPostgresBackup,
    listPostgresBackups,
    parseDatabaseUrl,
    prunePostgresBackups,
    restorePostgresBackup,
};
