exports.up = async function up(knex) {
  const hasPlayers = await knex.schema.hasTable("player_profiles");
  if (!hasPlayers) return;

  const hasParentEmail = await knex.schema.hasColumn(
    "player_profiles",
    "parent_email",
  );
  const hasEmergencyContact = await knex.schema.hasColumn(
    "player_profiles",
    "emergency_contact",
  );

  if (hasParentEmail || hasEmergencyContact) {
    await knex.schema.alterTable("player_profiles", (table) => {
      if (hasParentEmail) table.dropColumn("parent_email");
      if (hasEmergencyContact) table.dropColumn("emergency_contact");
    });
  }
};

exports.down = async function down(knex) {
  const hasPlayers = await knex.schema.hasTable("player_profiles");
  if (!hasPlayers) return;

  const hasParentEmail = await knex.schema.hasColumn(
    "player_profiles",
    "parent_email",
  );
  const hasEmergencyContact = await knex.schema.hasColumn(
    "player_profiles",
    "emergency_contact",
  );

  if (!hasParentEmail || !hasEmergencyContact) {
    await knex.schema.alterTable("player_profiles", (table) => {
      if (!hasParentEmail) table.string("parent_email", 255);
      if (!hasEmergencyContact) table.string("emergency_contact", 50);
    });
  }
};
