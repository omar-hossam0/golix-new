/**
 * Add academy contact fields used by the admin settings page.
 */
exports.up = async function (knex) {
    const hasAddress = await knex.schema.hasColumn('academy_academies', 'address');
    const hasPhone = await knex.schema.hasColumn('academy_academies', 'phone');
    const hasEmail = await knex.schema.hasColumn('academy_academies', 'email');

    await knex.schema.alterTable('academy_academies', (t) => {
        if (!hasAddress) t.text('address');
        if (!hasPhone) t.string('phone', 30);
        if (!hasEmail) t.string('email', 255);
    });
};

exports.down = async function (knex) {
    const hasAddress = await knex.schema.hasColumn('academy_academies', 'address');
    const hasPhone = await knex.schema.hasColumn('academy_academies', 'phone');
    const hasEmail = await knex.schema.hasColumn('academy_academies', 'email');

    await knex.schema.alterTable('academy_academies', (t) => {
        if (hasEmail) t.dropColumn('email');
        if (hasPhone) t.dropColumn('phone');
        if (hasAddress) t.dropColumn('address');
    });
};
