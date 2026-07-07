const authRoutes = require("../modules/auth/auth.routes");
const academyRoutes = require("../modules/academy/academy.routes");
const playersRoutes = require("../modules/players/players.routes");
const coachesRoutes = require("../modules/coaches/coaches.routes");
const attendanceRoutes = require("../modules/attendance/attendance.routes");
const rankingsRoutes = require("../modules/rankings/rankings.routes");
const paymentsRoutes = require("../modules/payments/payments.routes");
const notificationsRoutes = require("../modules/notifications/notifications.routes");
const aiRoutes = require("../modules/ai/ai.routes");
const adminRoutes = require("../modules/admin/admin.routes");
const customDataRoutes = require("../modules/custom-data/custom-data.routes");
const chatRoutes = require("../modules/chat/chat.routes");
const dataLifecycleRoutes = require("../modules/data-lifecycle/data-lifecycle.routes");
const {
  adminCalendarRoutes,
  coachCalendarRoutes,
  playerCalendarRoutes,
  parentCalendarRoutes,
} = require("../modules/calendar/calendar.routes");

function mountApplicationRoutes(app, controllers) {
  const {
    authController,
    academyController,
    playersController,
    coachesController,
    attendanceController,
    rankingsController,
    paymentsController,
    notificationsController,
    aiController,
    adminController,
    calendarController,
    customDataController,
    chatController,
    dataLifecycleController,
  } = controllers;

  app.use("/api/v1/auth", authRoutes(authController));
  app.use("/api/v1/academy", academyRoutes(academyController));
  app.use("/api/v1/players", playersRoutes(playersController));
  app.use("/api/v1/coaches", coachesRoutes(coachesController));
  app.use("/api/v1/attendance", attendanceRoutes(attendanceController));
  app.use("/api/v1/rankings", rankingsRoutes(rankingsController));
  app.use("/api/v1/payments", paymentsRoutes(paymentsController));
  app.use(
    "/api/v1/notifications",
    notificationsRoutes(notificationsController),
  );
  app.use("/api/v1/ai", aiRoutes(aiController));
  app.use("/api/v1/chat", chatRoutes(chatController));
  app.use("/api/v1/admin", adminRoutes(adminController));
  app.use(
    "/api/v1/admin/data-lifecycle",
    dataLifecycleRoutes(dataLifecycleController),
  );
  app.use("/api/v1/admin", adminCalendarRoutes(calendarController));
  app.use("/api/v1/admin", customDataRoutes(customDataController, "admin"));
  app.use("/api/v1/coach", coachCalendarRoutes(calendarController));
  app.use("/api/v1/coach", customDataRoutes(customDataController, "coach"));
  app.use("/api/v1/player", playerCalendarRoutes(calendarController));
  app.use("/api/v1/parent", parentCalendarRoutes(calendarController));
}

module.exports = { mountApplicationRoutes };
