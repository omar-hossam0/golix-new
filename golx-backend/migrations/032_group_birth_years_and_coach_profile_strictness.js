/**
 * Move groups to explicit many-to-many birth year links and add strict coach
 * profile fields while preserving existing data.
 */
exports.up = async function up(knex) {
    await knex.transaction(async (trx) => {
        const groupHasDescription = await trx.schema.hasColumn('academy_groups', 'description');
        if (!groupHasDescription) {
            await trx.schema.alterTable('academy_groups', (t) => {
                t.text('description');
            });
        }

        const hasGroupBirthYears = await trx.schema.hasTable('group_birth_years');
        if (!hasGroupBirthYears) {
            await trx.schema.createTable('group_birth_years', (t) => {
                t.uuid('id').primary().defaultTo(trx.raw('uuid_generate_v4()'));
                t.uuid('group_id').notNullable().references('id').inTable('academy_groups').onDelete('CASCADE');
                t.uuid('birth_year_id').notNullable().references('id').inTable('academy_birth_years').onDelete('CASCADE');
                t.timestamp('created_at').notNullable().defaultTo(trx.fn.now());
                t.unique(['group_id', 'birth_year_id']);
                t.index('group_id');
                t.index('birth_year_id');
            });

            const hasBirthYearId = await trx.schema.hasColumn('academy_groups', 'birth_year_id');
            if (hasBirthYearId) {
                await trx.raw(`
                    INSERT INTO group_birth_years (group_id, birth_year_id, created_at)
                    SELECT ag.id, ag.birth_year_id, NOW()
                    FROM academy_groups ag
                    WHERE ag.birth_year_id IS NOT NULL
                    ON CONFLICT (group_id, birth_year_id) DO NOTHING
                `);
            }

            const hasGroupLabels = await trx.schema.hasTable('group_labels');
            if (hasGroupLabels) {
                await trx.raw(`
                    INSERT INTO group_birth_years (group_id, birth_year_id, created_at)
                    SELECT DISTINCT ag.id, aby.id, NOW()
                    FROM academy_groups ag
                    JOIN group_labels gl ON gl.group_id = ag.id
                    JOIN academy_birth_years aby
                      ON aby.branch_id = ag.branch_id
                     AND aby.normalized_label = gl.normalized_label
                     AND aby.deleted_at IS NULL
                    WHERE ag.deleted_at IS NULL
                    ON CONFLICT (group_id, birth_year_id) DO NOTHING
                `);
            }
        }

        const birthYearHasNormalized = await trx.schema.hasColumn('academy_birth_years', 'normalized_label');
        if (!birthYearHasNormalized) {
            await trx.schema.alterTable('academy_birth_years', (t) => {
                t.string('normalized_label', 120);
            });
            await trx.raw("UPDATE academy_birth_years SET normalized_label = LOWER(TRIM(COALESCE(label, from_year::text)))");
            await trx.raw('ALTER TABLE academy_birth_years ALTER COLUMN normalized_label SET NOT NULL');
        }

        await trx.raw('CREATE INDEX IF NOT EXISTS academy_birth_years_branch_id_idx ON academy_birth_years(branch_id)');
        await trx.raw('CREATE INDEX IF NOT EXISTS academy_birth_years_branch_range_idx ON academy_birth_years(branch_id, from_year, to_year) WHERE deleted_at IS NULL');
        await trx.raw('CREATE INDEX IF NOT EXISTS academy_groups_branch_id_idx ON academy_groups(branch_id)');

        const coachColumns = {
            first_name: await trx.schema.hasColumn('coach_profiles', 'first_name'),
            last_name: await trx.schema.hasColumn('coach_profiles', 'last_name'),
            email: await trx.schema.hasColumn('coach_profiles', 'email'),
            phone: await trx.schema.hasColumn('coach_profiles', 'phone'),
            role: await trx.schema.hasColumn('coach_profiles', 'role'),
            image: await trx.schema.hasColumn('coach_profiles', 'image'),
        };

        await trx.schema.alterTable('coach_profiles', (t) => {
            if (!coachColumns.first_name) t.string('first_name', 100);
            if (!coachColumns.last_name) t.string('last_name', 100);
            if (!coachColumns.email) t.string('email', 255);
            if (!coachColumns.phone) t.string('phone', 30);
            if (!coachColumns.role) t.string('role', 80);
            if (!coachColumns.image) t.text('image');
        });

        await trx.raw(`
            UPDATE coach_profiles cp
            SET
                first_name = COALESCE(NULLIF(cp.first_name, ''), split_part(COALESCE(cp.full_name, 'Coach'), ' ', 1), 'Coach'),
                last_name = COALESCE(NULLIF(cp.last_name, ''), NULLIF(regexp_replace(COALESCE(cp.full_name, 'Profile'), '^\\S+\\s*', ''), ''), 'Profile'),
                email = COALESCE(NULLIF(cp.email, ''), NULLIF(au.email, ''), CONCAT('coach-', cp.id, '@missing.local')),
                phone = COALESCE(NULLIF(cp.phone, ''), NULLIF(au.phone, ''), CONCAT('missing-', replace(cp.id::text, '-', ''))),
                role = COALESCE(NULLIF(cp.role, ''), NULLIF(cp.specialization, ''), 'head_coach'),
                image = COALESCE(NULLIF(cp.image, ''), NULLIF(cp.photo_url, ''))
            FROM auth_users au
            WHERE cp.user_id = au.id
        `);

        await trx.raw(`
            UPDATE coach_profiles cp
            SET
                first_name = COALESCE(NULLIF(cp.first_name, ''), split_part(COALESCE(cp.full_name, 'Coach'), ' ', 1), 'Coach'),
                last_name = COALESCE(NULLIF(cp.last_name, ''), NULLIF(regexp_replace(COALESCE(cp.full_name, 'Profile'), '^\\S+\\s*', ''), ''), 'Profile'),
                email = COALESCE(NULLIF(cp.email, ''), CONCAT('coach-', cp.id, '@missing.local')),
                phone = COALESCE(NULLIF(cp.phone, ''), CONCAT('missing-', replace(cp.id::text, '-', ''))),
                role = COALESCE(NULLIF(cp.role, ''), NULLIF(cp.specialization, ''), 'head_coach'),
                image = COALESCE(NULLIF(cp.image, ''), NULLIF(cp.photo_url, ''))
            WHERE cp.user_id IS NULL
        `);

        await trx.raw(`
            UPDATE coach_profiles cp
            SET branch_id = sub.branch_id
            FROM (
                SELECT DISTINCT ON (cga.coach_id) cga.coach_id, ag.branch_id
                FROM coach_group_assignments cga
                JOIN academy_groups ag ON ag.id = cga.group_id
                WHERE ag.branch_id IS NOT NULL
                ORDER BY cga.coach_id, cga.assigned_at DESC NULLS LAST
            ) sub
            WHERE cp.id = sub.coach_id
              AND cp.branch_id IS NULL
        `);

        await trx.raw(`
            UPDATE coach_profiles cp
            SET branch_id = sub.branch_id
            FROM (
                SELECT DISTINCT ON (academy_id) academy_id, id AS branch_id
                FROM academy_branches
                WHERE deleted_at IS NULL
                ORDER BY academy_id, created_at ASC
            ) sub
            WHERE cp.academy_id = sub.academy_id
              AND cp.branch_id IS NULL
        `);

        await trx.raw('ALTER TABLE coach_profiles ALTER COLUMN branch_id SET NOT NULL');
        await trx.raw('ALTER TABLE coach_profiles ALTER COLUMN first_name SET NOT NULL');
        await trx.raw('ALTER TABLE coach_profiles ALTER COLUMN last_name SET NOT NULL');
        await trx.raw('ALTER TABLE coach_profiles ALTER COLUMN email SET NOT NULL');
        await trx.raw('ALTER TABLE coach_profiles ALTER COLUMN phone SET NOT NULL');
        await trx.raw('ALTER TABLE coach_profiles ALTER COLUMN role SET NOT NULL');
        await trx.raw('CREATE INDEX IF NOT EXISTS coach_profiles_branch_id_idx ON coach_profiles(branch_id)');
        await trx.raw('CREATE INDEX IF NOT EXISTS coach_profiles_role_idx ON coach_profiles(role)');
        await trx.raw('CREATE UNIQUE INDEX IF NOT EXISTS coach_profiles_email_active_idx ON coach_profiles(lower(email)) WHERE deleted_at IS NULL');
    });
};

exports.down = async function down(knex) {
    await knex.transaction(async (trx) => {
        await trx.raw('DROP INDEX IF EXISTS coach_profiles_email_active_idx');
        await trx.raw('DROP INDEX IF EXISTS coach_profiles_role_idx');
        await trx.schema.alterTable('coach_profiles', (t) => {
            t.dropColumn('first_name');
            t.dropColumn('last_name');
            t.dropColumn('email');
            t.dropColumn('phone');
            t.dropColumn('role');
            t.dropColumn('image');
        });
        await trx.schema.dropTableIfExists('group_birth_years');
        const groupHasDescription = await trx.schema.hasColumn('academy_groups', 'description');
        if (groupHasDescription) {
            await trx.schema.alterTable('academy_groups', (t) => t.dropColumn('description'));
        }
    });
};
