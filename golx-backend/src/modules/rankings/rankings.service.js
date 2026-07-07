const eventBus = require('../../events/eventBus');
const RANKINGS_EVENTS = require('./rankings.events');
const { NotFoundError } = require('../../shared/errors');

class RankingsService {
    constructor(rankingsRepository, rankingsQueue) {
        this.repo = rankingsRepository;
        this.queue = rankingsQueue;
    }

    // ─── Period helpers ─────────────────────────────────────────────────
    _currentWeekPeriod() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }

    _currentMonthPeriod() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    // ─── Rankings ───────────────────────────────────────────────────────
    async getWeeklyRankings(academyId, filters) {
        const period = filters.period || this._currentWeekPeriod();
        return this.repo.findRankings(period, { ...filters, academyId });
    }

    async getMonthlyRankings(academyId, filters) {
        const period = filters.period || this._currentMonthPeriod();
        return this.repo.findRankingsByMonthPrefix(period, { ...filters, academyId });
    }

    async getPlayerRankings(playerId, academyId, pagination) {
        const owned = await this.repo.verifyPlayerOwnership(playerId, academyId);
        if (!owned) throw new NotFoundError('Player', playerId);
        return this.repo.findPlayerRankings(playerId, pagination);
    }

    async requestRecalculate(academyId, groupId, periodType) {
        // Verify the group belongs to the requesting academy before queuing
        const group = await this.repo.verifyGroupOwnership(groupId, academyId);
        if (!group) throw new NotFoundError('Group', groupId);

        // Queue the recalculation job to BullMQ
        await this.queue.add(`recalculate-${periodType}`, {
            groupId,
            periodType,
        });

        eventBus.publish(RANKINGS_EVENTS.RECALCULATE_REQUESTED, { groupId, periodType });

        return { message: `${periodType} ranking recalculation queued for group ${groupId}` };
    }

    // ─── Evaluations ───────────────────────────────────────────────────
    async getPlayerEvaluations(playerId, academyId, pagination) {
        const owned = await this.repo.verifyPlayerOwnership(playerId, academyId);
        if (!owned) throw new NotFoundError('Player', playerId);
        return this.repo.findEvaluationsByPlayer(playerId, pagination);
    }

    async createEvaluation(coachId, academyId, data) {
        // Verify the player being evaluated belongs to the requesting academy
        const owned = await this.repo.verifyPlayerOwnership(data.playerId, academyId);
        if (!owned) throw new NotFoundError('Player', data.playerId);
        const evaluation = await this.repo.createEvaluation({
            player_id: data.playerId,
            coach_id: coachId,
            session_id: data.sessionId || null,
            technical_score: data.technicalScore,
            physical_score: data.physicalScore,
            tactical_score: data.tacticalScore,
            discipline_score: data.disciplineScore,
            notes: data.notes,
        });

        eventBus.publish(RANKINGS_EVENTS.EVALUATION_CREATED, {
            evaluationId: evaluation.id,
            playerId: data.playerId,
            coachId,
        });

        return evaluation;
    }

    // ─── Matches ────────────────────────────────────────────────────────
    async getMatches(groupId, pagination) {
        return this.repo.findMatches(groupId, pagination);
    }

    async createMatch(academyId, data) {
        // Verify the group belongs to the requesting academy before allowing match creation
        const group = await this.repo.verifyGroupOwnership(data.groupId, academyId);
        if (!group) throw new NotFoundError('Group', data.groupId);
        const match = await this.repo.createMatch({
            group_id: data.groupId,
            session_id: data.sessionId || null,
            opponent_name: data.opponentName,
            match_date: data.matchDate,
            location: data.location,
            our_score: data.ourScore,
            opponent_score: data.opponentScore,
            notes: data.notes,
        });

        eventBus.publish(RANKINGS_EVENTS.MATCH_RECORDED, {
            matchId: match.id,
            groupId: data.groupId,
        });

        return match;
    }

    async addPlayerMatchStats(academyId, data) {
        // Verify both the match and player belong to the requesting academy
        const matchOwned = await this.repo.verifyMatchOwnership(data.matchId, academyId);
        if (!matchOwned) throw new NotFoundError('Match', data.matchId);
        const playerOwned = await this.repo.verifyPlayerOwnership(data.playerId, academyId);
        if (!playerOwned) throw new NotFoundError('Player', data.playerId);
        return this.repo.createPlayerMatchStats({
            match_id: data.matchId,
            player_id: data.playerId,
            played_minutes: data.playedMinutes,
            goals: data.goals,
            assists: data.assists,
            yellow_cards: data.yellowCards,
            red_cards: data.redCards,
            performance_rating: data.performanceRating,
        });
    }

    async getPlayerMatchStats(playerId) {
        return this.repo.findPlayerMatchStats(playerId);
    }
}

module.exports = RankingsService;
