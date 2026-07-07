const ApiResponse = require('../../shared/api-response.js');
const { parsePagination, buildPaginationMeta } = require('../../shared/pagination.js');

class CoachesController {
    constructor(coachesService, totpService) {
        this.service = coachesService;
        this.totpService = totpService;
    }

    list = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.listCoaches(req.user.academyId, { page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    getById = async (req, res, next) => {
        try {
            const coach = await this.service.getCoach(req.params.id, req.user.academyId);
            res.json(ApiResponse.success(coach));
        } catch (err) { next(err); }
    };

    getMeDashboard = async (req, res, next) => {
        try {
            const data = await this.service.getMyDashboard(req.user.userId, req.user.academyId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMeGroups = async (req, res, next) => {
        try {
            const data = await this.service.getMyGroups(req.user.userId, req.user.academyId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMeAccessStatus = async (req, res, next) => {
        try {
            const data = await this.service.getMyAccessStatus(req.user.userId, req.user.academyId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMeManageBranches = async (req, res, next) => {
        try {
            const data = await this.service.getMyManageBranches(req.user.userId, req.user.academyId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMeBirthdays = async (req, res, next) => {
        try {
            const data = await this.service.getMyBirthdays(req.user.userId, req.user.academyId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    createMeGroup = async (req, res, next) => {
        try {
            const data = await this.service.createMyGroup(req.user.userId, req.user.academyId, req.body);
            res.status(201).json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    createMeBirthYear = async (req, res, next) => {
        try {
            const data = await this.service.createMyBirthYear(req.user.userId, req.user.academyId, req.body);
            res.status(201).json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    deleteMeBirthYear = async (req, res, next) => {
        try {
            const data = await this.service.deleteMyBirthYear(req.user.userId, req.user.academyId, req.params.id);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMeGroup = async (req, res, next) => {
        try {
            const data = await this.service.getMyGroupDetail(req.user.userId, req.user.academyId, req.params.groupId, {
                month: req.query.month,
            });
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    updateMeGroup = async (req, res, next) => {
        try {
            const data = await this.service.updateMyGroup(req.user.userId, req.user.academyId, req.params.groupId, req.body);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    deleteMeGroup = async (req, res, next) => {
        try {
            const data = await this.service.deleteMyGroup(req.user.userId, req.user.academyId, req.params.groupId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMeSessions = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getMySessions(req.user.userId, req.user.academyId, { ...req.query, page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    getMeSession = async (req, res, next) => {
        try {
            const data = await this.service.getMySession(req.user.userId, req.user.academyId, req.params.sessionId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    markMeAttendance = async (req, res, next) => {
        try {
            const data = await this.service.markMyAttendance(req.user.userId, req.user.academyId, req.params.sessionId, req.body.records);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMeAttendanceHistory = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getMyAttendanceHistory(req.user.userId, req.user.academyId, { page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    saveMeMeasurements = async (req, res, next) => {
        try {
            const data = await this.service.saveMyMeasurements(req.user.userId, req.user.academyId, req.body.records);
            res.status(201).json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMeEvaluations = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getMyEvaluations(req.user.userId, req.user.academyId, { page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    createMeEvaluation = async (req, res, next) => {
        try {
            const data = await this.service.createMyEvaluation(req.user.userId, req.user.academyId, req.body);
            res.status(201).json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMeAssignments = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getMyAssignments(req.user.userId, req.user.academyId, { ...req.query, page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    submitMeAssignment = async (req, res, next) => {
        try {
            const data = await this.service.submitMyAssignment(req.user.userId, req.user.academyId, req.params.assignmentId, req.body);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMePlayerAssignments = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getMyPlayerAssignments(req.user.userId, req.user.academyId, { ...req.query, page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    createMePlayerAssignment = async (req, res, next) => {
        try {
            const data = await this.service.createMyPlayerAssignment(req.user.userId, req.user.academyId, req.body);
            res.status(201).json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    updateMePlayerAssignment = async (req, res, next) => {
        try {
            const data = await this.service.updateMyPlayerAssignment(req.user.userId, req.user.academyId, req.params.assignmentId, req.body);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    deleteMePlayerAssignment = async (req, res, next) => {
        try {
            const data = await this.service.deleteMyPlayerAssignment(req.user.userId, req.user.academyId, req.params.assignmentId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMePlayerAssignmentSubmissions = async (req, res, next) => {
        try {
            const data = await this.service.getMyPlayerAssignmentSubmissions(req.user.userId, req.user.academyId, req.params.assignmentId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    reviewMePlayerAssignmentSubmission = async (req, res, next) => {
        try {
            const data = await this.service.reviewMyPlayerAssignmentSubmission(
                req.user.userId,
                req.user.academyId,
                req.params.assignmentId,
                req.params.submissionId,
                req.body,
            );
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    getMeDailyAiInputs = async (req, res, next) => {
        try {
            const data = await this.service.getMyDailyAiInputs(req.user.userId, req.user.academyId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    listAssignments = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getAssignments(req.user.academyId, { ...req.query, page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    getAssignment = async (req, res, next) => {
        try {
            const data = await this.service.getAssignment(req.user.academyId, req.params.assignmentId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    createAssignment = async (req, res, next) => {
        try {
            const data = await this.service.createAssignment(req.user.academyId, req.user.userId, req.body);
            res.status(201).json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    uploadAssignmentFile = async (req, res, next) => {
        try {
            const data = await this.service.storeAssignmentUpload(req.user, {
                originalName: req.get('x-file-name') || 'assignment-file',
                mimeType: req.get('content-type'),
                buffer: req.body,
            });
            res.status(201).json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    uploadCoachImage = async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json(ApiResponse.error('VALIDATION_ERROR', 'Image file is required'));
            }
            const data = await this.service.storeCoachImageUpload(req.user, {
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                buffer: req.file.buffer,
            });
            return res.status(201).json(ApiResponse.success(data));
        } catch (err) { return next(err); }
    };

    create = async (req, res, next) => {
        try {
            const coach = await this.service.createCoach(req.user.academyId, req.body);
            res.status(201).json(ApiResponse.success(coach));
        } catch (err) { next(err); }
    };

    update = async (req, res, next) => {
        try {
            const coach = await this.service.updateCoach(req.params.id, req.user.academyId, req.body);
            res.json(ApiResponse.success(coach));
        } catch (err) { next(err); }
    };

    remove = async (req, res, next) => {
        try {
            await this.service.deleteCoach(req.params.id, req.user.academyId);
            res.json(ApiResponse.success({ message: 'Coach deleted' }));
        } catch (err) { next(err); }
    };

    hardRemove = async (req, res, next) => {
        try {
            await this.service.hardDeleteCoach(req.params.id, req.user.academyId);
            res.json(ApiResponse.success({ message: 'Coach permanently deleted' }));
        } catch (err) { next(err); }
    };

    getGroups = async (req, res, next) => {
        try {
            await this.service.getCoach(req.params.id, req.user.academyId);
            const groups = await this.service.getCoachGroups(req.params.id);
            res.json(ApiResponse.success(groups));
        } catch (err) { next(err); }
    };

    assignGroup = async (req, res, next) => {
        try {
            const result = await this.service.assignGroup(req.params.id, req.user.academyId, req.body.groupId, req.body.role);
            res.status(201).json(ApiResponse.success(result));
        } catch (err) { next(err); }
    };

    listAccessRoles = async (_req, res, next) => {
        try {
            res.set('Cache-Control', 'private, max-age=300');
            res.json(ApiResponse.success(this.service.listAssignmentRoles()));
        } catch (err) { next(err); }
    };

    getAccess = async (req, res, next) => {
        try {
            const data = await this.service.getCoachAccess(req.params.id, req.user.academyId, req.query.branchId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    upsertAccess = async (req, res, next) => {
        try {
            const data = await this.service.upsertCoachAccess(req.params.id, req.user.academyId, req.user.userId, req.body);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    removeAccess = async (req, res, next) => {
        try {
            const data = await this.service.removeCoachAccess(req.params.id, req.user.academyId, req.params.branchId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    setupCoachMfa = async (req, res, next) => {
        try {
            const coach = await this.service.getCoach(req.params.id, req.user.academyId);
            if (!coach.user_id) {
                return res.status(400).json(ApiResponse.error('VALIDATION_ERROR', 'Coach has no linked login account'));
            }
            const data = await this.totpService.setupManagedDevice(coach.user_id, {
                deviceName: req.body.deviceName || `${coach.full_name || 'Coach'} phone`,
                resetExisting: Boolean(req.body.resetExisting),
            });
            return res.json(ApiResponse.success({
                ...data,
                coachId: coach.id,
                coachName: coach.full_name,
            }));
        } catch (err) { return next(err); }
    };

    verifyCoachMfa = async (req, res, next) => {
        try {
            const coach = await this.service.getCoach(req.params.id, req.user.academyId);
            if (!coach.user_id) {
                return res.status(400).json(ApiResponse.error('VALIDATION_ERROR', 'Coach has no linked login account'));
            }
            const data = await this.totpService.verifyManagedDevice(
                coach.user_id,
                req.body.deviceId,
                req.body.token,
            );
            return res.json(ApiResponse.success({
                ...data,
                coachId: coach.id,
                coachName: coach.full_name,
            }));
        } catch (err) { return next(err); }
    };

    regenerateCoachMfaBackupCodes = async (req, res, next) => {
        try {
            const coach = await this.service.getCoach(req.params.id, req.user.academyId);
            if (!coach.user_id) {
                return res.status(400).json(ApiResponse.error('VALIDATION_ERROR', 'Coach has no linked login account'));
            }
            const data = await this.totpService.regenerateManagedBackupCodes(coach.user_id);
            return res.json(ApiResponse.success({
                ...data,
                coachId: coach.id,
                coachName: coach.full_name,
            }));
        } catch (err) { return next(err); }
    };

    getPerformance = async (req, res, next) => {
        try {
            await this.service.getCoach(req.params.id, req.user.academyId);
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getPerformance(req.params.id, { page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };
}

module.exports = CoachesController;
