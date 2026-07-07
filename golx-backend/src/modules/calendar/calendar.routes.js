const express = require("express");
const { Router } = require("express");
const validate = require("../../middleware/validate.middleware");
const { authMiddleware } = require("../../middleware/auth.middleware");
const { rbac, restrictTo } = require("../../middleware/rbac.middleware");
const { uploadLimiter } = require("../../middleware/rateLimit.middleware");
const schema = require("./calendar.schema");

function adminCalendarRoutes(controller) {
  const router = Router();
  router.use(authMiddleware, rbac("access_admin_dashboard"));

  router.get(
    "/parent-links",
    validate({ query: schema.parentLinkQuery }),
    controller.adminListParentLinks,
  );
  router.post(
    "/parents",
    rbac("manage_teams"),
    validate({ body: schema.parentAccountSchema }),
    controller.adminCreateParentAccount,
  );
  router.post(
    "/parent-links",
    rbac("manage_teams"),
    validate({ body: schema.parentLinkSchema }),
    controller.adminCreateParentLink,
  );
  router.post(
    "/parent-links/qr",
    rbac("manage_teams"),
    validate({ body: schema.parentLinkQrSchema }),
    controller.adminCreateParentLinkByQr,
  );
  router.patch(
    "/parent-links/:parentLinkId",
    rbac("manage_teams"),
    validate({
      params: schema.parentLinkParam,
      body: schema.updateParentLinkSchema,
    }),
    controller.adminUpdateParentLink,
  );
  router.delete(
    "/parent-links/:parentLinkId",
    rbac("manage_teams"),
    validate({ params: schema.parentLinkParam }),
    controller.adminDeleteParentLink,
  );
  router.get(
    "/parent-accounts",
    validate({ query: schema.parentLinkQuery }),
    controller.adminListParentAccounts,
  );
  router.get(
    "/parents/:id/profile",
    validate({ params: schema.idParam }),
    controller.adminGetParentProfile,
  );
  router.get(
    "/parent-linkable-players",
    validate({ query: schema.parentLinkQuery }),
    controller.adminListLinkablePlayers,
  );
  router.get(
    "/players/:id/detail",
    validate({ params: schema.idParam }),
    controller.adminGetPlayerDetail,
  );
  router.get(
    "/ranking-system-inputs",
    validate({ query: schema.rankingSystemInputsQuery }),
    controller.adminRankingSystemInputs,
  );

  router.get(
    "/calendar-events",
    validate({ query: schema.calendarFiltersQuery }),
    controller.adminListCalendarEvents,
  );
  router.post(
    "/calendar-events",
    rbac("manage_schedules"),
    validate({ body: schema.adminCalendarEventSchema }),
    controller.adminCreateCalendarEvent,
  );
  router.get(
    "/calendar-events/:id",
    validate({ params: schema.idParam }),
    controller.adminGetCalendarEvent,
  );
  router.patch(
    "/calendar-events/:id",
    rbac("manage_schedules"),
    validate({
      params: schema.idParam,
      body: schema.updateAdminCalendarEventSchema,
    }),
    controller.adminUpdateCalendarEvent,
  );
  router.delete(
    "/calendar-events/:id/hard-delete-training",
    rbac("manage_schedules"),
    validate({ params: schema.idParam }),
    controller.adminHardDeleteTrainingEvent,
  );
  router.delete(
    "/calendar-events/:id",
    rbac("manage_schedules"),
    validate({ params: schema.idParam }),
    controller.adminDeleteCalendarEvent,
  );

  router.get(
    "/matches",
    validate({ query: schema.adminMatchFiltersQuery }),
    controller.adminListMatches,
  );
  router.post(
    "/matches",
    rbac("manage_schedules"),
    validate({ body: schema.adminMatchSchema }),
    controller.adminCreateMatch,
  );
  router.get(
    "/match-coach-requests",
    validate({ query: schema.paginationQuery }),
    controller.adminListCoachMatchRequests,
  );
  router.post(
    "/match-coach-requests",
    rbac("manage_schedules"),
    validate({ body: schema.adminCoachMatchRequestSchema }),
    controller.adminCreateCoachMatchRequest,
  );
  router.get(
    "/evaluation-edit-requests",
    validate({ query: schema.evaluationEditRequestsQuery }),
    controller.adminListEvaluationEditRequests,
  );
  router.patch(
    "/evaluation-edit-requests/:id/approve",
    rbac("manage_schedules"),
    validate({
      params: schema.idParam,
      body: schema.evaluationEditRequestReviewSchema,
    }),
    controller.adminApproveEvaluationEditRequest,
  );
  router.patch(
    "/evaluation-edit-requests/:id/reject",
    rbac("manage_schedules"),
    validate({
      params: schema.idParam,
      body: schema.evaluationEditRequestReviewSchema,
    }),
    controller.adminRejectEvaluationEditRequest,
  );
  router.get(
    "/matches/:id",
    validate({ params: schema.idParam }),
    controller.adminGetMatch,
  );
  router.patch(
    "/matches/:id",
    rbac("manage_schedules"),
    validate({ params: schema.idParam, body: schema.updateAdminMatchSchema }),
    controller.adminUpdateMatch,
  );
  router.patch(
    "/matches/:id/postpone",
    rbac("manage_schedules"),
    validate({
      params: schema.idParam,
      body: schema.adminPostponeMatchSchema,
    }),
    controller.adminPostponeMatch,
  );
  router.delete(
    "/matches/:id/hard-delete",
    rbac("manage_schedules"),
    validate({ params: schema.idParam }),
    controller.adminHardDeleteMatch,
  );
  router.delete(
    "/matches/:id",
    rbac("manage_schedules"),
    validate({ params: schema.idParam }),
    controller.adminDeleteMatch,
  );
  router.patch(
    "/matches/:id/status",
    rbac("manage_schedules"),
    validate({ params: schema.idParam, body: schema.matchStatusSchema }),
    controller.adminUpdateMatchStatus,
  );

  router.get(
    "/friendly-match-requests",
    validate({ query: schema.paginationQuery }),
    controller.adminListFriendlyRequests,
  );
  router.patch(
    "/friendly-match-requests/:id/approve",
    rbac("manage_schedules"),
    validate({
      params: schema.idParam,
      body: schema.approveFriendlyRequestSchema,
    }),
    controller.adminApproveFriendlyRequest,
  );
  router.patch(
    "/friendly-match-requests/:id/reject",
    rbac("manage_schedules"),
    validate({
      params: schema.idParam,
      body: schema.rejectFriendlyRequestSchema,
    }),
    controller.adminRejectFriendlyRequest,
  );
  router.post(
    "/friendly-match-requests/:id/convert-to-match",
    rbac("manage_schedules"),
    validate({
      params: schema.idParam,
      body: schema.convertFriendlyRequestSchema,
    }),
    controller.adminConvertFriendlyRequest,
  );

  router.get(
    "/reports/attendance",
    validate({ query: schema.calendarFiltersQuery }),
    controller.adminAttendanceReport,
  );
  router.get(
    "/reports/performance",
    validate({ query: schema.calendarFiltersQuery }),
    controller.adminPerformanceReport,
  );

  router.get(
    "/coach-groups",
    validate({ query: schema.paginationQuery }),
    controller.adminListCoachGroups,
  );
  router.post(
    "/coach-groups",
    rbac("manage_teams"),
    validate({ body: schema.coachGroupAssignmentSchema }),
    controller.adminCreateCoachGroup,
  );
  router.patch(
    "/coach-groups/:id",
    rbac("manage_teams"),
    validate({
      params: schema.coachGroupAssignmentParam,
      body: schema.updateCoachGroupAssignmentSchema,
    }),
    controller.adminUpdateCoachGroup,
  );
  router.delete(
    "/coach-groups/:id",
    rbac("manage_teams"),
    validate({ params: schema.coachGroupAssignmentParam }),
    controller.adminDeleteCoachGroup,
  );

  router.get(
    "/player-field-options",
    validate({ query: schema.optionQuery }),
    controller.listPlayerOptions,
  );
  router.post(
    "/player-field-options",
    rbac("manage_academy_settings"),
    validate({ body: schema.optionSchema }),
    controller.adminCreatePlayerOption,
  );
  router.patch(
    "/player-field-options/:optionId",
    rbac("manage_academy_settings"),
    validate({ params: schema.optionParam, body: schema.updateOptionSchema }),
    controller.adminUpdatePlayerOption,
  );
  router.delete(
    "/player-field-options/:optionId",
    rbac("manage_academy_settings"),
    validate({ params: schema.optionParam }),
    controller.adminDeletePlayerOption,
  );

  return router;
}

function coachCalendarRoutes(controller) {
  const router = Router();
  router.use(authMiddleware, restrictTo("coach"));

  router.get(
    "/calendar-events",
    validate({ query: schema.calendarFiltersQuery }),
    controller.coachListCalendarEvents,
  );
  router.get("/permissions", controller.coachGetPermissions);
  router.get("/groups", controller.coachListGroups);
  router.get(
    "/groups/:id/players",
    validate({ params: schema.idParam }),
    controller.coachListGroupPlayers,
  );
  router.get(
    "/players",
    validate({ query: schema.coachPlayersQuery }),
    controller.coachListPlayers,
  );
  router.get(
    "/players/:id",
    validate({ params: schema.idParam }),
    controller.coachGetPlayerDetail,
  );
  router.get(
    "/parent-links",
    validate({ query: schema.parentLinkQuery }),
    controller.coachListParentLinks,
  );
  router.post(
    "/parents",
    validate({ body: schema.parentAccountSchema }),
    controller.coachCreateParentAccount,
  );
  router.post(
    "/parent-links",
    validate({ body: schema.parentLinkSchema }),
    controller.coachCreateParentLink,
  );
  router.post(
    "/parent-links/qr",
    validate({ body: schema.parentLinkQrSchema }),
    controller.coachCreateParentLinkByQr,
  );
  router.patch(
    "/parent-links/:parentLinkId",
    validate({
      params: schema.parentLinkParam,
      body: schema.updateParentLinkSchema,
    }),
    controller.coachUpdateParentLink,
  );
  router.delete(
    "/parent-links/:parentLinkId",
    validate({ params: schema.parentLinkParam }),
    controller.coachDeleteParentLink,
  );
  router.get(
    "/parent-accounts",
    validate({ query: schema.parentLinkQuery }),
    controller.coachListParentAccounts,
  );
  router.get(
    "/parents/:id/profile",
    validate({ params: schema.idParam }),
    controller.coachGetParentProfile,
  );
  router.get(
    "/parent-linkable-players",
    validate({ query: schema.parentLinkQuery }),
    controller.coachListLinkablePlayers,
  );
  router.get(
    "/parent-notes",
    validate({ query: schema.coachParentNotesQuery }),
    controller.coachListParentNotes,
  );
  router.patch(
    "/parent-notes/:noteId/respond",
    validate({
      params: schema.parentNoteParam,
      body: schema.coachParentNoteResponseSchema,
    }),
    controller.coachRespondParentNote,
  );
  router.post(
    "/players",
    validate({ body: schema.coachBasicPlayerSchema }),
    controller.coachCreateBasicPlayer,
  );
  router.patch(
    "/players/:id/complete-profile",
    validate({
      params: schema.idParam,
      body: schema.coachCompletePlayerProfileSchema,
    }),
    controller.coachCompletePlayerProfile,
  );
  router.get(
    "/injury-risk/pain-discomfort",
    controller.coachListInjuryRiskPainDiscomfort,
  );
  router.post(
    "/injury-risk/pain-discomfort",
    validate({ body: schema.injuryRiskPainDiscomfortSchema }),
    controller.coachUpsertInjuryRiskPainDiscomfort,
  );
  router.get(
    "/injury-risk/predictions",
    controller.coachListInjuryRiskPredictions,
  );
  router.post(
    "/injury-risk/predictions/run",
    controller.coachRunInjuryRiskModel,
  );

  router.post(
    "/training-events",
    validate({ body: schema.coachTrainingEventSchema }),
    controller.coachCreateTrainingEvent,
  );
  router.get(
    "/training-events/:id",
    validate({ params: schema.idParam }),
    controller.coachGetTrainingEvent,
  );
  router.patch(
    "/training-events/:id",
    validate({
      params: schema.idParam,
      body: schema.updateCoachTrainingEventSchema,
    }),
    controller.coachUpdateTrainingEvent,
  );
  router.patch(
    "/training-events/:id/status",
    validate({ params: schema.idParam, body: schema.trainingStatusSchema }),
    controller.coachUpdateTrainingEventStatus,
  );
  router.patch(
    "/training-events/:id/extend",
    validate({ params: schema.idParam, body: schema.trainingExtendSchema }),
    controller.coachExtendTrainingEvent,
  );

  router.post(
    "/events/:eventId/attendance",
    validate({
      params: schema.eventParam,
      body: schema.attendanceRecordsSchema,
    }),
    controller.coachUpsertEventAttendance,
  );
  router.post(
    "/events/:eventId/attendance/qr-scan",
    validate({
      params: schema.eventParam,
      body: schema.attendanceQrScanSchema,
    }),
    controller.coachScanEventAttendanceQr,
  );
  router.patch(
    "/events/:eventId/attendance/:playerId",
    validate({
      params: schema.eventPlayerParam,
      body: schema.updateEventAttendanceSchema,
    }),
    controller.coachUpdateEventAttendance,
  );
  router.post(
    "/events/:eventId/evaluations",
    validate({
      params: schema.eventParam,
      body: schema.evaluationRecordsSchema,
    }),
    controller.coachUpsertEventEvaluations,
  );
  router.patch(
    "/evaluations/:id",
    validate({
      params: schema.evaluationParam,
      body: schema.updateEvaluationSchema,
    }),
    controller.coachUpdateEvaluation,
  );
  router.get(
    "/ranking-system-inputs",
    validate({ query: schema.rankingSystemInputsQuery }),
    controller.coachRankingSystemInputs,
  );

  router.get(
    "/matches",
    validate({ query: schema.adminMatchFiltersQuery }),
    controller.coachListMatches,
  );
  router.get(
    "/match-requests",
    validate({ query: schema.paginationQuery }),
    controller.coachListAdminMatchRequests,
  );
  router.post(
    "/match-requests/:id/accept",
    validate({
      params: schema.idParam,
      body: schema.coachResolveAdminMatchRequestSchema,
    }),
    controller.coachAcceptAdminMatchRequest,
  );
  router.get(
    "/matches/:matchId",
    validate({ params: schema.matchParam }),
    controller.coachGetMatch,
  );
  router.post(
    "/matches/:matchId/evaluation-edit-requests",
    validate({
      params: schema.matchParam,
      body: schema.evaluationEditRequestSchema,
    }),
    controller.coachRequestMatchEvaluationEdit,
  );
  router.post(
    "/matches/:matchId/squad",
    validate({ params: schema.matchParam, body: schema.squadSchema }),
    controller.coachUpsertMatchSquad,
  );
  router.patch(
    "/matches/:matchId/squad/:playerId",
    validate({
      params: schema.squadPlayerParam,
      body: schema.updateSquadSchema,
    }),
    controller.coachUpdateMatchSquad,
  );
  router.delete(
    "/matches/:matchId/squad/:playerId",
    validate({ params: schema.squadPlayerParam }),
    controller.coachDeleteMatchSquad,
  );
  router.patch(
    "/matches/:matchId/targets",
    validate({ params: schema.matchParam, body: schema.matchTargetSchema }),
    controller.coachUpdateMatchTargets,
  );
  router.post(
    "/matches/:matchId/tactics",
    validate({ params: schema.matchParam, body: schema.tacticsSchema }),
    controller.coachUpsertMatchTactics,
  );
  router.patch(
    "/matches/:matchId/tactics",
    validate({
      params: schema.matchParam,
      body: schema.tacticsSchema.partial(),
    }),
    controller.coachUpsertMatchTactics,
  );
  router.patch(
    "/matches/:matchId/live-status",
    validate({
      params: schema.matchParam,
      body: schema.matchLiveStatusUpdateSchema,
    }),
    controller.coachUpdateMatchLiveStatus,
  );
  router.post(
    "/matches/:matchId/incidents",
    validate({ params: schema.matchParam, body: schema.matchIncidentSchema }),
    controller.coachRecordMatchIncident,
  );
  router.post(
    "/matches/:matchId/goals",
    validate({ params: schema.matchParam, body: schema.matchGoalSchema }),
    controller.coachRecordMatchGoal,
  );
  router.post(
    "/matches/:matchId/substitutions",
    validate({
      params: schema.matchParam,
      body: schema.matchSubstitutionSchema,
    }),
    controller.coachRecordMatchSubstitution,
  );
  router.delete(
    "/matches/:matchId/substitutions/:substitutionId",
    validate({ params: schema.matchSubstitutionParam }),
    controller.coachDeleteMatchSubstitution,
  );
  router.delete(
    "/matches/:matchId/goals/:goalId",
    validate({ params: schema.matchGoalParam }),
    controller.coachDeleteMatchGoal,
  );
  router.delete(
    "/matches/:matchId/incidents/:incidentId",
    validate({ params: schema.matchIncidentParam }),
    controller.coachDeleteMatchIncident,
  );
  router.post(
    "/matches/:matchId/attendance",
    validate({
      params: schema.matchParam,
      body: schema.matchAttendanceRecordsSchema,
    }),
    controller.coachUpsertMatchAttendance,
  );
  router.post(
    "/matches/:matchId/attendance/qr-scan",
    validate({
      params: schema.matchParam,
      body: schema.attendanceQrScanSchema,
    }),
    controller.coachScanMatchAttendanceQr,
  );
  router.post(
    "/matches/:matchId/player-stats",
    validate({ params: schema.matchParam, body: schema.playerStatsSchema }),
    controller.coachUpsertPlayerStats,
  );
  router.patch(
    "/matches/:matchId/player-stats/:playerId",
    validate({
      params: schema.statsPlayerParam,
      body: schema.updatePlayerStatsSchema,
    }),
    controller.coachUpdatePlayerStats,
  );

  router.post(
    "/friendly-match-requests",
    controller.coachCreateFriendlyRequest,
  );
  router.get(
    "/friendly-match-requests",
    validate({ query: schema.paginationQuery }),
    controller.coachListFriendlyRequests,
  );

  router.get(
    "/player-field-options",
    validate({ query: schema.optionQuery }),
    controller.listPlayerOptions,
  );
  router.post(
    "/player-field-options",
    validate({ body: schema.optionSchema }),
    controller.coachCreatePlayerOption,
  );
  router.patch(
    "/player-field-options/:optionId",
    validate({ params: schema.optionParam, body: schema.updateOptionSchema }),
    controller.coachUpdatePlayerOption,
  );
  router.delete(
    "/player-field-options/:optionId",
    validate({ params: schema.optionParam }),
    controller.coachDeletePlayerOption,
  );

  router.get(
    "/players/:id/progress",
    validate({ params: schema.idParam }),
    controller.coachGetPlayerProgress,
  );

  return router;
}

function playerCalendarRoutes(controller) {
  const router = Router();
  const assignmentUpload = express.raw({
    type: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ],
    limit: "25mb",
  });
  router.use(authMiddleware, restrictTo("player"));

  router.get(
    "/calendar-events",
    validate({ query: schema.calendarFiltersQuery }),
    controller.playerListCalendarEvents,
  );
  router.get("/profile", controller.playerGetProfile);
  router.get("/attendance-qr", controller.playerGetAttendanceQr);
  router.get(
    "/matches",
    validate({ query: schema.adminMatchFiltersQuery }),
    controller.playerListMatches,
  );
  router.get(
    "/matches/:id",
    validate({ params: schema.playerMatchParam }),
    controller.playerGetMatch,
  );
  router.get(
    "/matches/:id/my-stats",
    validate({ params: schema.playerMatchParam }),
    controller.playerGetMatchStats,
  );
  router.get(
    "/trainings",
    validate({ query: schema.calendarFiltersQuery }),
    controller.playerListTrainings,
  );
  router.get(
    "/attendance",
    validate({ query: schema.paginationQuery }),
    controller.playerAttendanceHistory,
  );
  router.get(
    "/evaluations",
    validate({ query: schema.paginationQuery }),
    controller.playerEvaluations,
  );
  router.get(
    "/ranking-system-inputs",
    validate({ query: schema.rankingSystemInputsQuery }),
    controller.playerRankingSystemInputs,
  );
  router.get("/progress", controller.playerProgress);
  router.get(
    "/parent-notes",
    validate({ query: schema.parentNotesQuery }),
    controller.playerListParentNotes,
  );
  router.get(
    "/assignments",
    validate({ query: schema.paginationQuery }),
    controller.playerListAssignments,
  );
  router.post(
    "/assignments/upload",
    uploadLimiter,
    assignmentUpload,
    controller.playerUploadAssignmentFile,
  );
  router.post(
    "/assignments/daily-ai",
    validate({ body: schema.dailyAiInputSchema }),
    controller.playerSubmitDailyAiInput,
  );
  router.post(
    "/assignments/:id/submit",
    validate({
      params: schema.playerAssignmentParam,
      body: schema.playerAssignmentSubmitSchema,
    }),
    controller.playerSubmitAssignment,
  );

  return router;
}

function parentCalendarRoutes(controller) {
  const router = Router();
  router.use(authMiddleware, restrictTo("parent"));

  router.get("/children", controller.parentListChildren);
  router.get(
    "/dashboard",
    validate({ query: schema.parentDashboardQuery }),
    controller.parentDashboard,
  );
  router.get(
    "/ranking-system-inputs",
    validate({ query: schema.parentRankingSystemInputsQuery }),
    controller.parentRankingSystemInputs,
  );
  router.get(
    "/children/:childId/calendar-events",
    validate({ params: schema.childParam, query: schema.calendarFiltersQuery }),
    controller.parentListCalendarEvents,
  );
  router.get(
    "/children/:childId/matches",
    validate({
      params: schema.childParam,
      query: schema.adminMatchFiltersQuery,
    }),
    controller.parentListMatches,
  );
  router.get(
    "/children/:childId/matches/:matchId",
    validate({ params: schema.childMatchParam }),
    controller.parentGetMatch,
  );
  router.get(
    "/children/:childId/matches/:matchId/stats",
    validate({ params: schema.childMatchParam }),
    controller.parentGetMatchStats,
  );
  router.get(
    "/children/:childId/trainings",
    validate({ params: schema.childParam, query: schema.calendarFiltersQuery }),
    controller.parentListTrainings,
  );
  router.get(
    "/children/:childId/attendance",
    validate({ params: schema.childParam, query: schema.paginationQuery }),
    controller.parentAttendanceHistory,
  );
  router.get(
    "/children/:childId/evaluations",
    validate({ params: schema.childParam, query: schema.paginationQuery }),
    controller.parentEvaluations,
  );
  router.get(
    "/children/:childId/measurements",
    validate({ params: schema.childParam, query: schema.paginationQuery }),
    controller.parentMeasurements,
  );
  router.get(
    "/children/:childId/payments",
    validate({ params: schema.childParam }),
    controller.parentPayments,
  );
  router.get(
    "/children/:childId/weekly-report",
    validate({ params: schema.childParam }),
    controller.parentWeeklyReport,
  );
  router.get(
    "/children/:childId/notes",
    validate({ params: schema.childParam, query: schema.parentNotesQuery }),
    controller.parentListNotes,
  );
  router.post(
    "/children/:childId/notes",
    validate({ params: schema.childParam, body: schema.parentNoteSchema }),
    controller.parentCreateNote,
  );
  router.get(
    "/children/:childId/progress",
    validate({ params: schema.childParam }),
    controller.parentProgress,
  );

  return router;
}

module.exports = {
  adminCalendarRoutes,
  coachCalendarRoutes,
  playerCalendarRoutes,
  parentCalendarRoutes,
};
