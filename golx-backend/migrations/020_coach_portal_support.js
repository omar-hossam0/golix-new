/**
 * Coach portal support columns used by schedule, attendance, and evaluations.
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('attendance_sessions', (t) => {
        t.time('start_time');
        t.time('end_time');
        t.string('location', 255);
        t.string('session_type', 30).notNullable().defaultTo('training');
        t.index('coach_id');
        t.index('session_type');
    });

    await knex.schema.alterTable('attendance_marks', (t) => {
        t.text('notes');
    });

    await knex.schema.alterTable('evaluation_coach_ratings', (t) => {
        t.decimal('technical_score', 5, 2);
        t.decimal('tactical_score', 5, 2);
        t.decimal('physical_score', 5, 2);
        t.decimal('mental_score', 5, 2);
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable('evaluation_coach_ratings', (t) => {
        t.dropColumn('mental_score');
        t.dropColumn('physical_score');
        t.dropColumn('tactical_score');
        t.dropColumn('technical_score');
    });

    await knex.schema.alterTable('attendance_marks', (t) => {
        t.dropColumn('notes');
    });

    await knex.schema.alterTable('attendance_sessions', (t) => {
        t.dropIndex('session_type');
        t.dropIndex('coach_id');
        t.dropColumn('session_type');
        t.dropColumn('location');
        t.dropColumn('end_time');
        t.dropColumn('start_time');
    });
};
