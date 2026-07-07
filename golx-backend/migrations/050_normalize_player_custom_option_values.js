exports.up = async function up(knex) {
  const hasValues = await knex.schema.hasTable("player_custom_values");
  const hasOptions = await knex.schema.hasTable("custom_field_options");
  if (!hasValues || !hasOptions) return;

  await knex.raw(`
    UPDATE player_custom_values AS pcv
    SET
      value_option_id = cfo.id,
      value_text = NULL,
      updated_at = NOW()
    FROM custom_field_options AS cfo
    WHERE pcv.value_option_id IS NULL
      AND pcv.value_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND cfo.id = pcv.value_text::uuid
      AND cfo.field_id = pcv.field_id
  `);

  await knex.raw(`
    DELETE FROM player_group_assignments AS pga
    USING (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY player_id, group_id
          ORDER BY joined_at DESC NULLS LAST, id DESC
        ) AS row_number
      FROM player_group_assignments
      WHERE left_at IS NULL
    ) AS duplicates
    WHERE pga.id = duplicates.id
      AND duplicates.row_number > 1
  `);
};

exports.down = async function down() {
  // Data normalization is intentionally not reversed.
};
