require('dotenv').config();

const db = require('../src/infrastructure/database');
const DataLifecycleRepository = require('../src/modules/data-lifecycle/data-lifecycle.repository');
const DataLifecycleService = require('../src/modules/data-lifecycle/data-lifecycle.service');

async function main() {
  const dryRun =
    process.argv.includes('--dry-run') ||
    process.argv.includes('--dryRun') ||
    process.env.DATA_LIFECYCLE_DRY_RUN === 'true' ||
    process.env.npm_config_dry_run === 'true';
  const repo = new DataLifecycleRepository(db);
  const service = new DataLifecycleService(repo);
  const result = await service.runLifecycle({ dryRun });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
