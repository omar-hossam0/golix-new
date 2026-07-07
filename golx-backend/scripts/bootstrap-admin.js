#!/usr/bin/env node

require('dotenv').config();

const knexFactory = require('knex');
const knexConfig = require('../knexfile');
const { bootstrapAdmin } = require('../src/bootstrap/bootstrap-admin');

function printHelp() {
    console.log(`
Usage:
  BOOTSTRAP_ADMIN_PASSWORD="StrongPass#123" npm run bootstrap:admin

Optional:
  BOOTSTRAP_ADMIN_EMAIL=owner@example.com
  BOOTSTRAP_ADMIN_USERNAME=admin
  BOOTSTRAP_ADMIN_FULL_NAME="Academy Owner"
  BOOTSTRAP_ACADEMY_NAME="Goalix Academy"
  BOOTSTRAP_ACADEMY_EMAIL=info@example.com
  BOOTSTRAP_ACADEMY_PHONE=+201000000000
  BOOTSTRAP_ACADEMY_ADDRESS="Academy address"

Safety:
  - Refuses to run if another active admin exists.
  - Set BOOTSTRAP_ADMIN_ALLOW_EXISTING=true only for intentional recovery/update.
  - The created admin must set up MFA on first admin login before full dashboard access.
`.trim());
}

async function main() {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printHelp();
        return;
    }

    const environment = process.env.NODE_ENV || 'development';
    const db = knexFactory(knexConfig[environment] || knexConfig.development);

    try {
        const result = await bootstrapAdmin(db);
        console.log('[bootstrap] Academy ready:', result.academy.name, `(${result.academy.id})`);
        console.log('[bootstrap] Admin ready:', result.admin.email, result.admin.username ? `(${result.admin.username})` : '');
        console.log('[bootstrap] MFA setup required:', result.admin.mfaSetupRequired ? 'yes' : 'no');
        console.log('[bootstrap] Next step: sign in at /admin-login, then complete MFA setup in Settings.');
    } finally {
        await db.destroy();
    }
}

main().catch((err) => {
    console.error(`[bootstrap] Failed: ${err.message}`);
    process.exit(1);
});
