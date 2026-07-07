function isChatGroupMember(user, conversation) {
    return conversation.type === 'chat_group'
        && Array.isArray(conversation.group_member_user_ids)
        && conversation.group_member_user_ids.includes(user.userId);
}

function canAccessConversation(user, conversation) {
    if (!user || !conversation || conversation.academy_id !== user.academyId) {
        return false;
    }
    if (user.role === 'admin') {
        return (
            ['admin_coach', 'admin_player_session'].includes(conversation.type)
            && conversation.admin_user_id === user.userId
        ) || isChatGroupMember(user, conversation);
    }
    if (user.role === 'coach') {
        return conversation.coach_user_id === user.userId || isChatGroupMember(user, conversation);
    }
    if (user.role === 'player') {
        return conversation.player_user_id === user.userId || isChatGroupMember(user, conversation);
    }
    if (user.role === 'parent') {
        return conversation.parent_user_id === user.userId || isChatGroupMember(user, conversation);
    }
    return false;
}

function canAccessAttachment(user, message, conversation) {
    if (!message?.attachment_url || message.conversation_id !== conversation?.id) return false;
    return canAccessConversation(user, conversation);
}

function canAccessPlayerRecord(user, player, { write = false, coachCanAccess = false, parentCanAccess = false } = {}) {
    if (!user || !player || player.academy_id !== user.academyId) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'player') return !write && player.user_id === user.userId;
    if (user.role === 'parent') return !write && (player.id === user.linkedPlayerId || parentCanAccess);
    if (user.role === 'coach') return Boolean(coachCanAccess);
    return false;
}

function canAccessAiInsight(user, player, options = {}) {
    return canAccessPlayerRecord(user, player, { ...options, write: false });
}

function canAccessUploadMetadata(user, mediaFile) {
    if (!user || !mediaFile) return false;
    if (mediaFile.academy_id && mediaFile.academy_id !== user.academyId) return false;
    if (mediaFile.is_sensitive === false) return true;
    if (user.role === 'admin') return true;
    if (mediaFile.uploader_id && mediaFile.uploader_id === user.userId) return true;

    const scope = mediaFile.scope || mediaFile.entity_type;
    if (scope === 'assignments') return false;
    if (scope === 'player-assignments') return false;
    if (scope === 'coaches') return ['admin', 'coach'].includes(user.role);
    return false;
}

function canParentAccessChild(parentUserId, child, capability) {
    if (!parentUserId || !child) return false;
    if (child.parent_user_id && child.parent_user_id !== parentUserId) return false;
    if (capability === 'progress' && child.can_view_progress === false) return false;
    if (capability === 'message_coach' && child.can_message_coach === false) return false;
    return true;
}

module.exports = {
    canAccessAttachment,
    canAccessAiInsight,
    canAccessConversation,
    canAccessPlayerRecord,
    canAccessUploadMetadata,
    canParentAccessChild,
};
