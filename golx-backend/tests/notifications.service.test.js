jest.mock("../src/events/eventBus", () => ({
  publish: jest.fn(),
}));
jest.mock("../src/config/env", () => ({
  NOTIFICATION_UNREAD_COUNT_CACHE_TTL_SECONDS: 60,
  NOTIFICATION_RETENTION_MONTHS: 6,
}));
jest.mock("../src/infrastructure/redis", () => ({
  redis: {},
}));

const NotificationsService = require("../src/modules/notifications/notifications.service");
const { NotFoundError } = require("../src/shared/errors");

describe("NotificationsService delivery persistence", () => {
  test("rejects a direct recipient outside the sender academy", async () => {
    const repo = {
      findTargetUser: jest.fn(async () => null),
      createBulkWithLogs: jest.fn(),
    };
    const service = new NotificationsService(repo, { add: jest.fn() });
    service._invalidateUnreadCounts = jest.fn();

    await expect(
      service.sendNotification(
        {
          userId: "other-academy-user",
          type: "warning",
          title: "Private update",
          body: "Academy-only message",
          channel: "in_app",
        },
        "academy-1",
      ),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(repo.findTargetUser).toHaveBeenCalledWith(
      "academy-1",
      "other-academy-user",
    );
    expect(repo.createBulkWithLogs).not.toHaveBeenCalled();
  });

  test("creates inbox notifications and delivery logs atomically", async () => {
    const recipients = [{ user_id: "user-1" }, { user_id: "user-2" }];
    const created = recipients.map((recipient, index) => ({
      id: `notification-${index + 1}`,
      user_id: recipient.user_id,
      title: "Training update",
    }));
    const repo = {
      targetUsers: jest.fn(async () => recipients),
      createBulkWithLogs: jest.fn(async () => created),
    };
    const queue = { add: jest.fn() };
    const service = new NotificationsService(repo, queue);
    service._invalidateUnreadCounts = jest.fn();

    const result = await service.sendNotification(
      {
        type: "warning",
        title: "Training update",
        body: "Training starts at 6 PM",
        channel: "in_app",
        targetRole: "coach",
      },
      "academy-1",
    );

    expect(repo.createBulkWithLogs).toHaveBeenCalledWith(
      [
        {
          user_id: "user-1",
          type: "warning",
          title: "Training update",
          body: "Training starts at 6 PM",
          data: {},
          is_read: false,
        },
        {
          user_id: "user-2",
          type: "warning",
          title: "Training update",
          body: "Training starts at 6 PM",
          data: {},
          is_read: false,
        },
      ],
      "in_app",
    );
    expect(queue.add).not.toHaveBeenCalled();
    expect(result).toEqual({ count: 2, notifications: created });
  });
});
