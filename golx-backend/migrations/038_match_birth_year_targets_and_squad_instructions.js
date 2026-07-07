exports.up = async function up(knex) {
    const hasEventBirthYears = await knex.schema.hasTable('calendar_event_birth_years');
    if (!hasEventBirthYears) {
        await knex.schema.createTable('calendar_event_birth_years', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('event_id').notNullable().references('id').inTable('calendar_events').onDelete('CASCADE');
            t.uuid('birth_year_id').notNullable().references('id').inTable('academy_birth_years').onDelete('CASCADE');
            t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            t.unique(['event_id', 'birth_year_id']);
            t.index('event_id');
            t.index('birth_year_id');
        });
    }

    const friendlyHasBirthYear = await knex.schema.hasColumn('friendly_match_requests', 'birth_year_id');
    const squadHasInstruction = await knex.schema.hasColumn('match_squads', 'player_instruction');

    await knex.schema.alterTable('friendly_match_requests', (t) => {
        if (!friendlyHasBirthYear) {
            t.uuid('birth_year_id').references('id').inTable('academy_birth_years').onDelete('SET NULL');
            t.index('birth_year_id');
        }
    });

    await knex.schema.alterTable('match_squads', (t) => {
        if (!squadHasInstruction) {
            t.text('player_instruction');
        }
    });
};

exports.down = async function down(knex) {
    const friendlyHasBirthYear = await knex.schema.hasColumn('friendly_match_requests', 'birth_year_id');
    const squadHasInstruction = await knex.schema.hasColumn('match_squads', 'player_instruction');

    if (friendlyHasBirthYear) {
        await knex.schema.alterTable('friendly_match_requests', (t) => {
            t.dropColumn('birth_year_id');
        });
    }

    if (squadHasInstruction) {
        await knex.schema.alterTable('match_squads', (t) => {
            t.dropColumn('player_instruction');
        });
    }

    await knex.schema.dropTableIfExists('calendar_event_birth_years');
};
