const { bootstrapAdmin } = require('../src/bootstrap/bootstrap-admin');

exports.seed = async function seed(knex) {
    const result = await bootstrapAdmin(knex);
    console.log(`[seed] Admin ready: ${result.admin.email}`);
};
