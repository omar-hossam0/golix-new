exports.up = async function up(knex) {
  await knex.raw(`
    UPDATE match_player_stats AS mps
    SET saves = 0,
        updated_at = now()
    FROM match_squads AS ms
    WHERE ms.match_id = mps.match_id
      AND ms.player_id = mps.player_id
      AND COALESCE(mps.saves, 0) <> 0
      AND NOT (
        lower(trim(COALESCE(ms.position, ''))) = 'gk'
        OR lower(trim(COALESCE(ms.position, ''))) LIKE '%goalkeeper%'
      )
  `);
};

exports.down = async function down() {
  // Irreversible data cleanup: removed invalid saves from non-goalkeepers.
};
