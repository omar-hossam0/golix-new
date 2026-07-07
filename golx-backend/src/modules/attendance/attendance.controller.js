const ApiResponse = require('../../shared/api-response');

class AttendanceController {
    constructor(attendanceService) {
        this.service = attendanceService;
    }

    getOverview = async (req, res, next) => {
        try {
            const data = await this.service.getAttendanceOverview(
                req.query,
                req.user.academyId,
            );
            res.json(ApiResponse.success(data));
        } catch (err) {
            next(err);
        }
    };
}

module.exports = AttendanceController;
