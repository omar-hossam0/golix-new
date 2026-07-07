const {
    canAccessConversation,
    canAccessAiInsight,
    canAccessPlayerRecord,
    canAccessUploadMetadata,
    canParentAccessChild,
} = require('../src/shared/access-policy');

describe('access policy characterization', () => {
    test('parent can read linked or policy-approved child player records', () => {
        const parent = {
            role: 'parent',
            userId: 'parent-user',
            academyId: 'academy-1',
            linkedPlayerId: 'player-1',
        };

        expect(canAccessPlayerRecord(parent, {
            id: 'player-1',
            academy_id: 'academy-1',
        })).toBe(true);

        expect(canAccessPlayerRecord(parent, {
            id: 'player-2',
            academy_id: 'academy-1',
        })).toBe(false);

        expect(canAccessPlayerRecord(parent, {
            id: 'player-2',
            academy_id: 'academy-1',
        }, { parentCanAccess: true })).toBe(true);

        expect(canAccessPlayerRecord(parent, {
            id: 'player-1',
            academy_id: 'academy-1',
        }, { write: true })).toBe(false);
    });

    test('parent child capabilities honor link ownership and visibility flags', () => {
        expect(canParentAccessChild('parent-1', {
            parent_user_id: 'parent-1',
            can_view_progress: true,
            can_message_coach: true,
        }, 'progress')).toBe(true);

        expect(canParentAccessChild('parent-1', {
            parent_user_id: 'parent-2',
            can_view_progress: true,
        }, 'progress')).toBe(false);

        expect(canParentAccessChild('parent-1', {
            parent_user_id: 'parent-1',
            can_view_progress: false,
        }, 'progress')).toBe(false);
    });

    test('chat access remains scoped to academy and participant user ids', () => {
        const user = { role: 'coach', userId: 'coach-user', academyId: 'academy-1' };
        expect(canAccessConversation(user, {
            type: 'coach_player',
            academy_id: 'academy-1',
            coach_user_id: 'coach-user',
        })).toBe(true);

        expect(canAccessConversation(user, {
            type: 'coach_player',
            academy_id: 'academy-2',
            coach_user_id: 'coach-user',
        })).toBe(false);

        expect(canAccessConversation(user, {
            type: 'coach_player',
            academy_id: 'academy-1',
            coach_user_id: 'another-coach',
        })).toBe(false);

        expect(canAccessConversation({
            role: 'parent',
            userId: 'parent-user',
            academyId: 'academy-1',
        }, {
            type: 'chat_group',
            academy_id: 'academy-1',
            group_member_user_ids: ['coach-user', 'parent-user'],
        })).toBe(true);

        expect(canAccessConversation({
            role: 'parent',
            userId: 'parent-user',
            academyId: 'academy-1',
        }, {
            type: 'chat_group',
            academy_id: 'academy-1',
            group_member_user_ids: ['coach-user', 'another-parent'],
        })).toBe(false);
    });

    test('AI insight access mirrors player visibility and stays deny-by-default', () => {
        const parent = { role: 'parent', userId: 'parent-user', academyId: 'academy-1', linkedPlayerId: 'player-1' };
        const coach = { role: 'coach', userId: 'coach-user', academyId: 'academy-1' };

        expect(canAccessAiInsight(parent, {
            id: 'player-1',
            academy_id: 'academy-1',
        })).toBe(true);

        expect(canAccessAiInsight(parent, {
            id: 'player-2',
            academy_id: 'academy-1',
        })).toBe(false);

        expect(canAccessAiInsight(coach, {
            id: 'player-1',
            academy_id: 'academy-1',
        })).toBe(false);

        expect(canAccessAiInsight(coach, {
            id: 'player-1',
            academy_id: 'academy-1',
        }, { coachCanAccess: true })).toBe(true);
    });

    test('upload metadata access is same-academy and deny-by-default for sensitive files', () => {
        const admin = { role: 'admin', userId: 'admin-user', academyId: 'academy-1' };
        const coach = { role: 'coach', userId: 'coach-user', academyId: 'academy-1' };
        const player = { role: 'player', userId: 'player-user', academyId: 'academy-1' };

        expect(canAccessUploadMetadata(admin, {
            academy_id: 'academy-1',
            scope: 'player-assignments',
            is_sensitive: true,
        })).toBe(true);

        expect(canAccessUploadMetadata(coach, {
            academy_id: 'academy-1',
            scope: 'player-assignments',
            is_sensitive: true,
        })).toBe(false);

        expect(canAccessUploadMetadata(player, {
            academy_id: 'academy-1',
            scope: 'player-assignments',
            uploader_id: 'player-user',
            is_sensitive: true,
        })).toBe(true);

        expect(canAccessUploadMetadata(player, {
            academy_id: 'academy-1',
            scope: 'player-assignments',
            uploader_id: 'another-player',
            is_sensitive: true,
        })).toBe(false);

        expect(canAccessUploadMetadata(admin, {
            academy_id: 'academy-2',
            scope: 'player-assignments',
            is_sensitive: true,
        })).toBe(false);

        expect(canAccessUploadMetadata(player, {
            academy_id: 'academy-1',
            scope: 'coaches',
            is_sensitive: false,
        })).toBe(true);
    });
});
