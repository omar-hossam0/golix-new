const eventBus = require('../../events/eventBus');
const AI_EVENTS = require('./ai.events');
const { ForbiddenError, NotFoundError } = require('../../shared/errors');
const { auditAccessDenied } = require('../../shared/access-audit');
const { canAccessAiInsight } = require('../../shared/access-policy');

class AiService {
    constructor(aiRepository, aiQueue) {
        this.repo = aiRepository;
        this.queue = aiQueue;
    }

    async _assertAiPlayerOwnership(playerId, academyId, user, action) {
        const player = await this.repo.verifyPlayerOwnership(playerId, academyId);
        if (!player) {
            await auditAccessDenied(this.repo.db, user, {
                action: action || 'ai_player_access_denied',
                entityType: 'player_profiles',
                entityId: playerId,
                reason: 'academy_ownership_failed',
            });
            throw new NotFoundError('Player', playerId);
        }

        if (!user) return player;

        let coachCanAccess = false;
        let parentCanAccess = false;

        if (user.role === 'coach') {
            const coach = await this.repo.findCoachProfileByUserId(user.userId, academyId);
            coachCanAccess = coach ? Boolean(await this.repo.coachCanAccessPlayer(coach.id, playerId)) : false;
        }

        if (user.role === 'parent') {
            const child = await this.repo.findParentLinkedPlayer(user.userId, playerId, academyId);
            parentCanAccess = Boolean(child && child.can_view_progress !== false);
        }

        if (canAccessAiInsight(user, player, { coachCanAccess, parentCanAccess })) {
            return player;
        }

        await auditAccessDenied(this.repo.db, user, {
            action: action || 'ai_player_access_denied',
            entityType: 'player_profiles',
            entityId: playerId,
            reason: 'ai_policy_denied',
        });
        throw new ForbiddenError('You cannot access AI insights for this player');
    }

    // ─── Performance Score ──────────────────────────────────────────────
    async getPerformanceScore(playerId, academyId, user = null) {
        await this._assertAiPlayerOwnership(playerId, academyId, user, 'ai_performance_access_denied');
        const score = await this.repo.getAiScore(playerId);
        if (!score) throw new NotFoundError('AI Score', playerId);
        return score;
    }

    async calculatePerformanceScore(playerId, academyId, user = null) {
        await this._assertAiPlayerOwnership(playerId, academyId, user, 'ai_performance_calculate_denied');
        await this.queue.add('calculate-performance', { playerId });
        return { message: 'Performance score calculation queued', playerId };
    }

    async getAllScores(academyId, pagination, user = null) {
        if (!user || user.role === 'admin') {
            return this.repo.getAiScores(academyId, pagination);
        }

        if (user.role === 'coach') {
            const coach = await this.repo.findCoachProfileByUserId(user.userId, academyId);
            if (!coach) throw new ForbiddenError('Coach profile is not linked to this user');
            return this.repo.getAiScoresForCoach(academyId, coach.id, pagination);
        }

        if (user.role === 'player') {
            return this.repo.getAiScoresForPlayer(academyId, user.userId, pagination);
        }

        if (user.role === 'parent') {
            return this.repo.getAiScoresForParent(academyId, user.userId, pagination);
        }

        throw new ForbiddenError('Unsupported role');
    }

    // Called by worker after AI processing
    async savePerformanceScore(playerId, score, breakdown) {
        const result = await this.repo.upsertAiScore(playerId, score, breakdown);

        eventBus.publish(AI_EVENTS.PERFORMANCE_SCORE_CALCULATED, {
            playerId,
            score,
        });

        return result;
    }

    // ─── Injury Risk Assessment ─────────────────────────────────────────
    async assessInjuryRisk(playerId, academyId, user = null) {
        await this._assertAiPlayerOwnership(playerId, academyId, user, 'ai_injury_risk_assess_denied');
        await this.queue.add('assess-injury-risk', { playerId });
        return { message: 'Injury risk assessment queued', playerId };
    }

    async getInjuryRisk(playerId, academyId, user = null) {
        await this._assertAiPlayerOwnership(playerId, academyId, user, 'ai_injury_risk_access_denied');
        const risk = await this.repo.getLatestInjuryRisk(playerId);
        if (!risk) throw new NotFoundError('Injury Risk Assessment', playerId);
        return risk;
    }

    async getInjuryRiskHistory(playerId, academyId, user = null, options = {}) {
        await this._assertAiPlayerOwnership(playerId, academyId, user, 'ai_injury_risk_history_denied');
        return this.repo.getInjuryRisks(playerId, options);
    }

    // Called by worker
    async saveInjuryRisk(playerId, data) {
        const assessment = await this.repo.createInjuryRisk({
            player_id: playerId,
            risk_level: data.riskLevel,
            factors: JSON.stringify(data.factors || []),
            recommendations: JSON.stringify(data.recommendations || []),
            assessed_at: new Date(),
        });

        eventBus.publish(AI_EVENTS.INJURY_RISK_ASSESSED, {
            playerId,
            riskLevel: data.riskLevel,
        });

        return assessment;
    }

    // ─── Nutrition Plan ─────────────────────────────────────────────────
    async generateNutritionPlan(playerId, academyId, options, user = null) {
        await this._assertAiPlayerOwnership(playerId, academyId, user, 'ai_nutrition_generate_denied');
        await this.queue.add('generate-nutrition-plan', { playerId, ...options });
        return { message: 'Nutrition plan generation queued', playerId };
    }

    async getNutritionPlan(playerId, academyId, user = null) {
        await this._assertAiPlayerOwnership(playerId, academyId, user, 'ai_nutrition_access_denied');
        const plan = await this.repo.getLatestNutritionPlan(playerId);
        if (!plan) throw new NotFoundError('Nutrition Plan', playerId);
        return plan;
    }

    async getNutritionPlanHistory(playerId, academyId, user = null) {
        await this._assertAiPlayerOwnership(playerId, academyId, user, 'ai_nutrition_history_denied');
        return this.repo.getNutritionPlans(playerId);
    }

    // Called by worker
    async saveNutritionPlan(playerId, data) {
        const plan = await this.repo.createNutritionPlan({
            player_id: playerId,
            plan_data: JSON.stringify(data.planData),
            goals: JSON.stringify(data.goals || []),
            restrictions: JSON.stringify(data.restrictions || []),
        });

        eventBus.publish(AI_EVENTS.NUTRITION_PLAN_GENERATED, {
            playerId,
            planId: plan.id,
        });

        return plan;
    }

    // ─── Chat ───────────────────────────────────────────────────────────
    async chat(userId, prompt, context) {
        // Queue the AI chat job; for now return placeholder
        await this.queue.add('ai-chat', { userId, prompt, context });

        eventBus.publish(AI_EVENTS.CHAT_RESPONSE_GENERATED, {
            userId,
            prompt: prompt.slice(0, 100),
        });

        return { message: 'AI chat response is being generated', queued: true };
    }
}

module.exports = AiService;
