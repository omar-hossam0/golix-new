const MAIN_POSITION_OPTIONS = [
  ["Striker", "Striker"],
  ["LW", "LW"],
  ["RW", "RW"],
  ["LB", "LB"],
  ["RB", "RB"],
  ["CM", "CM"],
  ["CAM", "CAM"],
  ["CB", "CB"],
  ["GK", "GK"],
];

async function ensureMainPositionForAcademy(trx, academy) {
  let category = await trx("custom_categories")
    .where({
      academy_id: academy.id,
      target_module: "player_profile",
      is_system_default: true,
    })
    .whereNull("deleted_at")
    .orderBy("sort_order", "asc")
    .first();

  if (!category) {
    [category] = await trx("custom_categories")
      .insert({
        academy_id: academy.id,
        name: "Football information",
        description: null,
        target_module: "player_profile",
        created_by_role: "admin",
        created_by_id: academy.owner_user_id || null,
        visibility: "global",
        is_editable_by_coach: false,
        is_system_default: true,
        is_active: true,
        sort_order: 0,
      })
      .returning("*");
  }

  const existingFields = await trx("custom_fields as cf")
    .join("custom_categories as cc", "cf.category_id", "cc.id")
    .where("cc.academy_id", academy.id)
    .whereNull("cf.deleted_at")
    .whereNull("cc.deleted_at")
    .whereIn("cf.key", ["main_position", "main_postion"])
    .orderByRaw("CASE WHEN cf.key = 'main_position' THEN 0 ELSE 1 END")
    .select("cf.*");

  let field = existingFields[0];
  const typoFields = existingFields.filter((row) => row.key === "main_postion");

  if (!field) {
    [field] = await trx("custom_fields")
      .insert({
        category_id: category.id,
        label: "Main Position",
        key: "main_position",
        field_type: "multi_select",
        is_required: true,
        placeholder: null,
        validation_rules: JSON.stringify({ system: true, immutable: true }),
        created_by_role: "admin",
        created_by_id: academy.owner_user_id || null,
        is_editable_by_coach: false,
        is_active: true,
        sort_order: 0,
      })
      .returning("*");
  } else if (field.key === "main_postion") {
    const conflict = await trx("custom_fields")
      .where({ category_id: field.category_id, key: "main_position" })
      .whereNull("deleted_at")
      .first("id");
    if (!conflict) {
      [field] = await trx("custom_fields")
        .where({ id: field.id })
        .update({
          key: "main_position",
          label: "Main Position",
          field_type: "multi_select",
          is_required: true,
          is_editable_by_coach: false,
          is_active: true,
          deleted_at: null,
          updated_at: trx.fn.now(),
        })
        .returning("*");
    }
  } else {
    [field] = await trx("custom_fields")
      .where({ id: field.id })
      .update({
        label: "Main Position",
        key: "main_position",
        field_type: "multi_select",
        is_required: true,
        is_editable_by_coach: false,
        is_active: true,
        deleted_at: null,
        updated_at: trx.fn.now(),
      })
      .returning("*");
  }

  for (const typoField of typoFields.filter((row) => row.id !== field.id)) {
    await trx.raw(
      `
        INSERT INTO player_custom_values (
          academy_id, player_id, field_id, value_text, value_long_text,
          value_number, value_decimal, value_date, value_boolean,
          value_option_id, value_json, created_by_id, updated_by_id,
          created_at, updated_at
        )
        SELECT
          academy_id, player_id, ?, value_text, value_long_text,
          value_number, value_decimal, value_date, value_boolean,
          value_option_id, value_json, created_by_id, updated_by_id,
          created_at, updated_at
        FROM player_custom_values
        WHERE field_id = ?
        ON CONFLICT (player_id, field_id)
        DO UPDATE SET
          value_text = EXCLUDED.value_text,
          value_long_text = EXCLUDED.value_long_text,
          value_number = EXCLUDED.value_number,
          value_decimal = EXCLUDED.value_decimal,
          value_date = EXCLUDED.value_date,
          value_boolean = EXCLUDED.value_boolean,
          value_option_id = EXCLUDED.value_option_id,
          value_json = EXCLUDED.value_json,
          updated_by_id = EXCLUDED.updated_by_id,
          updated_at = EXCLUDED.updated_at
      `,
      [field.id, typoField.id],
    );
    await trx("custom_fields").where({ id: typoField.id }).update({
      is_active: false,
      deleted_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });
  }

  await trx("custom_categories").where({ id: field.category_id }).update({
    name: "Football information",
    description: null,
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

  for (const [index, [value, label]] of MAIN_POSITION_OPTIONS.entries()) {
    await trx("custom_field_options")
      .insert({
        field_id: field.id,
        label,
        value,
        created_by_role: "admin",
        created_by_id: academy.owner_user_id || null,
        is_editable_by_coach: false,
        is_active: true,
        sort_order: index,
      })
      .onConflict(["field_id", "value"])
      .merge({
        label,
        is_editable_by_coach: false,
        is_active: true,
        deleted_at: null,
        sort_order: index,
        updated_at: trx.fn.now(),
      });
  }

  await trx("custom_field_options")
    .where({ field_id: field.id })
    .whereNotIn(
      "value",
      MAIN_POSITION_OPTIONS.map(([value]) => value),
    )
    .update({
      is_active: false,
      deleted_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });
}

exports.up = async function up(knex) {
  const hasTables = await Promise.all([
    knex.schema.hasTable("academy_academies"),
    knex.schema.hasTable("custom_categories"),
    knex.schema.hasTable("custom_fields"),
    knex.schema.hasTable("custom_field_options"),
  ]);
  if (hasTables.some((exists) => !exists)) return;

  const academies = await knex("academy_academies")
    .whereNull("deleted_at")
    .select("id", "owner_user_id");

  await knex.transaction(async (trx) => {
    for (const academy of academies) {
      await ensureMainPositionForAcademy(trx, academy);
    }
  });
};

exports.down = async function down() {
  // Preserve player profile data and system field values on rollback.
};
