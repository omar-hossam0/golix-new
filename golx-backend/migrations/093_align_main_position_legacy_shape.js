const MAIN_POSITION_OPTIONS = [
  { value: "Striker", label: "Striker", aliases: ["ST", "CF"] },
  { value: "LW", label: "LW", aliases: ["LM", "Left Winger", "Left Midfielder"] },
  { value: "RW", label: "RW", aliases: ["RM", "Right Winger", "Right Midfielder"] },
  { value: "LB", label: "LB", aliases: ["Left Back"] },
  { value: "RB", label: "RB", aliases: ["Right Back"] },
  { value: "CM", label: "CM", aliases: ["CDM", "Central Midfielder", "Defensive Midfielder"] },
  { value: "CAM", label: "CAM", aliases: ["Attacking Midfielder"] },
  { value: "CB", label: "CB", aliases: ["Center Back"] },
  { value: "GK", label: "GK", aliases: ["Goalkeeper"] },
];

async function replaceStoredOptionId(trx, fieldId, fromId, toId) {
  await trx("player_custom_values")
    .where({ field_id: fieldId, value_option_id: fromId })
    .update({
      value_option_id: toId,
      updated_at: trx.fn.now(),
    });

  await trx.raw(
    `
      UPDATE player_custom_values
      SET
        value_json = (
          SELECT jsonb_agg(
            to_jsonb(CASE WHEN option_id = ? THEN ? ELSE option_id END)
          )
          FROM jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(value_json) = 'array' THEN value_json
              WHEN jsonb_typeof(value_json) = 'string' THEN jsonb_build_array(value_json #>> '{}')
              ELSE '[]'::jsonb
            END
          ) AS selected(option_id)
        ),
        updated_at = NOW()
      WHERE field_id = ?
        AND value_json IS NOT NULL
        AND (
          (jsonb_typeof(value_json) = 'array' AND value_json \\? ?)
          OR (jsonb_typeof(value_json) = 'string' AND value_json #>> '{}' = ?)
        )
    `,
    [fromId, toId, fieldId, fromId, fromId],
  );
}

async function ensureOption(trx, field, option, sortOrder) {
  const names = [option.value, option.label, ...option.aliases];
  const candidates = await trx("custom_field_options")
    .where({ field_id: field.id })
    .andWhere((query) => {
      query.whereIn("value", names).orWhereIn("label", names);
    })
    .orderByRaw(
      `
        CASE
          WHEN value = ? THEN 0
          WHEN label = ? THEN 1
          WHEN deleted_at IS NULL THEN 2
          ELSE 3
        END
      `,
      [option.value, option.label],
    )
    .select("*");

  let target = candidates[0];
  if (!target) {
    [target] = await trx("custom_field_options")
      .insert({
        field_id: field.id,
        label: option.label,
        value: option.value,
        created_by_role: "admin",
        created_by_id: field.created_by_id || null,
        is_editable_by_coach: false,
        is_active: true,
        sort_order: sortOrder,
      })
      .returning("*");
  }

  for (const duplicate of candidates.filter((row) => row.id !== target.id)) {
    await replaceStoredOptionId(trx, field.id, duplicate.id, target.id);
    await trx("custom_field_options").where({ id: duplicate.id }).update({
      is_active: false,
      deleted_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });
  }

  [target] = await trx("custom_field_options")
    .where({ id: target.id })
    .update({
      label: option.label,
      value: option.value,
      is_editable_by_coach: false,
      is_active: true,
      deleted_at: null,
      sort_order: sortOrder,
      updated_at: trx.fn.now(),
    })
    .returning("*");

  return target;
}

async function alignField(trx, field) {
  await trx("custom_categories").where({ id: field.category_id }).update({
    name: "Football information",
    description: null,
    updated_at: trx.fn.now(),
  });

  [field] = await trx("custom_fields")
    .where({ id: field.id })
    .update({
      label: "Main Position",
      key: "main_position",
      field_type: "multi_select",
      is_required: true,
      placeholder: null,
      validation_rules: JSON.stringify({ system: true, immutable: true }),
      is_editable_by_coach: false,
      is_active: true,
      deleted_at: null,
      updated_at: trx.fn.now(),
    })
    .returning("*");

  for (const [index, option] of MAIN_POSITION_OPTIONS.entries()) {
    await ensureOption(trx, field, option, index);
  }

  await trx("custom_field_options")
    .where({ field_id: field.id })
    .whereNotIn(
      "value",
      MAIN_POSITION_OPTIONS.map((option) => option.value),
    )
    .update({
      is_active: false,
      deleted_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });

  await trx.raw(
    `
      UPDATE player_custom_values
      SET
        value_json = CASE
          WHEN value_json IS NOT NULL AND jsonb_typeof(value_json) = 'array' THEN value_json
          WHEN value_json IS NOT NULL AND jsonb_typeof(value_json) = 'string' THEN jsonb_build_array(value_json #>> '{}')
          WHEN value_option_id IS NOT NULL THEN jsonb_build_array(value_option_id::text)
          ELSE value_json
        END,
        value_option_id = NULL,
        updated_at = NOW()
      WHERE field_id = ?
        AND (
          value_option_id IS NOT NULL
          OR value_json IS NOT NULL
        )
    `,
    [field.id],
  );
}

exports.up = async function up(knex) {
  const hasTables = await Promise.all([
    knex.schema.hasTable("custom_fields"),
    knex.schema.hasTable("custom_categories"),
    knex.schema.hasTable("custom_field_options"),
    knex.schema.hasTable("player_custom_values"),
  ]);
  if (hasTables.some((exists) => !exists)) return;

  await knex.transaction(async (trx) => {
    const fields = await trx("custom_fields as cf")
      .join("custom_categories as cc", "cf.category_id", "cc.id")
      .whereNull("cf.deleted_at")
      .whereNull("cc.deleted_at")
      .whereIn("cf.key", ["main_position", "main_postion"])
      .select("cf.*");

    for (const field of fields) {
      await alignField(trx, field);
    }
  });
};

exports.down = async function down() {
  // Keep the legacy checkbox shape and player selections.
};
