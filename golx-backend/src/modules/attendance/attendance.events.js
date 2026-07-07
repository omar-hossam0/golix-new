const ATTENDANCE_EVENTS = {
    SESSION_CREATED: 'attendance.session.created',    // { sessionId, groupId, coachId, date }
    SESSION_STARTED: 'attendance.session.started',    // { sessionId, groupId, coachId }
    SESSION_COMPLETED: 'attendance.session.completed',  // { sessionId, groupId, coachId }
    SESSION_CANCELLED: 'attendance.session.cancelled',  // { sessionId }
    MARKED: 'attendance.marked',             // { sessionId, playerId, status, markedBy }
    BATCH_MARKED: 'attendance.batch.marked',       // { sessionId, records: [{playerId, status}] }
    REPORT_READY: 'attendance.report.ready',       // { reportId, branchId }
};

module.exports = ATTENDANCE_EVENTS;
