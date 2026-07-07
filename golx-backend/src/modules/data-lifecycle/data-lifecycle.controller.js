const ApiResponse = require("../../shared/api-response");

class DataLifecycleController {
  constructor(dataLifecycleService) {
    this.service = dataLifecycleService;
  }

  status = async (_req, res, next) => {
    try {
      res.json(ApiResponse.success(await this.service.status()));
    } catch (err) {
      next(err);
    }
  };

  run = async (req, res, next) => {
    try {
      const result = await this.service.runLifecycle({
        triggeredByUserId: req.user?.userId || null,
        dryRun: req.body?.dryRun === true,
      });
      res.status(202).json(ApiResponse.success(result));
    } catch (err) {
      next(err);
    }
  };
}

module.exports = DataLifecycleController;
