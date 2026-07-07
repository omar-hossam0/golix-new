require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../.env"),
});

const AuthService = require("../src/modules/auth/auth.service");
const { UnauthorizedError } = require("../src/shared/errors");

// bcrypt cost 4 keeps the unit test fast while still exercising real password verification.
const PASSWORD_HASH =
  "$2b$04$Pjh8jy5S/G9Y0yZvQu86A./aI3WZk6TM0FgXuBNrrOmo807sU9hpy";

function buildServiceForUser(user) {
  const repo = {
    findByEmailPhoneOrUsername: jest.fn(async () => user),
    findActiveAdminAccount: jest.fn(async () => ({ id: "admin-account-1" })),
  };
  return {
    repo,
    service: new AuthService(repo, {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    }),
  };
}

describe("auth login role boundaries", () => {
  test("admin/coach login rejects a player account with otherwise valid credentials", async () => {
    const { service, repo } = buildServiceForUser({
      id: "player-user",
      role: "player",
      username: "player1",
      is_active: true,
      password_hash: PASSWORD_HASH,
    });

    await expect(
      service.login(
        {
          username: "player1",
          password: "Password1!",
          allowedRoles: ["admin", "coach"],
        },
        "127.0.0.1",
        "jest",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(repo.findActiveAdminAccount).not.toHaveBeenCalled();
  });

  test("public player/parent login rejects an admin account with otherwise valid credentials", async () => {
    const { service, repo } = buildServiceForUser({
      id: "admin-user",
      role: "admin",
      username: "admin1",
      email: "admin@example.com",
      is_active: true,
      password_hash: PASSWORD_HASH,
    });

    await expect(
      service.login(
        {
          username: "admin1",
          password: "Password1!",
          allowedRoles: ["player", "parent"],
        },
        "127.0.0.1",
        "jest",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(repo.findActiveAdminAccount).not.toHaveBeenCalled();
  });

  test("selected public role must match the authenticated account role", async () => {
    const { service } = buildServiceForUser({
      id: "player-user",
      role: "player",
      username: "player1",
      is_active: true,
      password_hash: PASSWORD_HASH,
    });

    await expect(
      service.login(
        {
          username: "player1",
          password: "Password1!",
          role: "parent",
          allowedRoles: ["player", "parent"],
        },
        "127.0.0.1",
        "jest",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
