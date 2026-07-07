const AdminRepository = require('../admin.repository');
const AdminDashboardRepository = require(
    '../repositories/dashboard.repository',
);

describe('admin repository structure', () => {
    test('keeps dashboard/report reads separate from IAM mutations', () => {
        const repository = new AdminRepository(jest.fn());

        expect(repository).toBeInstanceOf(AdminDashboardRepository);
        expect(typeof repository.getKPIs).toBe('function');
        expect(typeof repository.getReportsOverview).toBe('function');
        expect(typeof repository.getWeeklyMatches).toBe('function');
        expect(typeof repository.getAccessControl).toBe('function');
        expect(typeof repository.assignRoleToUser).toBe('function');
    });
});
