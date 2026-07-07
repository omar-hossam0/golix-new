exports.up = async function up(knex) {
  const hasSubmissions = await knex.schema.hasTable("player_assignment_submissions");
  if (!hasSubmissions) return;

  const hasReviewStatus = await knex.schema.hasColumn("player_assignment_submissions", "review_status");
  if (!hasReviewStatus) {
    await knex.schema.alterTable("player_assignment_submissions", (t) => {
      t.string("review_status", 20).notNullable().defaultTo("pending");
      t.text("coach_comment");
      t.uuid("reviewed_by_coach_id").references("id").inTable("coach_profiles").onDelete("SET NULL");
      t.uuid("reviewed_by_user_id").references("id").inTable("auth_users").onDelete("SET NULL");
      t.timestamp("reviewed_at");
      t.index("review_status");
      t.index("reviewed_by_coach_id");
    });
    await knex.raw(`
      ALTER TABLE player_assignment_submissions
      ADD CONSTRAINT player_assignment_submissions_review_status_check
      CHECK (review_status IN ('pending', 'approved', 'rejected'))
    `);
  }
};

exports.down = async function down(knex) {
  const hasSubmissions = await knex.schema.hasTable("player_assignment_submissions");
  if (!hasSubmissions) return;
  const hasReviewStatus = await knex.schema.hasColumn("player_assignment_submissions", "review_status");
  if (!hasReviewStatus) return;

  await knex.raw(`
    ALTER TABLE player_assignment_submissions
    DROP CONSTRAINT IF EXISTS player_assignment_submissions_review_status_check
  `);
  await knex.schema.alterTable("player_assignment_submissions", (t) => {
    t.dropIndex("review_status");
    t.dropIndex("reviewed_by_coach_id");
    t.dropColumn("reviewed_at");
    t.dropColumn("reviewed_by_user_id");
    t.dropColumn("reviewed_by_coach_id");
    t.dropColumn("coach_comment");
    t.dropColumn("review_status");
  });
};
