exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn("player_profiles", "photo_url");
  if (hasColumn) {
    await knex.schema.alterTable("player_profiles", (table) => {
      table.dropColumn("photo_url");
    });
  }
};

exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn("player_profiles", "photo_url");
  if (!hasColumn) {
    await knex.schema.alterTable("player_profiles", (table) => {
      table.text("photo_url");
    });
  }
};
