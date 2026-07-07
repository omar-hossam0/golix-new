#!/usr/bin/env node

const path = require('node:path');
const { createPostgresBackup } = require('../src/shared/postgres-backup');

function printHelp() {
    console.log(`
Usage:
  npm run backup:db

Required:
  DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE

Optional:
  BACKUP_DIR=backups

Notes:
  - Requires pg_dump to be installed on the machine running this script.
  - The database password is passed through PGPASSWORD, not as a command argument.
  - Output is a PostgreSQL custom-format dump plus a .sha256 checksum file.
`.trim());
}

function fail(message) {
    console.error(`Backup failed: ${message}`);
    process.exit(1);
}

async function main() {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printHelp();
        return;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        fail('DATABASE_URL is required.');
    }

    const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
    const backup = await createPostgresBackup({ databaseUrl, backupDir });

    console.log(`Backup written: ${backup.filePath}`);
    console.log(`SHA256: ${backup.checksum}`);
}

main().catch((err) => fail(err.message));
