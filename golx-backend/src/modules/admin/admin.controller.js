const ApiResponse = require('../../shared/api-response');

class AdminController {
    constructor(adminService, backupService) {
        this.service = adminService;
        this.backupService = backupService;
    }

    getDashboard = async (req, res, next) => {
        try {
            const data = await this.service.getDashboard(req.user.academyId || null);
            res.json(ApiResponse.success(data));
        } catch (err) {
            next(err);
        }
    };

    getReportsOverview = async (req, res, next) => {
        try {
            const data = await this.service.getReportsOverview(
                req.user.academyId || null,
                req.query,
            );
            res.json(ApiResponse.success(data));
        } catch (err) {
            next(err);
        }
    };

    getAccessControl = async (req, res, next) => {
        try {
            const data = await this.service.getAccessControl(req.user.academyId || null);
            res.json(ApiResponse.success(data));
        } catch (err) {
            next(err);
        }
    };

    listPasswordResetRequests = async (req, res, next) => {
        try {
            const data = await this.service.listPasswordResetRequests(req.user.academyId || null);
            res.json(ApiResponse.success(data));
        } catch (err) {
            next(err);
        }
    };

    createAccessUser = async (req, res, next) => {
        try {
            const data = await this.service.createAccessUser(
                req.user.academyId || null,
                req.user.userId,
                req.body,
            );
            res.status(201).json(ApiResponse.success(data));
        } catch (err) {
            next(err);
        }
    };

    createRole = async (req, res, next) => {
        try {
            const role = await this.service.createRole(
                req.user.academyId || null,
                req.user.userId,
                req.body,
            );
            res.status(201).json(ApiResponse.success(role));
        } catch (err) {
            next(err);
        }
    };

    updateRole = async (req, res, next) => {
        try {
            const role = await this.service.updateRole(
                req.params.id,
                req.user.academyId || null,
                req.user.userId,
                req.body,
            );
            res.json(ApiResponse.success(role));
        } catch (err) {
            next(err);
        }
    };

    deleteRole = async (req, res, next) => {
        try {
            const result = await this.service.deleteRole(
                req.params.id,
                req.user.academyId || null,
                req.user.userId,
            );
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    assignRoleToUser = async (req, res, next) => {
        try {
            const result = await this.service.assignRoleToUser(
                req.params.id,
                req.params.userId,
                req.user.academyId || null,
                req.user.userId,
            );
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    revokeRoleFromUser = async (req, res, next) => {
        try {
            const result = await this.service.revokeRoleFromUser(
                req.params.id,
                req.params.userId,
                req.user.academyId || null,
                req.user.userId,
            );
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    getBackups = async (_req, res, next) => {
        try {
            const data = await this.backupService.getStatus();
            res.json(ApiResponse.success(data));
        } catch (err) {
            next(err);
        }
    };

    createBackup = async (_req, res, next) => {
        try {
            const data = await this.backupService.createBackup({ label: 'manual' });
            res.status(201).json(ApiResponse.success(data));
        } catch (err) {
            next(err);
        }
    };

    restoreBackup = async (req, res, next) => {
        try {
            const data = await this.backupService.restoreBackup({
                fileName: req.body.fileName,
                password: req.body.password,
                confirmation: req.body.confirmation,
                userId: req.user.userId,
            });
            res.json(ApiResponse.success(data));
        } catch (err) {
            next(err);
        }
    };

}

module.exports = AdminController;
