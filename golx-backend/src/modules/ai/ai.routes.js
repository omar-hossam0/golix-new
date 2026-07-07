const { Router } = require('express');
const validate = require('../../middleware/validate.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { rbac, rbacAny } = require('../../middleware/rbac.middleware');
const {
    uuidParam,
    archiveQuery,
    performanceScoreQuery,
    injuryRiskSchema,
    nutritionPlanSchema,
    chatSchema,
} = require('./ai.schema');

function aiRoutes(controller) {
    const router = Router();
    router.use(authMiddleware);

    // Performance Scores
    router.get('/scores', rbacAny('manage_players', 'view_assigned_players'), controller.getAllScores);
    router.get('/scores/:id', rbacAny('manage_players', 'view_assigned_players'), validate({ params: uuidParam }), controller.getPerformanceScore);
    router.post('/scores/calculate', rbacAny('manage_players', 'manage_training_sessions'), validate({ body: performanceScoreQuery }), controller.calculatePerformanceScore);

    // Injury Risk
    router.post('/injury-risk', rbacAny('manage_players', 'manage_training_sessions'), validate({ body: injuryRiskSchema }), controller.assessInjuryRisk);
    router.get('/injury-risk/:id', rbacAny('manage_players', 'view_assigned_players'), validate({ params: uuidParam }), controller.getInjuryRisk);
    router.get('/injury-risk/:id/history', rbacAny('manage_players', 'view_assigned_players'), validate({ params: uuidParam, query: archiveQuery }), controller.getInjuryRiskHistory);

    // Nutrition Plan
    router.post('/nutrition-plan', rbacAny('manage_players', 'manage_training_sessions'), validate({ body: nutritionPlanSchema }), controller.generateNutritionPlan);
    router.get('/nutrition-plan/:id', rbac('nutrition:read'), validate({ params: uuidParam }), controller.getNutritionPlan);
    router.get('/nutrition-plan/:id/history', rbac('nutrition:read'), validate({ params: uuidParam }), controller.getNutritionPlanHistory);

    // Chat
    router.post('/chat', rbacAny('access_admin_dashboard', 'access_coach_dashboard'), validate({ body: chatSchema }), controller.chat);

    return router;
}

module.exports = aiRoutes;
