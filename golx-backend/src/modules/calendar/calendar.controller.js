const ApiResponse = require("../../shared/api-response");
const {
  parsePagination,
  buildPaginationMeta,
} = require("../../shared/pagination");

class CalendarController {
  constructor(calendarService) {
    this.service = calendarService;
  }

  _sendPage(res, result, page, limit) {
    res.json(
      ApiResponse.paginated(
        result.data,
        buildPaginationMeta(result.total, page, limit),
      ),
    );
  }

  _pagination(req) {
    return parsePagination(req.query);
  }

  adminListParentLinks = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.adminListParentLinks(req.user.academyId, {
        ...req.query,
        page,
        limit,
      });
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  adminListParentAccounts = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.adminListParentAccounts(req.user.academyId, {
        ...req.query,
        page,
        limit,
      });
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  adminListLinkablePlayers = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.adminListLinkablePlayers(req.user.academyId, {
        ...req.query,
        page,
        limit,
      });
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  adminGetParentProfile = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminGetParentProfile(
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminCreateParentAccount = async (req, res, next) => {
    try {
      res.status(201).json(
        ApiResponse.success(
          await this.service.adminCreateParentAccount(
            req.user.academyId,
            req.user.userId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminCreateParentLink = async (req, res, next) => {
    try {
      res.status(201).json(
        ApiResponse.success(
          await this.service.adminCreateParentLink(
            req.user.academyId,
            req.user.userId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminCreateParentLinkByQr = async (req, res, next) => {
    try {
      res.status(201).json(
        ApiResponse.success(
          await this.service.adminCreateParentLinkByQr(
            req.user.academyId,
            req.user.userId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminUpdateParentLink = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminUpdateParentLink(
            req.user.academyId,
            req.params.parentLinkId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminDeleteParentLink = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminDeleteParentLink(
            req.user.academyId,
            req.params.parentLinkId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminGetPlayerDetail = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminGetPlayerDetail(
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminListCalendarEvents = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.adminListCalendarEvents(
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  adminCreateCalendarEvent = async (req, res, next) => {
    try {
      const data = await this.service.adminCreateCalendarEvent(
        req.user.academyId,
        req.user.userId,
        req.body,
      );
      res.status(201).json(ApiResponse.success(data));
    } catch (err) {
      next(err);
    }
  };

  adminGetCalendarEvent = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminGetCalendarEvent(
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminUpdateCalendarEvent = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminUpdateCalendarEvent(
            req.user.academyId,
            req.params.id,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminDeleteCalendarEvent = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminDeleteCalendarEvent(
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminHardDeleteTrainingEvent = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminHardDeleteTrainingEvent(
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminListMatches = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.adminListMatches(req.user.academyId, {
        ...req.query,
        page,
        limit,
      });
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  adminCreateMatch = async (req, res, next) => {
    try {
      const data = await this.service.adminCreateMatch(
        req.user.academyId,
        req.user.userId,
        req.body,
      );
      res.status(201).json(ApiResponse.success(data));
    } catch (err) {
      next(err);
    }
  };

  adminListCoachMatchRequests = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.adminListCoachMatchRequests(
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  adminCreateCoachMatchRequest = async (req, res, next) => {
    try {
      const data = await this.service.adminCreateCoachMatchRequest(
        req.user.academyId,
        req.user.userId,
        req.body,
      );
      res.status(201).json(ApiResponse.success(data));
    } catch (err) {
      next(err);
    }
  };

  adminListEvaluationEditRequests = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.adminListEvaluationEditRequests(
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  adminApproveEvaluationEditRequest = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminApproveEvaluationEditRequest(
            req.user.academyId,
            req.user.userId,
            req.params.id,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminRejectEvaluationEditRequest = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminRejectEvaluationEditRequest(
            req.user.academyId,
            req.user.userId,
            req.params.id,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminGetMatch = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminGetMatch(req.user.academyId, req.params.id),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminUpdateMatch = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminUpdateMatch(
            req.user.academyId,
            req.params.id,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminPostponeMatch = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminPostponeMatch(
            req.user.academyId,
            req.user.userId,
            req.params.id,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminDeleteMatch = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminDeleteMatch(
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminHardDeleteMatch = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminHardDeleteMatch(
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminUpdateMatchStatus = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminUpdateMatchStatus(
            req.user.academyId,
            req.params.id,
            req.body.status,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminListFriendlyRequests = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.adminListFriendlyRequests(
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  adminApproveFriendlyRequest = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminApproveFriendlyRequest(
            req.user.academyId,
            req.user.userId,
            req.params.id,
            req.body.adminResponse,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminRejectFriendlyRequest = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminRejectFriendlyRequest(
            req.user.academyId,
            req.user.userId,
            req.params.id,
            req.body.adminResponse,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminConvertFriendlyRequest = async (req, res, next) => {
    try {
      res
        .status(201)
        .json(
          ApiResponse.success(
            await this.service.adminConvertFriendlyRequest(
              req.user.academyId,
              req.user.userId,
              req.params.id,
              req.body,
            ),
          ),
        );
    } catch (err) {
      next(err);
    }
  };

  adminAttendanceReport = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminAttendanceReport(
            req.user.academyId,
            req.query,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminPerformanceReport = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminPerformanceReport(
            req.user.academyId,
            req.query,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminListCoachGroups = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.adminListCoachGroups(
        req.user.academyId,
        { page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  adminCreateCoachGroup = async (req, res, next) => {
    try {
      res
        .status(201)
        .json(
          ApiResponse.success(
            await this.service.adminCreateCoachGroup(
              req.user.academyId,
              req.body,
            ),
          ),
        );
    } catch (err) {
      next(err);
    }
  };

  adminUpdateCoachGroup = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminUpdateCoachGroup(
            req.user.academyId,
            req.params.id,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminDeleteCoachGroup = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.adminDeleteCoachGroup(
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachListCalendarEvents = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.coachListCalendarEvents(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  coachListGroups = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachListGroups(
            req.user.userId,
            req.user.academyId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachGetPermissions = async (req, res, next) => {
    try {
      res.set("Cache-Control", "private, max-age=60");
      res.json(
        ApiResponse.success(
          await this.service.coachGetPermissions(
            req.user.userId,
            req.user.academyId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachListPlayers = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.coachListPlayers(
        req.user.userId,
        req.user.academyId,
        { page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  coachListInjuryRiskPainDiscomfort = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachListInjuryRiskPainDiscomfort(
            req.user.userId,
            req.user.academyId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpsertInjuryRiskPainDiscomfort = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpsertInjuryRiskPainDiscomfort(
            req.user.userId,
            req.user.academyId,
            req.body.records,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachListInjuryRiskPredictions = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachListInjuryRiskPredictions(
            req.user.userId,
            req.user.academyId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachRunInjuryRiskModel = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachRunInjuryRiskModel(
            req.user.userId,
            req.user.academyId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachGetPlayerDetail = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachGetPlayerDetail(
            req.user.userId,
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachListGroupPlayers = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachListGroupPlayers(
            req.user.userId,
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachCreateBasicPlayer = async (req, res, next) => {
    try {
      const data = await this.service.coachCreateBasicPlayer(
        req.user,
        req.body,
      );
      res.status(201).json(ApiResponse.success(data));
    } catch (err) {
      next(err);
    }
  };

  coachCompletePlayerProfile = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachCompletePlayerProfile(
            req.user,
            req.params.id,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachCreateTrainingEvent = async (req, res, next) => {
    try {
      const data = await this.service.coachCreateTrainingEvent(
        req.user.userId,
        req.user.academyId,
        req.body,
      );
      res.status(201).json(ApiResponse.success(data));
    } catch (err) {
      next(err);
    }
  };

  coachGetTrainingEvent = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachGetTrainingEvent(
            req.user.userId,
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpdateTrainingEvent = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpdateTrainingEvent(
            req.user.userId,
            req.user.academyId,
            req.params.id,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpdateTrainingEventStatus = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpdateTrainingEventStatus(
            req.user.userId,
            req.user.academyId,
            req.params.id,
            req.body.status,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachExtendTrainingEvent = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachExtendTrainingEvent(
            req.user.userId,
            req.user.academyId,
            req.params.id,
            req.body.minutes,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpsertEventAttendance = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpsertEventAttendance(
            req.user.userId,
            req.user.academyId,
            req.params.eventId,
            req.body.records,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachScanEventAttendanceQr = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachScanEventAttendanceQr(
            req.user.userId,
            req.user.academyId,
            req.params.eventId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpdateEventAttendance = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpdateEventAttendance(
            req.user.userId,
            req.user.academyId,
            req.params.eventId,
            req.params.playerId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpsertEventEvaluations = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpsertEventEvaluations(
            req.user.userId,
            req.user.academyId,
            req.params.eventId,
            req.body.records,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpdateEvaluation = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpdateEvaluation(
            req.user.userId,
            req.user.academyId,
            req.params.id,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachListMatches = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.coachListMatches(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  coachRankingSystemInputs = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.coachRankingSystemInputs(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  adminRankingSystemInputs = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.adminRankingSystemInputs(
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  playerRankingSystemInputs = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.playerRankingSystemInputs(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  parentRankingSystemInputs = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.parentRankingSystemInputs(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  coachListAdminMatchRequests = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.coachListAdminMatchRequests(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  coachAcceptAdminMatchRequest = async (req, res, next) => {
    try {
      const data = await this.service.coachAcceptAdminMatchRequest(
        req.user.userId,
        req.user.academyId,
        req.params.id,
        req.body,
      );
      res.status(201).json(ApiResponse.success(data));
    } catch (err) {
      next(err);
    }
  };

  coachGetMatch = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachGetMatch(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachRequestMatchEvaluationEdit = async (req, res, next) => {
    try {
      res
        .status(201)
        .json(
          ApiResponse.success(
            await this.service.coachRequestMatchEvaluationEdit(
              req.user.userId,
              req.user.academyId,
              req.params.matchId,
              req.body,
            ),
          ),
        );
    } catch (err) {
      next(err);
    }
  };

  coachUpsertMatchSquad = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpsertMatchSquad(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpdateMatchSquad = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpdateMatchSquad(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.params.playerId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachDeleteMatchSquad = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachDeleteMatchSquad(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.params.playerId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpsertMatchTactics = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpsertMatchTactics(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpdateMatchTargets = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpdateMatchTargets(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpdateMatchLiveStatus = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpdateMatchLiveStatus(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachRecordMatchIncident = async (req, res, next) => {
    try {
      res
        .status(201)
        .json(
          ApiResponse.success(
            await this.service.coachRecordMatchIncident(
              req.user.userId,
              req.user.academyId,
              req.params.matchId,
              req.body,
            ),
          ),
        );
    } catch (err) {
      next(err);
    }
  };

  coachRecordMatchGoal = async (req, res, next) => {
    try {
      res
        .status(201)
        .json(
          ApiResponse.success(
            await this.service.coachRecordMatchGoal(
              req.user.userId,
              req.user.academyId,
              req.params.matchId,
              req.body,
            ),
          ),
        );
    } catch (err) {
      next(err);
    }
  };

  coachDeleteMatchGoal = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachDeleteMatchGoal(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.params.goalId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachRecordMatchSubstitution = async (req, res, next) => {
    try {
      res
        .status(201)
        .json(
          ApiResponse.success(
            await this.service.coachRecordMatchSubstitution(
              req.user.userId,
              req.user.academyId,
              req.params.matchId,
              req.body,
            ),
          ),
        );
    } catch (err) {
      next(err);
    }
  };

  coachDeleteMatchSubstitution = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachDeleteMatchSubstitution(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.params.substitutionId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachDeleteMatchIncident = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachDeleteMatchIncident(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.params.incidentId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpsertMatchAttendance = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpsertMatchAttendance(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.body.records,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachScanMatchAttendanceQr = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachScanMatchAttendanceQr(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpsertPlayerStats = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpsertPlayerStats(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpdatePlayerStats = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpdatePlayerStats(
            req.user.userId,
            req.user.academyId,
            req.params.matchId,
            req.params.playerId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachCreateFriendlyRequest = async (req, res, _next) => {
    res.status(410).json(
      ApiResponse.error(
        "FRIENDLY_MATCH_REQUESTS_DISABLED",
        "Friendly match requests are disabled. Admins create matches directly.",
      ),
    );
  };

  coachListFriendlyRequests = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.coachListFriendlyRequests(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  listPlayerOptions = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.listPlayerOptions(
            req.user.academyId,
            req.query.fieldKey,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  adminCreatePlayerOption = async (req, res, next) => {
    try {
      res
        .status(201)
        .json(
          ApiResponse.success(
            await this.service.createPlayerOption(req.user, req.body),
          ),
        );
    } catch (err) {
      next(err);
    }
  };

  coachCreatePlayerOption = this.adminCreatePlayerOption;

  adminUpdatePlayerOption = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.updatePlayerOption(
            req.user,
            req.params.optionId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpdatePlayerOption = this.adminUpdatePlayerOption;

  adminDeletePlayerOption = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.deletePlayerOption(req.user, req.params.optionId),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachDeletePlayerOption = this.adminDeletePlayerOption;

  coachGetPlayerProgress = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.playerProgress(
            req.user.userId,
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  playerListCalendarEvents = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.playerListCalendarEvents(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  playerGetProfile = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.playerGetProfile(
            req.user.userId,
            req.user.academyId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  playerGetAttendanceQr = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.playerGetAttendanceQr(
            req.user.userId,
            req.user.academyId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  playerListMatches = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.playerListMatches(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  playerGetMatch = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.playerGetMatch(
            req.user.userId,
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  playerGetMatchStats = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.playerGetMatchStats(
            req.user.userId,
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  playerListTrainings = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.playerListTrainings(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  playerAttendanceHistory = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.playerAttendanceHistory(
        req.user.userId,
        req.user.academyId,
        { page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  playerEvaluations = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.playerEvaluations(
        req.user.userId,
        req.user.academyId,
        { page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  playerProgress = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.playerProgress(
            req.user.userId,
            req.user.academyId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  playerListParentNotes = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.playerListParentNotes(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  playerListAssignments = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.playerListAssignments(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  playerSubmitAssignment = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.playerSubmitAssignment(
            req.user.userId,
            req.user.academyId,
            req.params.id,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  playerSubmitDailyAiInput = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.playerSubmitDailyAiInput(
            req.user.userId,
            req.user.academyId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  playerUploadAssignmentFile = async (req, res, next) => {
    try {
      const data = await this.service.storePlayerAssignmentUpload(req.user, {
        originalName: req.get("x-file-name") || "assignment-file",
        mimeType: req.get("content-type"),
        buffer: req.body,
      });
      res.status(201).json(ApiResponse.success(data));
    } catch (err) {
      next(err);
    }
  };

  parentListChildren = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.parentListChildren(
            req.user.userId,
            req.user.academyId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  parentDashboard = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.parentDashboard(
            req.user.userId,
            req.user.academyId,
            req.query.childId || null,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  parentListCalendarEvents = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.parentListCalendarEvents(
        req.user.userId,
        req.user.academyId,
        req.params.childId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  parentListMatches = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.parentListMatches(
        req.user.userId,
        req.user.academyId,
        req.params.childId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  parentGetMatch = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.parentGetMatch(
            req.user.userId,
            req.user.academyId,
            req.params.childId,
            req.params.matchId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  parentGetMatchStats = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.parentGetMatchStats(
            req.user.userId,
            req.user.academyId,
            req.params.childId,
            req.params.matchId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  parentListTrainings = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.parentListTrainings(
        req.user.userId,
        req.user.academyId,
        req.params.childId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  parentAttendanceHistory = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.parentAttendanceHistory(
        req.user.userId,
        req.user.academyId,
        req.params.childId,
        { page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  parentEvaluations = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.parentEvaluations(
        req.user.userId,
        req.user.academyId,
        req.params.childId,
        { page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  parentMeasurements = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.parentMeasurements(
        req.user.userId,
        req.user.academyId,
        req.params.childId,
        { page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  parentPayments = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.parentPayments(
            req.user.userId,
            req.user.academyId,
            req.params.childId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  parentWeeklyReport = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.parentWeeklyReport(
            req.user.userId,
            req.user.academyId,
            req.params.childId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  parentListNotes = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.parentListNotes(
        req.user.userId,
        req.user.academyId,
        req.params.childId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  parentCreateNote = async (req, res, next) => {
    try {
      res.status(201).json(
        ApiResponse.success(
          await this.service.parentCreateNote(
            req.user.userId,
            req.user.academyId,
            req.params.childId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  parentProgress = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.parentProgress(
            req.user.userId,
            req.user.academyId,
            req.params.childId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachListParentLinks = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.coachListParentLinks(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  coachListParentAccounts = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.coachListParentAccounts(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  coachListLinkablePlayers = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.coachListLinkablePlayers(
        req.user.userId,
        req.user.academyId,
        { ...req.query, page, limit },
      );
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  coachGetParentProfile = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachGetParentProfile(
            req.user.userId,
            req.user.academyId,
            req.params.id,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachCreateParentAccount = async (req, res, next) => {
    try {
      res.status(201).json(
        ApiResponse.success(
          await this.service.coachCreateParentAccount(
            req.user.userId,
            req.user.academyId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachCreateParentLink = async (req, res, next) => {
    try {
      res.status(201).json(
        ApiResponse.success(
          await this.service.coachCreateParentLink(
            req.user.userId,
            req.user.academyId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachCreateParentLinkByQr = async (req, res, next) => {
    try {
      res.status(201).json(
        ApiResponse.success(
          await this.service.coachCreateParentLinkByQr(
            req.user.userId,
            req.user.academyId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachUpdateParentLink = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachUpdateParentLink(
            req.user.userId,
            req.user.academyId,
            req.params.parentLinkId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachDeleteParentLink = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachDeleteParentLink(
            req.user.userId,
            req.user.academyId,
            req.params.parentLinkId,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  coachListParentNotes = async (req, res, next) => {
    try {
      const { page, limit } = this._pagination(req);
      const result = await this.service.coachListParentNotes(req.user, {
        ...req.query,
        page,
        limit,
      });
      this._sendPage(res, result, page, limit);
    } catch (err) {
      next(err);
    }
  };

  coachRespondParentNote = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(
          await this.service.coachRespondParentNote(
            req.user,
            req.params.noteId,
            req.body,
          ),
        ),
      );
    } catch (err) {
      next(err);
    }
  };
}

module.exports = CalendarController;
