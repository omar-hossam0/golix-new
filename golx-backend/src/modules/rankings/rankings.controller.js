const ApiResponse = require('../../shared/api-response');
const { parsePagination, buildPaginationMeta } = require('../../shared/pagination');

class RankingsController {
    constructor(rankingsService) {
        this.service = rankingsService;
    }

    getWeekly = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const { groupId } = req.query;
            const result = await this.service.getWeeklyRankings(req.user.academyId, { groupId, page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    getMonthly = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const { groupId } = req.query;
            const result = await this.service.getMonthlyRankings(req.user.academyId, { groupId, page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    getPlayerRankings = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getPlayerRankings(req.params.id, req.user.academyId, { page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    recalculate = async (req, res, next) => {
        try {
            const result = await this.service.requestRecalculate(req.user.academyId, req.body.groupId, req.body.periodType);
            res.json(ApiResponse.success(result));
        } catch (err) { next(err); }
    };

    // ─── Evaluations ───────────────────────────────────────────────────
    createEvaluation = async (req, res, next) => {
        try {
            const evaluation = await this.service.createEvaluation(req.user.userId, req.user.academyId, req.body);
            res.status(201).json(ApiResponse.success(evaluation));
        } catch (err) { next(err); }
    };

    getPlayerEvaluations = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getPlayerEvaluations(req.params.id, req.user.academyId, { page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    // ─── Matches ────────────────────────────────────────────────────────
    createMatch = async (req, res, next) => {
        try {
            const match = await this.service.createMatch(req.user.academyId, req.body);
            res.status(201).json(ApiResponse.success(match));
        } catch (err) { next(err); }
    };

    addPlayerStats = async (req, res, next) => {
        try {
            const stats = await this.service.addPlayerMatchStats(req.user.academyId, req.body);
            res.status(201).json(ApiResponse.success(stats));
        } catch (err) { next(err); }
    };
}

module.exports = RankingsController;
