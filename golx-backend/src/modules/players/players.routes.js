const { Router } = require("express");
const multer = require("multer");
const validate = require("../../middleware/validate.middleware");
const { authMiddleware } = require("../../middleware/auth.middleware");
const { rbac, rbacAny } = require("../../middleware/rbac.middleware");
const { uploadLimiter } = require("../../middleware/rateLimit.middleware");
const { BadRequestError } = require("../../shared/errors");
const {
  uuidParam,
  createPlayerSchema,
  updatePlayerSchema,
  listPlayersQuery,
  addMeasurementSchema,
  addInjurySchema,
} = require("./players.schema");

function playersRoutes(controller) {
  const router = Router();
  const excelUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
      const allowedMimeTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
        "application/octet-stream",
      ];
      const isXlsx = file.originalname.toLowerCase().endsWith(".xlsx");
      if (isXlsx && allowedMimeTypes.includes(file.mimetype)) {
        callback(null, true);
        return;
      }
      callback(new BadRequestError("Player import files must be XLSX workbooks."));
    },
  }).single("file");
  const handleExcelUpload = (req, res, next) => {
    excelUpload(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        return next(
          new BadRequestError(
            error.code === "LIMIT_FILE_SIZE"
              ? "Player import files must be 10MB or smaller."
              : error.message,
          ),
        );
      }
      return next(error);
    });
  };

  router.use(authMiddleware);

  router.get(
    "/",
    rbac("players:read"),
    validate({ query: listPlayersQuery }),
    controller.list,
  );
  router.post(
    "/",
    rbacAny("manage_players", "manage_training_sessions"),
    validate({ body: createPlayerSchema }),
    controller.create,
  );
  router.get(
    "/import/template",
    rbacAny("manage_players", "manage_training_sessions"),
    controller.downloadImportTemplate,
  );
  router.get(
    "/export",
    rbacAny("manage_players", "manage_training_sessions"),
    controller.exportPlayers,
  );
  router.post(
    "/import/validate",
    uploadLimiter,
    rbacAny("manage_players", "manage_training_sessions"),
    handleExcelUpload,
    controller.validateImport,
  );
  router.post(
    "/import",
    uploadLimiter,
    rbacAny("manage_players", "manage_training_sessions"),
    handleExcelUpload,
    controller.importPlayers,
  );
  router.get(
    "/:id",
    rbac("players:read"),
    validate({ params: uuidParam }),
    controller.getById,
  );
  router.put(
    "/:id",
    rbac("players:write"),
    validate({ params: uuidParam, body: updatePlayerSchema }),
    controller.update,
  );
  router.delete(
    "/:id/hard-delete",
    rbac("manage_players"),
    validate({ params: uuidParam }),
    controller.hardRemove,
  );
  router.delete(
    "/:id",
    rbac("manage_players"),
    validate({ params: uuidParam }),
    controller.remove,
  );

  router.get(
    "/:id/summary",
    rbac("players:read"),
    validate({ params: uuidParam }),
    controller.getSummary,
  );

  // Measurements
  router.get(
    "/:id/measurements",
    rbac("measurements:read"),
    validate({ params: uuidParam }),
    controller.getMeasurements,
  );
  router.post(
    "/:id/measurements",
    rbac("measurements:write"),
    validate({ params: uuidParam, body: addMeasurementSchema }),
    controller.addMeasurement,
  );

  // Injuries
  router.get(
    "/:id/injuries",
    rbac("players:read"),
    validate({ params: uuidParam }),
    controller.getInjuries,
  );
  router.post(
    "/:id/injuries",
    rbac("players:write"),
    validate({ params: uuidParam, body: addInjurySchema }),
    controller.addInjury,
  );

  return router;
}

module.exports = playersRoutes;
