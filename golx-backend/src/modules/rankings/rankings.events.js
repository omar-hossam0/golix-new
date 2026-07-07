const RANKINGS_EVENTS = {
    WEEKLY_CALCULATED: 'rankings.weekly.calculated',   // { groupId, periodStart }
    MONTHLY_CALCULATED: 'rankings.monthly.calculated',  // { groupId, periodStart }
    TREND_UPDATED: 'rankings.trend.updated',       // { playerId, trend }
    EVALUATION_CREATED: 'rankings.evaluation.created',  // { evaluationId, playerId, coachId }
    MATCH_RECORDED: 'rankings.match.recorded',      // { matchId, groupId }
    RECALCULATE_REQUESTED: 'rankings.recalculate.req',     // { groupId, periodType }
};

module.exports = RANKINGS_EVENTS;
