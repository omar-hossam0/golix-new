const ApiResponse = require("../../shared/api-response");
const {
  parsePagination,
  buildPaginationMeta,
} = require("../../shared/pagination");

class AiController {
  constructor(aiService) {
    this.service = aiService;
  }

  // Performance Score
  getPerformanceScore = async (req, res, next) => {
    try {
      const score = await this.service.getPerformanceScore(
        req.params.id,
        req.user.academyId,
        req.user,
      );
      res.json(ApiResponse.success(score));
    } catch (err) {
      next(err);
    }
  };

  calculatePerformanceScore = async (req, res, next) => {
    try {
      const result = await this.service.calculatePerformanceScore(
        req.body.playerId,
        req.user.academyId,
        req.user,
      );
      res.status(202).json(ApiResponse.success(result));
    } catch (err) {
      next(err);
    }
  };

  getAllScores = async (req, res, next) => {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await this.service.getAllScores(
        req.user.academyId,
        { page, limit },
        req.user,
      );
      res.json(
        ApiResponse.paginated(
          result.data,
          buildPaginationMeta(result.total, page, limit),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  // Injury Risk
  assessInjuryRisk = async (req, res, next) => {
    try {
      const result = await this.service.assessInjuryRisk(
        req.body.playerId,
        req.user.academyId,
        req.user,
      );
      res.status(202).json(ApiResponse.success(result));
    } catch (err) {
      next(err);
    }
  };

  getInjuryRisk = async (req, res, next) => {
    try {
      const risk = await this.service.getInjuryRisk(
        req.params.id,
        req.user.academyId,
        req.user,
      );
      res.json(ApiResponse.success(risk));
    } catch (err) {
      next(err);
    }
  };

  getInjuryRiskHistory = async (req, res, next) => {
    try {
      const risks = await this.service.getInjuryRiskHistory(
        req.params.id,
        req.user.academyId,
        req.user,
        {
          includeArchive:
            req.query.includeArchive === true ||
            req.query.includeArchive === "true",
        },
      );
      res.json(ApiResponse.success(risks));
    } catch (err) {
      next(err);
    }
  };

  // Nutrition Plan
  generateNutritionPlan = async (req, res, next) => {
    try {
      const result = await this.service.generateNutritionPlan(
        req.body.playerId,
        req.user.academyId,
        req.body,
        req.user,
      );
      res.status(202).json(ApiResponse.success(result));
    } catch (err) {
      next(err);
    }
  };

  getNutritionPlan = async (req, res, next) => {
    try {
      const plan = await this.service.getNutritionPlan(
        req.params.id,
        req.user.academyId,
        req.user,
      );
      res.json(ApiResponse.success(plan));
    } catch (err) {
      next(err);
    }
  };

  getNutritionPlanHistory = async (req, res, next) => {
    try {
      const plans = await this.service.getNutritionPlanHistory(
        req.params.id,
        req.user.academyId,
        req.user,
      );
      res.json(ApiResponse.success(plans));
    } catch (err) {
      next(err);
    }
  };

  // Chat
  chat = async (req, res, next) => {
    try {
      const result = await this.service.chat(
        req.user.userId,
        req.body.prompt,
        req.body.context,
      );
      res.status(202).json(ApiResponse.success(result));
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AiController;
