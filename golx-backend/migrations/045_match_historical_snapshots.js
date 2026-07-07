exports.up = async function up(knex) {
  const hasMatches = await knex.schema.hasTable("matches");
  if (hasMatches) {
    const hasTargetSnapshot = await knex.schema.hasColumn(
      "matches",
      "target_snapshot",
    );
    if (!hasTargetSnapshot) {
      await knex.schema.alterTable("matches", (t) => {
        t.jsonb("target_snapshot")
          .notNullable()
          .defaultTo(knex.raw("'{}'::jsonb"));
      });
    }

    await knex.raw(`
      UPDATE matches AS m
      SET target_snapshot = jsonb_strip_nulls(jsonb_build_object(
        'groups',
        COALESCE(
          (
            SELECT jsonb_agg(DISTINCT jsonb_build_object('id', ag.id, 'name', ag.name))
            FROM calendar_event_groups AS ceg
            JOIN academy_groups AS ag ON ag.id = ceg.group_id
            WHERE ceg.event_id = m.event_id
          ),
          '[]'::jsonb
        ),
        'birthYears',
        COALESCE(
          (
            SELECT jsonb_agg(DISTINCT jsonb_build_object(
              'id', aby.id,
              'label', COALESCE(aby.label, CONCAT(aby.from_year, '-', aby.to_year)),
              'fromYear', aby.from_year,
              'toYear', aby.to_year
            ))
            FROM calendar_event_birth_years AS ceby
            JOIN academy_birth_years AS aby ON aby.id = ceby.birth_year_id
            WHERE ceby.event_id = m.event_id
          ),
          '[]'::jsonb
        ),
        'teamName',
        (SELECT team.name FROM academy_groups AS team WHERE team.id = m.team_id),
        'ageGroupName',
        (SELECT age_group.name FROM academy_groups AS age_group WHERE age_group.id = m.age_group_id)
      ))
      WHERE m.target_snapshot IS NULL OR m.target_snapshot = '{}'::jsonb
    `);
  }

  const hasSquads = await knex.schema.hasTable("match_squads");
  if (hasSquads) {
    const hasPlayerNameSnapshot = await knex.schema.hasColumn(
      "match_squads",
      "player_name_snapshot",
    );
    const hasProfileStatusSnapshot = await knex.schema.hasColumn(
      "match_squads",
      "profile_status_snapshot",
    );

    if (!hasPlayerNameSnapshot || !hasProfileStatusSnapshot) {
      await knex.schema.alterTable("match_squads", (t) => {
        if (!hasPlayerNameSnapshot) t.string("player_name_snapshot", 255);
        if (!hasProfileStatusSnapshot) t.string("profile_status_snapshot", 30);
      });
    }

    await knex.raw(`
      UPDATE match_squads AS ms
      SET
        player_name_snapshot = COALESCE(ms.player_name_snapshot, pp.full_name),
        profile_status_snapshot = COALESCE(ms.profile_status_snapshot, pp.profile_status::text)
      FROM player_profiles AS pp
      WHERE ms.player_id = pp.id
        AND (
          ms.player_name_snapshot IS NULL
          OR ms.profile_status_snapshot IS NULL
        )
    `);
  }
};

exports.down = async function down(knex) {
  const hasSquads = await knex.schema.hasTable("match_squads");
  if (hasSquads) {
    const hasPlayerNameSnapshot = await knex.schema.hasColumn(
      "match_squads",
      "player_name_snapshot",
    );
    const hasProfileStatusSnapshot = await knex.schema.hasColumn(
      "match_squads",
      "profile_status_snapshot",
    );

    if (hasPlayerNameSnapshot || hasProfileStatusSnapshot) {
      await knex.schema.alterTable("match_squads", (t) => {
        if (hasProfileStatusSnapshot) t.dropColumn("profile_status_snapshot");
        if (hasPlayerNameSnapshot) t.dropColumn("player_name_snapshot");
      });
    }
  }

  const hasMatches = await knex.schema.hasTable("matches");
  if (hasMatches) {
    const hasTargetSnapshot = await knex.schema.hasColumn(
      "matches",
      "target_snapshot",
    );
    if (hasTargetSnapshot) {
      await knex.schema.alterTable("matches", (t) => {
        t.dropColumn("target_snapshot");
      });
    }
  }
};
