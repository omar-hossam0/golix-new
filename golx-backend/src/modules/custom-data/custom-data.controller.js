const ApiResponse = require('../../shared/api-response');

class CustomDataController {
    constructor(service) {
        this.service = service;
    }

    listCategories = async (req, res, next) => {
        try {
            res.json(ApiResponse.success(await this.service.listCategories(req.user, req.query)));
        } catch (err) { next(err); }
    };

    createCategory = async (req, res, next) => {
        try {
            res.status(201).json(ApiResponse.success(await this.service.createCategory(req.user, req.body)));
        } catch (err) { next(err); }
    };

    updateCategory = async (req, res, next) => {
        try {
            res.json(ApiResponse.success(await this.service.updateCategory(req.user, req.params.categoryId, req.body)));
        } catch (err) { next(err); }
    };

    deleteCategory = async (req, res, next) => {
        try {
            res.json(ApiResponse.success(await this.service.deleteCategory(req.user, req.params.categoryId)));
        } catch (err) { next(err); }
    };

    createField = async (req, res, next) => {
        try {
            res.status(201).json(ApiResponse.success(await this.service.createField(req.user, req.params.categoryId, req.body)));
        } catch (err) { next(err); }
    };

    updateField = async (req, res, next) => {
        try {
            res.json(ApiResponse.success(await this.service.updateField(req.user, req.params.fieldId, req.body)));
        } catch (err) { next(err); }
    };

    deleteField = async (req, res, next) => {
        try {
            res.json(ApiResponse.success(await this.service.deleteField(req.user, req.params.fieldId)));
        } catch (err) { next(err); }
    };

    createOption = async (req, res, next) => {
        try {
            res.status(201).json(ApiResponse.success(await this.service.createOption(req.user, req.params.fieldId, req.body)));
        } catch (err) { next(err); }
    };

    updateOption = async (req, res, next) => {
        try {
            res.json(ApiResponse.success(await this.service.updateOption(req.user, req.params.optionId, req.body)));
        } catch (err) { next(err); }
    };

    deleteOption = async (req, res, next) => {
        try {
            res.json(ApiResponse.success(await this.service.deleteOption(req.user, req.params.optionId)));
        } catch (err) { next(err); }
    };

    getPlayerProfile = async (req, res, next) => {
        try {
            res.json(ApiResponse.success(await this.service.getPlayerProfile(req.user, req.params.playerId)));
        } catch (err) { next(err); }
    };

    savePlayerValues = async (req, res, next) => {
        try {
            res.json(ApiResponse.success(await this.service.savePlayerValues(req.user, req.params.playerId, req.body.values, {
                markProfileComplete: req.body.markProfileComplete,
            })));
        } catch (err) { next(err); }
    };
}

module.exports = CustomDataController;
