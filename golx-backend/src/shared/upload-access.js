const { canAccessUploadMetadata } = require('./access-policy');

async function findCoachIdForUser(db, user) {
    if (user.role !== 'coach') return null;
    const coach = await db('coach_profiles')
        .where({ user_id: user.userId, academy_id: user.academyId })
        .whereNull('deleted_at')
        .first('id');
    return coach?.id || null;
}

async function canAccessCoachAssignmentMedia(user, mediaFile, db) {
    if (!mediaFile.entity_id) return false;
    const coachId = await findCoachIdForUser(db, user);
    if (!coachId) return false;

    const assignment = await db('coach_assignments')
        .where({
            id: mediaFile.entity_id,
            academy_id: user.academyId,
            coach_id: coachId,
        })
        .whereNull('deleted_at')
        .first('id');

    return Boolean(assignment);
}

async function canAccessPlayerAssignmentMedia(user, mediaFile, db) {
    if (!mediaFile.entity_id) return false;

    const submission = await db('player_assignment_submissions as pas')
        .join('player_assignments as pa', 'pas.assignment_id', 'pa.id')
        .join('player_profiles as pp', 'pas.player_id', 'pp.id')
        .leftJoin('coach_profiles as cp', 'pa.created_by_coach_id', 'cp.id')
        .where('pas.id', mediaFile.entity_id)
        .where('pa.academy_id', user.academyId)
        .whereNull('pa.deleted_at')
        .select(
            'pas.player_id',
            'pas.submitted_by_user_id',
            'pp.user_id as player_user_id',
            'cp.user_id as coach_user_id',
        )
        .first();

    if (!submission) return false;
    if (user.role === 'coach') return submission.coach_user_id === user.userId;
    if (user.role === 'player') {
        return submission.player_user_id === user.userId
            || submission.submitted_by_user_id === user.userId;
    }
    return false;
}

async function canAccessMediaFile(user, mediaFile, db) {
    if (!user || !mediaFile) return false;
    if (mediaFile.academy_id && mediaFile.academy_id !== user.academyId) return false;
    if (mediaFile.is_sensitive === false) return true;
    if (user.role === 'admin') return true;
    if (mediaFile.uploader_id && mediaFile.uploader_id === user.userId) return true;

    const scope = mediaFile.scope || mediaFile.entity_type;
    if (scope === 'assignments') {
        return canAccessCoachAssignmentMedia(user, mediaFile, db);
    }
    if (scope === 'player-assignments') {
        return canAccessPlayerAssignmentMedia(user, mediaFile, db);
    }

    return canAccessUploadMetadata(user, mediaFile);
}

module.exports = {
    canAccessMediaFile,
};
