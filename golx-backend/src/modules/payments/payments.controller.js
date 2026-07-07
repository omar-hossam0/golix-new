const ApiResponse = require('../../shared/api-response');
const { parsePagination, buildPaginationMeta } = require('../../shared/pagination');

class PaymentsController {
    constructor(paymentsService) {
        this.service = paymentsService;
    }

    getOverview = async (req, res, next) => {
        try {
            const data = await this.service.getPaymentOverview(req.user.academyId);
            res.json(ApiResponse.success(data));
        } catch (err) { next(err); }
    };

    // ─── Plans ──────────────────────────────────────────────────────────
    getPlans = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getPlans(req.user.academyId, { page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    createPlan = async (req, res, next) => {
        try {
            const plan = await this.service.createPlan(req.user.academyId, req.body);
            res.status(201).json(ApiResponse.success(plan));
        } catch (err) { next(err); }
    };

    // ─── Subscriptions ──────────────────────────────────────────────────
    getSubscriptions = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            // Destructure only allowed filter fields — never spread req.query to prevent academyId override
            const { playerId, status } = req.query;
            const result = await this.service.getSubscriptions({
                academyId: req.user.academyId,
                playerId,
                status,
                page,
                limit,
            });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    getSubscription = async (req, res, next) => {
        try {
            const sub = await this.service.getSubscription(req.params.id, req.user.academyId);
            res.json(ApiResponse.success(sub));
        } catch (err) { next(err); }
    };

    createSubscription = async (req, res, next) => {
        try {
            const sub = await this.service.createSubscription(req.body, req.user.academyId);
            res.status(201).json(ApiResponse.success(sub));
        } catch (err) { next(err); }
    };

    updateSubscription = async (req, res, next) => {
        try {
            const sub = await this.service.updateSubscription(req.params.id, req.user.academyId, req.body);
            res.json(ApiResponse.success(sub));
        } catch (err) { next(err); }
    };

    // ─── Payments ───────────────────────────────────────────────────────
    getPayments = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            // Destructure only validated filter fields — academyId enforced from token
            const { status, dateFrom, dateTo } = req.query;
            const result = await this.service.getPayments({
                academyId: req.user.academyId,
                status,
                dateFrom,
                dateTo,
                page,
                limit,
            });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    getPayment = async (req, res, next) => {
        try {
            const payment = await this.service.getPayment(req.params.id, req.user.academyId);
            res.json(ApiResponse.success(payment));
        } catch (err) { next(err); }
    };

    pay = async (req, res, next) => {
        try {
            const payment = await this.service.processPayment(req.body, req.user.academyId);
            res.status(201).json(ApiResponse.success(payment));
        } catch (err) { next(err); }
    };
}

module.exports = PaymentsController;
