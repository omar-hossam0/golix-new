const { z } = require('zod');

const attendanceOverviewQuery = z.object({
    branchId: z.string().uuid().optional(),
    groupId: z.string().uuid().optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
    ({ dateFrom, dateTo }) => !dateFrom || !dateTo || dateFrom <= dateTo,
    {
        message: 'dateFrom must be before or equal to dateTo',
        path: ['dateFrom'],
    },
);

module.exports = { attendanceOverviewQuery };
