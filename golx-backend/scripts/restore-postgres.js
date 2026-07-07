#!/usr/bin/env node

const path = require('node:path');
const { restorePostgresBackup } = require('../src/shared/postgres-backup');

const RESTORE_CONFIRMATION = 'RESTORE GOALIX';

function printHelp() {
    console.log(`
Usage:
  CONFIRM_RESTORE="RESTORE GOALIX" npm run restore:db -- <dump_file>

Required:
  DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
  CONFIRM_RESTORE=RESTORE GOALIX

Optional:
  BACKUP_DIR=backups

Notes:
  - Requires pg_restore to be installed on the machine running this script.
  - The selected dump must be a PostgreSQL custom-format .dump file.
  - This runs pg_restore --clean --if-exists and replaces current database objects.
`.trim());
}

function fail(message) {
    console.error(`Restore failed: ${message}`);
    process.exit(1);
}

async function main() {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printHelp();
        return;
    }

    if (process.env.CONFIRM_RESTORE !== RESTORE_CONFIRMATION) {
        fail(`Set CONFIRM_RESTORE="${RESTORE_CONFIRMATION}" to confirm this destructive restore.`);
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) fail('DATABASE_URL is required.');

    const input = process.argv[2];
    if (!input) fail('A .dump file name or path is required.');

    const backupDir = path.resolve(
        path.dirname(input) === '.'
            ? (process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'))
            : path.dirname(input),
    );
    const fileName = path.basename(input);
    const result = await restorePostgresBackup({ databaseUrl, backupDir, fileName });

    console.log(`Backup restored: ${result.fileName}`);
    console.log(`Restored at: ${result.restoredAt}`);
}

main().catch((err) => fail(err.message));
