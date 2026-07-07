const COACHES_EVENTS = {
    CREATED: 'coaches.created',           // { coachId, userId, academyId }
    UPDATED: 'coaches.updated',           // { coachId }
    DELETED: 'coaches.deleted',           // { coachId, academyId }
    GROUP_ASSIGNED: 'coaches.group.assigned',    // { coachId, groupId }
    GROUP_UNASSIGNED: 'coaches.group.unassigned',  // { coachId, groupId }
    PERF_CALCULATED: 'coaches.performance.calc',  // { coachId, totalScore }
};

module.exports = COACHES_EVENTS;
