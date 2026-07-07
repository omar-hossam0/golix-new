const { Router } = require('express');
const express = require('express');
const multer = require('multer');
const validate = require('../../middleware/validate.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { rbac, rbacAny, restrictTo } = require('../../middleware/rbac.middleware');
const { uploadLimiter } = require('../../middleware/rateLimit.middleware');
const { BadRequestError } = require('../../shared/errors');
const {
    uuidParam,
    groupParam,
    coachGroupQuery,
    sessionParam,
    createCoachSchema,
    updateCoachSchema,
    assignGroupSchema,
    createCoachGroupSchema,
    updateCoachGroupSchema,
    coachSessionsQuery,
    coachAttendanceSchema,
    coachMeasurementsSchema,
    coachEvaluationSchema,
    createCoachBirthYearSchema,
    assignmentParam,
    coachAccessQuerySchema,
    coachAccessBranchParam,
    coachAccessSchema,
    coachMfaSetupSchema,
    coachMfaVerifySchema,
    assignmentQuerySchema,
    playerAssignmentQuerySchema,
    playerAssignmentSubmissionParam,
    createCoachAssignmentSchema,
    submitCoachAssignmentSchema,
    playerAssignmentSchema,
    updatePlayerAssignmentSchema,
    reviewPlayerAssignmentSubmissionSchema,
} = require('./coaches.schema');

function coachesRoutes(controller) {
    const router = Router();
    const assignmentUpload = express.raw({
        type: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/webp',
        ],
        limit: '25mb',
    });
    const coachImageUpload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024, files: 1 },
        fileFilter: (_req, file, cb) => {
            if (['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.mimetype)) {
                cb(null, true);
                return;
            }
            cb(new BadRequestError('Coach image must be PNG, JPG, JPEG, or WEBP.'));
        },
    });
    const handleCoachImageUpload = (req, res, next) => {
        coachImageUpload.single('image')(req, res, (err) => {
            if (!err) return next();
            if (err instanceof multer.MulterError) {
                return next(new BadRequestError(err.code === 'LIMIT_FILE_SIZE'
                    ? 'Coach image must be 5MB or smaller.'
                    : err.message));
            }
            return next(err);
        });
    };
    router.use(authMiddleware);

    router.get('/me/dashboard', restrictTo('coach'), controller.getMeDashboard);
    router.get('/me/access-status', restrictTo('coach'), controller.getMeAccessStatus);
    router.get('/me/manage-branches', restrictTo('coach'), controller.getMeManageBranches);
    router.get('/me/birthdays', restrictTo('coach'), controller.getMeBirthdays);
    router.get('/me/groups', restrictTo('coach'), controller.getMeGroups);
    router.post('/me/groups', restrictTo('coach'), validate({ body: createCoachGroupSchema }), controller.createMeGroup);
    router.post('/me/birth-years', restrictTo('coach'), validate({ body: createCoachBirthYearSchema }), controller.createMeBirthYear);
    router.delete('/me/birth-years/:id', restrictTo('coach'), validate({ params: uuidParam }), controller.deleteMeBirthYear);
    router.get('/me/groups/:groupId', restrictTo('coach'), validate({ params: groupParam, query: coachGroupQuery }), controller.getMeGroup);
    router.patch('/me/groups/:groupId', restrictTo('coach'), validate({ params: groupParam, body: updateCoachGroupSchema }), controller.updateMeGroup);
    router.delete('/me/groups/:groupId', restrictTo('coach'), validate({ params: groupParam }), controller.deleteMeGroup);
    router.get('/me/sessions', restrictTo('coach'), validate({ query: coachSessionsQuery }), controller.getMeSessions);
    router.get('/me/sessions/:sessionId', restrictTo('coach'), validate({ params: sessionParam }), controller.getMeSession);
    router.patch('/me/sessions/:sessionId/attendance', restrictTo('coach'), validate({ params: sessionParam, body: coachAttendanceSchema }), controller.markMeAttendance);
    router.get('/me/attendance-history', restrictTo('coach'), controller.getMeAttendanceHistory);
    router.post('/me/measurements', restrictTo('coach'), validate({ body: coachMeasurementsSchema }), controller.saveMeMeasurements);
    router.get('/me/evaluations', restrictTo('coach'), controller.getMeEvaluations);
    router.post('/me/evaluations', restrictTo('coach'), validate({ body: coachEvaluationSchema }), controller.createMeEvaluation);
    router.get('/me/assignments', restrictTo('coach'), validate({ query: assignmentQuerySchema }), controller.getMeAssignments);
    router.post('/me/assignments/:assignmentId/submit', restrictTo('coach'), validate({ params: assignmentParam, body: submitCoachAssignmentSchema }), controller.submitMeAssignment);
    router.get('/me/player-assignments', restrictTo('coach'), validate({ query: playerAssignmentQuerySchema }), controller.getMePlayerAssignments);
    router.post('/me/player-assignments', restrictTo('coach'), validate({ body: playerAssignmentSchema }), controller.createMePlayerAssignment);
    router.patch('/me/player-assignments/:assignmentId', restrictTo('coach'), validate({ params: assignmentParam, body: updatePlayerAssignmentSchema }), controller.updateMePlayerAssignment);
    router.delete('/me/player-assignments/:assignmentId', restrictTo('coach'), validate({ params: assignmentParam }), controller.deleteMePlayerAssignment);
    router.get('/me/player-assignments/:assignmentId/submissions', restrictTo('coach'), validate({ params: assignmentParam }), controller.getMePlayerAssignmentSubmissions);
    router.patch('/me/player-assignments/:assignmentId/submissions/:submissionId/review', restrictTo('coach'), validate({ params: playerAssignmentSubmissionParam, body: reviewPlayerAssignmentSubmissionSchema }), controller.reviewMePlayerAssignmentSubmission);
    router.get('/me/daily-ai-inputs', restrictTo('coach'), controller.getMeDailyAiInputs);

    router.get('/assignments', rbac('manage_coaches'), validate({ query: assignmentQuerySchema }), controller.listAssignments);
    router.post('/assignments/upload', uploadLimiter, rbacAny('manage_coaches', 'access_coach_dashboard'), assignmentUpload, controller.uploadAssignmentFile);
    router.post('/assignments', rbac('manage_coaches'), validate({ body: createCoachAssignmentSchema }), controller.createAssignment);
    router.get('/assignments/:assignmentId', rbac('manage_coaches'), validate({ params: assignmentParam }), controller.getAssignment);
    router.get('/access-roles', rbac('manage_coaches'), controller.listAccessRoles);

    router.get('/', rbac('coaches:read'), controller.list);
    router.post('/images', uploadLimiter, rbac('manage_coaches'), handleCoachImageUpload, controller.uploadCoachImage);
    router.post('/', rbac('manage_coaches'), validate({ body: createCoachSchema }), controller.create);
    router.get('/:id', rbac('coaches:read'), validate({ params: uuidParam }), controller.getById);
    router.put('/:id', rbac('manage_coaches'), validate({ params: uuidParam, body: updateCoachSchema }), controller.update);
    router.delete('/:id/hard-delete', rbac('manage_coaches'), validate({ params: uuidParam }), controller.hardRemove);
    router.delete('/:id', rbac('manage_coaches'), validate({ params: uuidParam }), controller.remove);
    router.get('/:id/groups', rbac('groups:read'), validate({ params: uuidParam }), controller.getGroups);
    router.post('/:id/assign-group', rbac('manage_coaches'), validate({ params: uuidParam, body: assignGroupSchema }), controller.assignGroup);
    router.get('/:id/access', rbac('manage_coaches'), validate({ params: uuidParam, query: coachAccessQuerySchema }), controller.getAccess);
    router.put('/:id/access', rbac('manage_coaches'), validate({ params: uuidParam, body: coachAccessSchema }), controller.upsertAccess);
    router.delete('/:id/access/branches/:branchId', rbac('manage_coaches'), validate({ params: coachAccessBranchParam }), controller.removeAccess);
    router.post('/:id/mfa/setup', rbac('manage_coaches'), validate({ params: uuidParam, body: coachMfaSetupSchema }), controller.setupCoachMfa);
    router.post('/:id/mfa/verify', rbac('manage_coaches'), validate({ params: uuidParam, body: coachMfaVerifySchema }), controller.verifyCoachMfa);
    router.post('/:id/mfa/backup-codes/regenerate', rbac('manage_coaches'), validate({ params: uuidParam }), controller.regenerateCoachMfaBackupCodes);
    router.get('/:id/performance', rbac('coaches:read'), validate({ params: uuidParam }), controller.getPerformance);

    return router;
}

module.exports = coachesRoutes;
