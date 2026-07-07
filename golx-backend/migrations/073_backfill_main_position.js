exports.up = async function up(knex) {
    const hasValues = await knex.schema.hasTable('player_custom_values');
    if (!hasValues) return;

    await knex.raw(`
        WITH custom_positions AS (
            SELECT DISTINCT ON (pcv.player_id)
                pcv.player_id,
                COALESCE(
                    cfo.label,
                    cfo_text.label,
                    pcv.value_text,
                    pcv.value_long_text,
                    json_options.labels
                ) AS position
            FROM player_custom_values pcv
            JOIN custom_fields cf ON pcv.field_id = cf.id
            LEFT JOIN custom_field_options cfo ON cfo.id = pcv.value_option_id
            LEFT JOIN custom_field_options cfo_text
                ON cfo_text.field_id = cf.id
                AND cfo_text.id::text = pcv.value_text
            LEFT JOIN LATERAL (
                SELECT string_agg(
                    COALESCE(cfo_json.label, option_id),
                    ', '
                    ORDER BY option_id
                ) AS labels
                FROM jsonb_array_elements_text(
                    CASE
                        WHEN jsonb_typeof(pcv.value_json) = 'array' THEN pcv.value_json
                        WHEN jsonb_typeof(pcv.value_json) = 'string'
                            THEN jsonb_build_array(pcv.value_json #>> '{}')
                        ELSE '[]'::jsonb
                    END
                ) AS option_values(option_id)
                LEFT JOIN custom_field_options cfo_json
                    ON cfo_json.field_id = cf.id
                    AND cfo_json.id::text = option_values.option_id
            ) json_options ON true
            WHERE regexp_replace(
                lower(cf.key),
                '[^a-z0-9]+',
                '_',
                'g'
            ) = 'main_position'
            ORDER BY pcv.player_id, pcv.updated_at DESC NULLS LAST
        )
        UPDATE player_profiles AS pp
        SET
            position = custom_positions.position,
            updated_at = NOW()
        FROM custom_positions
        WHERE custom_positions.player_id = pp.id
          AND custom_positions.position IS NOT NULL
          AND BTRIM(custom_positions.position) <> ''
          AND pp.position IS DISTINCT FROM custom_positions.position
    `);
};

exports.down = async function down() {
    // Main Position remains the canonical profile position after backfill.
};
