require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../../../.env"),
});

jest.mock("otplib", () => ({
  verifySync: jest.fn(({ token, secret, epochTolerance }) => ({
    valid: epochTolerance === 30 && token === `token:${secret}`,
  })),
}));

const otplib = require("otplib");
const TotpService = require("../totp.service");

function buildRepo({ userSecret, deviceSecret } = {}) {
  return {
    findById: jest.fn().mockResolvedValue({
      id: "user-1",
      role: "admin",
      email: "admin@example.com",
      totp_enabled: true,
      totp_secret: userSecret,
    }),
    findActiveTotpDevices: jest
      .fn()
      .mockResolvedValue(
        deviceSecret ? [{ id: "device-1", secret: deviceSecret }] : [],
      ),
    touchTotpDevice: jest.fn().mockResolvedValue(1),
  };
}

function buildRevokeRepo(devices) {
  return {
    findById: jest.fn().mockResolvedValue({
      id: "user-1",
      role: "admin",
      email: "admin@example.com",
      totp_enabled: true,
      totp_secret: "LEGACYSECRET1234567890",
    }),
    findActiveTotpDevices: jest.fn().mockResolvedValue(devices),
    revokeTotpDevice: jest.fn(async (_userId, deviceId) => ({
      ...devices.find((device) => device.id === deviceId),
      status: "revoked",
      is_primary: false,
    })),
    setPrimaryTotpDevice: jest
      .fn()
      .mockResolvedValue({ id: "replacement-device" }),
  };
}

describe("TotpService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("verifies tokens with a one-step TOTP tolerance", async () => {
    const secret = "LEGACYSECRET1234567890";
    const token = `token:${secret}`;
    const repo = buildRepo({ userSecret: secret });
    const service = new TotpService(repo);

    await expect(service.verify("user-1", token)).resolves.toBe(true);
    expect(otplib.verifySync).toHaveBeenCalledWith({
      token,
      secret,
      epochTolerance: 30,
    });
  });

  test("falls back to the legacy user secret when active device secrets do not match", async () => {
    const legacySecret = "LEGACYSECRET1234567890";
    const otherDeviceSecret = "DEVICESECRET1234567890";
    const token = `token:${legacySecret}`;
    const repo = buildRepo({
      userSecret: legacySecret,
      deviceSecret: otherDeviceSecret,
    });
    const service = new TotpService(repo);

    await expect(service.verify("user-1", token)).resolves.toBe(true);
    expect(repo.touchTotpDevice).not.toHaveBeenCalled();
  });

  test("promotes another active device when removing the primary device", async () => {
    const repo = buildRevokeRepo([
      {
        id: "primary-device",
        device_name: "Old phone",
        status: "active",
        is_primary: true,
      },
      {
        id: "replacement-device",
        device_name: "New phone",
        status: "active",
        is_primary: false,
      },
    ]);
    const service = new TotpService(repo);

    await expect(
      service.revokeDevice("user-1", "primary-device"),
    ).resolves.toMatchObject({
      id: "primary-device",
      status: "revoked",
      isPrimary: false,
    });
    expect(repo.revokeTotpDevice).toHaveBeenCalledWith(
      "user-1",
      "primary-device",
    );
    expect(repo.setPrimaryTotpDevice).toHaveBeenCalledWith(
      "user-1",
      "replacement-device",
    );
  });

  test("keeps the last active device from being removed", async () => {
    const repo = buildRevokeRepo([
      {
        id: "primary-device",
        device_name: "Only phone",
        status: "active",
        is_primary: true,
      },
    ]);
    const service = new TotpService(repo);

    await expect(
      service.revokeDevice("user-1", "primary-device"),
    ).rejects.toThrow("At least one active MFA device is required");
    expect(repo.revokeTotpDevice).not.toHaveBeenCalled();
  });

  test("consumes a backup code atomically so it cannot be replayed", async () => {
    const repo = {
      consumeUnusedBackupCode: jest
        .fn()
        .mockResolvedValueOnce({ id: "backup-code-1" })
        .mockResolvedValueOnce(null),
    };
    const service = new TotpService(repo);

    await expect(
      service.verifyBackupCode("user-1", "recovery-code"),
    ).resolves.toBe(true);
    await expect(
      service.verifyBackupCode("user-1", "recovery-code"),
    ).rejects.toThrow("Invalid or already used backup code");
    expect(repo.consumeUnusedBackupCode).toHaveBeenCalledTimes(2);
  });
});
