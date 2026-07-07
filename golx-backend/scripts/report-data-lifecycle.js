require('dotenv').config();

const db = require('../src/infrastructure/database');
const DataLifecycleRepository = require('../src/modules/data-lifecycle/data-lifecycle.repository');
const DataLifecycleService = require('../src/modules/data-lifecycle/data-lifecycle.service');

async function main() {
  const repo = new DataLifecycleRepository(db);
  const service = new DataLifecycleService(repo);
  const status = await service.status();
  console.log(JSON.stringify(status, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
