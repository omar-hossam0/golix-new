const { Router } = require('express');
const validate = require('../../middleware/validate.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { rbac } = require('../../middleware/rbac.middleware');
const {
    uuidParam,
    createBranchSchema,
    updateBranchSchema,
    updateAcademySchema,
    createGroupSchema,
    updateGroupSchema,
    createBirthYearSchema,
    updateBirthYearSchema,
    deleteBirthYearSchema,
    groupsQuerySchema,
    birthYearsQuerySchema,
} = require('./academy.schema');

function academyRoutes(controller) {
    const router = Router();

    router.get('/public-profile', controller.getPublicProfile);

    // All academy routes require authentication
    router.use(authMiddleware);

    // Academy
    router.get('/', controller.getAcademy);
    router.put('/', rbac('manage_academy_settings'), validate({ body: updateAcademySchema }), controller.updateAcademy);

    // Branches
    router.get('/branches', controller.getBranches);
    router.post('/branches', rbac('manage_teams'), validate({ body: createBranchSchema }), controller.createBranch);
    router.get('/branches/:id', validate({ params: uuidParam }), controller.getBranch);
    router.put('/branches/:id', rbac('manage_teams'), validate({ params: uuidParam, body: updateBranchSchema }), controller.updateBranch);
    router.delete('/branches/:id', rbac('manage_teams'), validate({ params: uuidParam }), controller.deleteBranch);

    // Groups by branch
    router.get('/branches/:id/groups', validate({ params: uuidParam }), controller.getGroupsByBranch);

    // Groups
    router.get('/groups', validate({ query: groupsQuerySchema }), controller.getGroups);
    router.post('/groups', rbac('manage_teams'), validate({ body: createGroupSchema }), controller.createGroup);
    router.put('/groups/:id', rbac('manage_teams'), validate({ params: uuidParam, body: updateGroupSchema }), controller.updateGroup);
    router.patch('/groups/:id', rbac('manage_teams'), validate({ params: uuidParam, body: updateGroupSchema }), controller.updateGroup);
    router.delete('/groups/:id', rbac('manage_teams'), validate({ params: uuidParam }), controller.deleteGroup);

    // Birth Years
    router.get('/birth-years', validate({ query: birthYearsQuerySchema }), controller.getBirthYears);
    router.post('/birth-years', rbac('manage_teams'), validate({ body: createBirthYearSchema }), controller.createBirthYear);
    router.get('/birth-years/:id', validate({ params: uuidParam }), controller.getBirthYear);
    router.patch('/birth-years/:id', rbac('manage_teams'), validate({ params: uuidParam, body: updateBirthYearSchema }), controller.updateBirthYear);
    router.delete('/birth-years/:id', rbac('manage_teams'), validate({ params: uuidParam, body: deleteBirthYearSchema }), controller.deleteBirthYear);

    return router;
}

module.exports = academyRoutes;
