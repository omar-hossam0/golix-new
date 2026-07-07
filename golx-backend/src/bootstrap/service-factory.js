const db = require('../infrastructure/database');
const { redis } = require('../infrastructure/redis');
const {
    rankingsQueue,
    notificationsQueue,
    paymentsQueue,
    aiQueue,
} = require('../infrastructure/queue');

const AuthRepository = require('../modules/auth/auth.repository');
const AcademyRepository = require('../modules/academy/academy.repository');
const PlayersRepository = require('../modules/players/players.repository');
const CoachesRepository = require('../modules/coaches/coaches.repository');
const AttendanceRepository = require('../modules/attendance/attendance.repository');
const RankingsRepository = require('../modules/rankings/rankings.repository');
const PaymentsRepository = require('../modules/payments/payments.repository');
const NotificationsRepository = require('../modules/notifications/notifications.repository');
const AiRepository = require('../modules/ai/ai.repository');
const AdminRepository = require('../modules/admin/admin.repository');
const CalendarRepository = require('../modules/calendar/calendar.repository');
const CustomDataRepository = require('../modules/custom-data/custom-data.repository');
const ChatRepository = require('../modules/chat/chat.repository');
const DataLifecycleRepository = require('../modules/data-lifecycle/data-lifecycle.repository');

const AuthService = require('../modules/auth/auth.service');
const TotpService = require('../modules/auth/totp.service');
const AcademyService = require('../modules/academy/academy.service');
const PlayersService = require('../modules/players/players.service');
const CoachesService = require('../modules/coaches/coaches.service');
const AttendanceService = require('../modules/attendance/attendance.service');
const RankingsService = require('../modules/rankings/rankings.service');
const PaymentsService = require('../modules/payments/payments.service');
const NotificationsService = require('../modules/notifications/notifications.service');
const AiService = require('../modules/ai/ai.service');
const AdminService = require('../modules/admin/admin.service');
const CalendarService = require('../modules/calendar/calendar.service');
const CustomDataService = require('../modules/custom-data/custom-data.service');
const ChatService = require('../modules/chat/chat.service');
const DataLifecycleService = require('../modules/data-lifecycle/data-lifecycle.service');
const BackupService = require('../modules/backups/backup.service');

const AuthController = require('../modules/auth/auth.controller');
const AcademyController = require('../modules/academy/academy.controller');
const PlayersController = require('../modules/players/players.controller');
const CoachesController = require('../modules/coaches/coaches.controller');
const AttendanceController = require('../modules/attendance/attendance.controller');
const RankingsController = require('../modules/rankings/rankings.controller');
const PaymentsController = require('../modules/payments/payments.controller');
const NotificationsController = require('../modules/notifications/notifications.controller');
const AiController = require('../modules/ai/ai.controller');
const AdminController = require('../modules/admin/admin.controller');
const CalendarController = require('../modules/calendar/calendar.controller');
const CustomDataController = require('../modules/custom-data/custom-data.controller');
const ChatController = require('../modules/chat/chat.controller');
const DataLifecycleController = require('../modules/data-lifecycle/data-lifecycle.controller');

function createApplicationServices({
    database = db,
    redisClient = redis,
    queues = {
        rankingsQueue,
        notificationsQueue,
        paymentsQueue,
        aiQueue,
    },
} = {}) {
    const repositories = {
        authRepo: new AuthRepository(database),
        academyRepo: new AcademyRepository(database),
        playersRepo: new PlayersRepository(database),
        coachesRepo: new CoachesRepository(database),
        attendanceRepo: new AttendanceRepository(database, redisClient),
        rankingsRepo: new RankingsRepository(database),
        paymentsRepo: new PaymentsRepository(database),
        notificationsRepo: new NotificationsRepository(database),
        aiRepo: new AiRepository(database),
        adminRepo: new AdminRepository(database),
        calendarRepo: new CalendarRepository(database),
        customDataRepo: new CustomDataRepository(database),
        chatRepo: new ChatRepository(database),
        dataLifecycleRepo: new DataLifecycleRepository(database),
    };

    const services = {};
    services.authService = new AuthService(repositories.authRepo, redisClient);
    services.totpService = new TotpService(repositories.authRepo);
    services.academyService = new AcademyService(repositories.academyRepo);
    services.playersService = new PlayersService(repositories.playersRepo);
    services.coachesService = new CoachesService(
        repositories.coachesRepo,
        services.academyService,
    );
    services.attendanceService = new AttendanceService(repositories.attendanceRepo, redisClient);
    services.rankingsService = new RankingsService(repositories.rankingsRepo, queues.rankingsQueue);
    services.paymentsService = new PaymentsService(repositories.paymentsRepo, queues.paymentsQueue);
    services.notificationsService = new NotificationsService(
        repositories.notificationsRepo,
        queues.notificationsQueue,
    );
    services.aiService = new AiService(repositories.aiRepo, queues.aiQueue);
    services.adminService = new AdminService(repositories.adminRepo);
    services.customDataService = new CustomDataService(repositories.customDataRepo);
    services.calendarService = new CalendarService(
        repositories.calendarRepo,
        services.playersService,
        services.customDataService,
        redisClient,
    );
    services.chatService = new ChatService(repositories.chatRepo);
    services.dataLifecycleService = new DataLifecycleService(repositories.dataLifecycleRepo);
    services.backupService = new BackupService(database);
    services.notificationsService.setDataLifecycleService?.(services.dataLifecycleService);

    const controllers = {
        authController: new AuthController(services.authService, services.totpService),
        academyController: new AcademyController(services.academyService),
        playersController: new PlayersController(services.playersService),
        coachesController: new CoachesController(services.coachesService, services.totpService),
        attendanceController: new AttendanceController(services.attendanceService),
        rankingsController: new RankingsController(services.rankingsService),
        paymentsController: new PaymentsController(services.paymentsService),
        notificationsController: new NotificationsController(services.notificationsService),
        aiController: new AiController(services.aiService),
        adminController: new AdminController(services.adminService, services.backupService),
        calendarController: new CalendarController(services.calendarService),
        customDataController: new CustomDataController(services.customDataService),
        chatController: new ChatController(services.chatService),
        dataLifecycleController: new DataLifecycleController(services.dataLifecycleService),
    };

    return { controllers, repositories, services };
}

module.exports = { createApplicationServices };
