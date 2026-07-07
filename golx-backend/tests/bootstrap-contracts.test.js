require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const { createApplicationServices } = require('../src/bootstrap/service-factory');

describe('application bootstrap contracts', () => {
    test('service factory wires the controllers and services used by the app', () => {
        const { controllers, services, repositories } = createApplicationServices();

        expect(services.chatService).toBeDefined();
        expect(services.calendarService).toBeDefined();
        expect(services.dataLifecycleService).toBeDefined();
        expect(controllers.authController).toBeDefined();
        expect(controllers.chatController).toBeDefined();
        expect(controllers.dataLifecycleController).toBeDefined();
        expect(controllers.calendarController).toBeDefined();
        expect(repositories.chatRepo).toBeDefined();
        expect(repositories.dataLifecycleRepo).toBeDefined();
    });
});
