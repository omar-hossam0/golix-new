require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const db = require('../src/infrastructure/database');
const PlayersRepository = require('../src/modules/players/players.repository');
const CoachesRepository = require('../src/modules/coaches/coaches.repository');
const crypto = require('crypto');

describe('BaseRepository tenant isolation', () => {
    const playersRepo = new PlayersRepository(db);
    const coachesRepo = new CoachesRepository(db);

    const academyBId = crypto.randomUUID();
    const branchBId = crypto.randomUUID();
    const playerBId = crypto.randomUUID();
    const playerBUser = crypto.randomUUID();
    const seededAcademyId = 'a9e47995-5f3b-4224-8f24-4b14cfe8d011'; // GOALIX seeded academy

    beforeAll(async () => {
        // Insert Academy B
        await db('academy_academies').insert({
            id: academyBId,
            name: 'Academy B Test'
        });

        // Insert Branch B
        await db('academy_branches').insert({
            id: branchBId,
            academy_id: academyBId,
            name: 'Branch B',
            address: 'Address B',
            created_at: new Date(),
            updated_at: new Date()
        });

        // Insert Auth User B
        await db('auth_users').insert({
            id: playerBUser,
            email: `playerb-${crypto.randomBytes(4).toString('hex')}@test.com`,
            password_hash: 'hash',
            role: 'player',
            academy_id: academyBId,
            is_verified: true,
            created_at: new Date(),
            updated_at: new Date()
        });

        // Insert Player Profile B
        await db('player_profiles').insert({
            id: playerBId,
            user_id: playerBUser,
            academy_id: academyBId,
            branch_id: branchBId,
            full_name: 'Player B Test',
            date_of_birth: '2012-01-01',
            level: 'A',
            position: 'Forward',
            preferred_foot: 'right',
            guardian_name: 'Guardian B',
            guardian_phone: '+201000000000',
            created_at: new Date(),
            updated_at: new Date()
        });
    });

    afterAll(async () => {
        // Clean up test data in reverse order of foreign keys
        await db('player_profiles').where({ id: playerBId }).del();
        await db('auth_users').where({ id: playerBUser }).del();
        await db('academy_branches').where({ id: branchBId }).del();
        await db('academy_academies').where({ id: academyBId }).del();
    });

    test('scoped query to seeded academy does not return Academy B player', async () => {
        const player = await playersRepo.findById(playerBId, null, seededAcademyId);
        expect(player).toBeUndefined();
    });

    test('scoped query to Academy B does return Academy B player', async () => {
        const player = await playersRepo.findById(playerBId, null, academyBId);
        expect(player).toBeDefined();
        expect(player.id).toBe(playerBId);
    });

    test('scoped update from seeded academy does not modify Academy B player', async () => {
        const updated = await playersRepo.update(playerBId, { full_name: 'Hacked' }, null, seededAcademyId);
        expect(updated).toBeUndefined();

        // Verify the name was not changed
        const unchanged = await playersRepo.findById(playerBId, null, academyBId);
        expect(unchanged.full_name).toBe('Player B Test');
    });

    test('scoped softDelete from seeded academy throws NotFoundError for Academy B player', async () => {
        await expect(playersRepo.softDelete(playerBId, null, seededAcademyId)).rejects.toThrow();
    });

    test('scoped hardDelete from seeded academy deletes zero rows for Academy B player', async () => {
        const deletedCount = await playersRepo.hardDelete(playerBId, null, seededAcademyId);
        expect(deletedCount).toBe(0);
    });
});
