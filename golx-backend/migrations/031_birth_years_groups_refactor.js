/**
 * Refactor birth years to ranges + labels, and decouple groups from birth_year_id.
 */
exports.up = async function up(knex) {
    await knex.transaction(async (trx) => {
        // Check if migration already applied
        const hasFromYear = await trx.schema.hasColumn('academy_birth_years', 'from_year');
        const hasBranchId = await trx.schema.hasColumn('academy_groups', 'branch_id');
        const hasGroupLabels = await trx.schema.hasTable('group_labels');

        // --- Birth years: add range + normalization ---
        if (!hasFromYear) {
            await trx.schema.alterTable('academy_birth_years', (t) => {
                t.smallint('from_year');
                t.smallint('to_year');
                t.string('normalized_label', 120);
                t.timestamp('deleted_at');
            });

            const hasYear = await trx.schema.hasColumn('academy_birth_years', 'year');
            if (hasYear) {
                await trx.raw(`
                    UPDATE academy_birth_years
                    SET
                        label = COALESCE(label, year::text),
                        from_year = COALESCE(from_year, year),
                        to_year = COALESCE(to_year, year),
                        normalized_label = LOWER(TRIM(COALESCE(label, year::text)))
                `);
            } else {
                await trx.raw(`
                    UPDATE academy_birth_years
                    SET
                        normalized_label = LOWER(TRIM(COALESCE(label, 'unknown')))
                    WHERE normalized_label IS NULL
                `);
            }

            await trx.raw('ALTER TABLE academy_birth_years ALTER COLUMN from_year SET NOT NULL');
            await trx.raw('ALTER TABLE academy_birth_years ALTER COLUMN to_year SET NOT NULL');
            await trx.raw('ALTER TABLE academy_birth_years ALTER COLUMN normalized_label SET NOT NULL');

            const hasYearUnique = await trx.raw(`
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_name = 'academy_birth_years'
                AND constraint_type = 'UNIQUE'
                AND constraint_name LIKE '%year%'
            `);

            if (hasYearUnique.rows.length > 0 && hasYear) {
                await trx.schema.alterTable('academy_birth_years', (t) => {
                    t.dropUnique(['branch_id', 'year']);
                });
            }

            if (hasYear) {
                await trx.schema.alterTable('academy_birth_years', (t) => {
                    t.dropColumn('year');
                });
            }

            await trx.schema.alterTable('academy_birth_years', (t) => {
                t.index('normalized_label');
                t.index(['branch_id', 'normalized_label']);
                t.index(['branch_id', 'from_year']);
            });
        }

        // --- Groups: add branch_id ---
        if (!hasBranchId) {
            await trx.schema.alterTable('academy_groups', (t) => {
                t.uuid('branch_id');
            });

            const hasBirthYearId = await trx.schema.hasColumn('academy_groups', 'birth_year_id');
            if (hasBirthYearId) {
                await trx.raw(`
                    UPDATE academy_groups ag
                    SET branch_id = aby.branch_id
                    FROM academy_birth_years aby
                    WHERE ag.birth_year_id = aby.id
                `);
            }

            await trx.raw('ALTER TABLE academy_groups ALTER COLUMN branch_id SET NOT NULL');

            await trx.schema.alterTable('academy_groups', (t) => {
                t.foreign('branch_id').references('id').inTable('academy_branches').onDelete('CASCADE');
                t.index('branch_id');
            });
        }

        // --- Group labels ---
        if (!hasGroupLabels) {
            await trx.schema.createTable('group_labels', (t) => {
                t.uuid('id').primary().defaultTo(trx.raw('uuid_generate_v4()'));
                t.uuid('group_id').notNullable().references('id').inTable('academy_groups').onDelete('CASCADE');
                t.string('normalized_label', 120).notNullable();
                t.timestamp('created_at').notNullable().defaultTo(trx.fn.now());
                t.unique(['group_id', 'normalized_label']);
                t.index('group_id');
                t.index('normalized_label');
            });

            const hasBirthYearId = await trx.schema.hasColumn('academy_groups', 'birth_year_id');
            if (hasBirthYearId) {
                await trx.raw(`
                    INSERT INTO group_labels (group_id, normalized_label, created_at)
                    SELECT ag.id, aby.normalized_label, NOW()
                    FROM academy_groups ag
                    JOIN academy_birth_years aby ON ag.birth_year_id = aby.id
                    ON CONFLICT (group_id, normalized_label) DO NOTHING
                `);
            }
        }

        // --- Drop old FK ---
        const hasBirthYearId = await trx.schema.hasColumn('academy_groups', 'birth_year_id');
        if (hasBirthYearId) {
            await trx.schema.alterTable('academy_groups', (t) => {
                t.dropForeign(['birth_year_id']);
                t.dropIndex(['birth_year_id']);
                t.dropColumn('birth_year_id');
            });
        }
    });
};

exports.down = async function down(knex) {
    await knex.transaction(async (trx) => {
        // Re-add legacy columns
        await trx.schema.alterTable('academy_groups', (t) => {
            t.uuid('birth_year_id');
        });

        await trx.raw(`
            UPDATE academy_groups ag
            SET birth_year_id = sub.birth_year_id
            FROM (
                SELECT DISTINCT ON (gl.group_id)
                    gl.group_id,
                    aby.id as birth_year_id
                FROM group_labels gl
                JOIN academy_groups ag2 ON ag2.id = gl.group_id
                JOIN academy_birth_years aby
                  ON aby.branch_id = ag2.branch_id
                 AND aby.normalized_label = gl.normalized_label
                ORDER BY gl.group_id, aby.from_year ASC
            ) sub
            WHERE ag.id = sub.group_id
        `);

        await trx.schema.alterTable('academy_groups', (t) => {
            t.foreign('birth_year_id').references('id').inTable('academy_birth_years').onDelete('CASCADE');
            t.index('birth_year_id');
        });

        await trx.schema.dropTableIfExists('group_labels');

        await trx.schema.alterTable('academy_birth_years', (t) => {
            t.smallint('year');
        });

        await trx.raw('UPDATE academy_birth_years SET year = from_year');

        await trx.schema.alterTable('academy_birth_years', (t) => {
            t.unique(['branch_id', 'year']);
            t.dropIndex(['branch_id', 'normalized_label']);
            t.dropIndex(['branch_id', 'from_year']);
            t.dropIndex(['normalized_label']);
            t.dropColumn('from_year');
            t.dropColumn('to_year');
            t.dropColumn('normalized_label');
            t.dropColumn('deleted_at');
        });
    });
};
