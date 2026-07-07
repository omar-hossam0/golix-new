const { Router } = require('express');
const validate = require('../../middleware/validate.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { rbac } = require('../../middleware/rbac.middleware');
const {
    uuidParam,
    rankingsQuery,
    createEvaluationSchema,
    createMatchSchema,
    playerMatchStatsSchema,
    recalculateSchema,
} = require('./rankings.schema');

function rankingsRoutes(controller) {
    const router = Router();
    router.use(authMiddleware);

    // Rankings
    router.get('/weekly', rbac('rankings:read'), validate({ query: rankingsQuery }), controller.getWeekly);
    router.get('/monthly', rbac('rankings:read'), validate({ query: rankingsQuery }), controller.getMonthly);
    router.get('/player/:id', rbac('rankings:read'), validate({ params: uuidParam }), controller.getPlayerRankings);
    router.post('/recalculate', rbac('manage_players'), validate({ body: recalculateSchema }), controller.recalculate);

    // Evaluations
    router.post('/evaluations', rbac('evaluations:write'), validate({ body: createEvaluationSchema }), controller.createEvaluation);
    router.get('/evaluations/player/:id', rbac('evaluations:read'), validate({ params: uuidParam }), controller.getPlayerEvaluations);

    // Matches
    router.post('/matches', rbac('matches:write'), validate({ body: createMatchSchema }), controller.createMatch);
    router.post('/matches/player-stats', rbac('matches:write'), validate({ body: playerMatchStatsSchema }), controller.addPlayerStats);

    return router;
}

module.exports = rankingsRoutes;
