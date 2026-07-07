/**
 * Admin academy support:
 * - Normalize branch/group metadata used by the admin UI.
 * - Keep a direct group -> branch link for faster filtering while preserving
 *   birth-year ownership.
 * - Add coach assignments with PDF/image-only attachments and submissions.
 */
exports.up = async function (knex) {
    const branchHasCity = await knex.schema.hasColumn('academy_branches', 'city');
    const branchHasCapacity = await knex.schema.hasColumn('academy_branches', 'capacity');
    const branchHasActive = await knex.schema.hasColumn('academy_branches', 'is_active');

    await knex.schema.alterTable('academy_branches', (t) => {
        if (!branchHasCity) t.string('city', 100);
        if (!branchHasCapacity) t.integer('capacity');
        if (!branchHasActive) t.boolean('is_active').notNullable().defaultTo(true);
    });

    const groupHasBranch = await knex.schema.hasColumn('academy_groups', 'branch_id');
    const groupHasActive = await knex.schema.hasColumn('academy_groups', 'is_active');

    await knex.schema.alterTable('academy_groups', (t) => {
        if (!groupHasBranch) {
            t.uuid('branch_id').nullable().references('id').inTable('academy_branches').onDelete('CASCADE');
        }
        if (!groupHasActive) t.boolean('is_active').notNullable().defaultTo(true);
    });

    if (!groupHasBranch) {
        await knex.raw(`
            UPDATE academy_groups ag
            SET branch_id = aby.branch_id
            FROM academy_birth_years aby
            WHERE ag.birth_year_id = aby.id
              AND ag.branch_id IS NULL
        `);
        await knex.raw('ALTER TABLE academy_groups ALTER COLUMN branch_id SET NOT NULL');
    }

    await knex.raw('CREATE INDEX IF NOT EXISTS academy_groups_branch_id_idx ON academy_groups(branch_id)');

    const coachHasBranch = await knex.schema.hasColumn('coach_profiles', 'branch_id');
    if (!coachHasBranch) {
        await knex.schema.alterTable('coach_profiles', (t) => {
            t.uuid('branch_id').nullable().references('id').inTable('academy_branches').onDelete('SET NULL');
            t.index('branch_id');
        });
    }

    await knex.raw(`
        DELETE FROM coach_group_assignments a
        USING coach_group_assignments b
        WHERE a.ctid < b.ctid
          AND a.coach_id = b.coach_id
          AND a.group_id = b.group_id
    `);
    await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS coach_group_assignments_unique_group
        ON coach_group_assignments(coach_id, group_id)
    `);

    await knex.raw(`
        DO $$ BEGIN
            CREATE TYPE coach_assignment_status AS ENUM ('assigned', 'in_progress', 'submitted', 'reviewed', 'cancelled');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    `);

    await knex.raw(`
        DO $$ BEGIN
            CREATE TYPE coach_assignment_file_type AS ENUM ('pdf', 'image');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    `);

    await knex.raw(`
        DO $$ BEGIN
            CREATE TYPE coach_assignment_file_role AS ENUM ('brief', 'submission');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    `);

    const hasAssignments = await knex.schema.hasTable('coach_assignments');
    if (!hasAssignments) {
        await knex.schema.createTable('coach_assignments', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('academy_id').notNullable().references('id').inTable('academy_academies').onDelete('CASCADE');
            t.uuid('coach_id').notNullable().references('id').inTable('coach_profiles').onDelete('CASCADE');
            t.uuid('branch_id').references('id').inTable('academy_branches').onDelete('SET NULL');
            t.uuid('group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
            t.string('title', 255).notNullable();
            t.text('description');
            t.date('due_date');
            t.specificType('status', 'coach_assignment_status').notNullable().defaultTo('assigned');
            t.jsonb('accepted_file_types').notNullable().defaultTo(knex.raw(`'["pdf","image"]'::jsonb`));
            t.uuid('created_by').references('id').inTable('auth_users').onDelete('SET NULL');
            t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
            t.timestamp('submitted_at');
            t.timestamp('reviewed_at');
            t.text('admin_notes');
            t.text('coach_notes');
            t.timestamps(true, true);
            t.timestamp('deleted_at');
            t.index('academy_id');
            t.index('coach_id');
            t.index('branch_id');
            t.index('group_id');
            t.index('status');
        });
    }

    const hasAssignmentFiles = await knex.schema.hasTable('coach_assignment_files');
    if (!hasAssignmentFiles) {
        await knex.schema.createTable('coach_assignment_files', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('assignment_id').notNullable().references('id').inTable('coach_assignments').onDelete('CASCADE');
            t.uuid('uploaded_by').references('id').inTable('auth_users').onDelete('SET NULL');
            t.specificType('file_role', 'coach_assignment_file_role').notNullable().defaultTo('submission');
            t.specificType('file_type', 'coach_assignment_file_type').notNullable();
            t.string('file_name', 255).notNullable();
            t.text('file_url').notNullable();
            t.string('mime_type', 100);
            t.bigInteger('size_bytes');
            t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            t.index('assignment_id');
            t.index('uploaded_by');
            t.index('file_role');
        });
    }

    await knex.raw(`
        DROP TRIGGER IF EXISTS set_updated_at ON coach_assignments;
        CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON coach_assignments
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_updated_at();
    `);
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('coach_assignment_files');
    await knex.schema.dropTableIfExists('coach_assignments');
    await knex.raw('DROP TYPE IF EXISTS coach_assignment_file_role');
    await knex.raw('DROP TYPE IF EXISTS coach_assignment_file_type');
    await knex.raw('DROP TYPE IF EXISTS coach_assignment_status');
    await knex.raw('DROP INDEX IF EXISTS coach_group_assignments_unique_group');
    await knex.raw('DROP INDEX IF EXISTS academy_groups_branch_id_idx');

    const coachHasBranch = await knex.schema.hasColumn('coach_profiles', 'branch_id');
    if (coachHasBranch) {
        await knex.schema.alterTable('coach_profiles', (t) => {
            t.dropColumn('branch_id');
        });
    }

    const groupHasBranch = await knex.schema.hasColumn('academy_groups', 'branch_id');
    const groupHasActive = await knex.schema.hasColumn('academy_groups', 'is_active');
    if (groupHasBranch || groupHasActive) {
        await knex.schema.alterTable('academy_groups', (t) => {
            if (groupHasActive) t.dropColumn('is_active');
            if (groupHasBranch) t.dropColumn('branch_id');
        });
    }

    const branchHasCity = await knex.schema.hasColumn('academy_branches', 'city');
    const branchHasCapacity = await knex.schema.hasColumn('academy_branches', 'capacity');
    const branchHasActive = await knex.schema.hasColumn('academy_branches', 'is_active');
    if (branchHasCity || branchHasCapacity || branchHasActive) {
        await knex.schema.alterTable('academy_branches', (t) => {
            if (branchHasActive) t.dropColumn('is_active');
            if (branchHasCapacity) t.dropColumn('capacity');
            if (branchHasCity) t.dropColumn('city');
        });
    }
};
