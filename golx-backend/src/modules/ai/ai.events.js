const AI_EVENTS = {
    PERFORMANCE_SCORE_CALCULATED: 'ai.performance.score.calculated', // { playerId, score }
    INJURY_RISK_ASSESSED: 'ai.injury.risk.assessed',         // { playerId, riskLevel }
    NUTRITION_PLAN_GENERATED: 'ai.nutrition.plan.generated',     // { playerId, planId }
    CHAT_RESPONSE_GENERATED: 'ai.chat.response',                // { userId, prompt }
};

module.exports = AI_EVENTS;
