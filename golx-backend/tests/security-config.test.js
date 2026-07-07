const { spawnSync } = require("node:child_process");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");
const productionTotpKey =
  "d5f4a9b113be456098eecb1a99506502d1c89f5a07e6b9434df336f2b2f8c4a1";

const requiredEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/goalix_test",
  REDIS_URL: "redis://localhost:6379",
  REDIS_REQUIRED: "true",
  QUEUE_REDIS_FAILURE_MODE: "throw",
  JWT_SECRET: "prod-access-secret-7f6b1b0b8e5d4c2a9f31",
  JWT_REFRESH_SECRET: "prod-refresh-secret-c20a15d945a64fb4b8",
  STORAGE_PROVIDER: "s3",
  S3_BUCKET: "goalix-test-uploads",
  S3_ACCESS_KEY_ID: "test-access-key",
  S3_SECRET_ACCESS_KEY: "test-secret-key",
};

const productionSecurityEnv = {
  COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
  CSRF_SECRET: "production-csrf-secret-with-at-least-32-chars",
  TOTP_ENCRYPTION_KEY: productionTotpKey,
  CORS_ORIGINS: "https://app.goalix.local",
};

function runNode(script, env = {}) {
  const childEnv = {
    ...process.env,
    ...requiredEnv,
    ...(env.NODE_ENV === "production" ? productionSecurityEnv : {}),
    ...env,
  };
  for (const [key, value] of Object.entries(childEnv)) {
    if (value === null) delete childEnv[key];
  }

  return spawnSync(process.execPath, ["-e", script], {
    cwd: backendRoot,
    env: childEnv,
    encoding: "utf8",
  });
}

describe("security configuration", () => {
  it("allows the development cookie secret fallback for local startup only", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "development",
      COOKIE_SECRET: null,
    });

    expect(result.status).toBe(0);
  });

  it("rejects the default cookie secret in production", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      COOKIE_SECRET: null,
      CSRF_SECRET: "production-csrf-secret-with-at-least-32-chars",
      TOTP_ENCRYPTION_KEY: productionSecurityEnv.TOTP_ENCRYPTION_KEY,
      CORS_ORIGINS: "https://app.goalix.local",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("COOKIE_SECRET");
  });

  it("allows only configured production CORS origins", () => {
    const result = runNode(
      [
        "const { isAllowedOrigin } = require('./src/config/cors');",
        "if (!isAllowedOrigin('https://app.goalix.local')) process.exit(1);",
        "if (isAllowedOrigin('https://evil.example')) process.exit(2);",
      ].join(""),
      {
        NODE_ENV: "production",
        COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
        TOTP_ENCRYPTION_KEY: productionTotpKey,
        CORS_ORIGINS: "https://app.goalix.local",
      },
    );

    expect(result.status).toBe(0);
  });

  it("rejects placeholder-looking production secrets even when they pass length checks", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      JWT_SECRET: "replace-with-at-least-32-random-characters",
      COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
      TOTP_ENCRYPTION_KEY: productionTotpKey,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("JWT_SECRET");
  });

  it("requires a TOTP encryption key in production", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
      CSRF_SECRET: "production-csrf-secret-with-at-least-32-chars",
      TOTP_ENCRYPTION_KEY: null,
      CORS_ORIGINS: "https://app.goalix.local",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("TOTP_ENCRYPTION_KEY");
  });

  it("requires an explicit CSRF secret in production", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      ...productionSecurityEnv,
      CSRF_SECRET: null,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("CSRF_SECRET");
  });

  it("requires strong bcrypt rounds in production", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      ...productionSecurityEnv,
      BCRYPT_ROUNDS: "10",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("BCRYPT_ROUNDS");
  });

  it("rejects matching JWT access and refresh secrets", () => {
    const result = runNode("require('./src/config/env')", {
      JWT_REFRESH_SECRET: requiredEnv.JWT_SECRET,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("JWT_REFRESH_SECRET");
  });

  it("rejects localhost CORS origins in production", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      ...productionSecurityEnv,
      CORS_ORIGINS: "http://localhost:3001",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("CORS_ORIGINS");
  });

  it("rejects S3 upload storage without required credentials", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "development",
      STORAGE_PROVIDER: "s3",
      S3_BUCKET: null,
      S3_ACCESS_KEY_ID: null,
      S3_SECRET_ACCESS_KEY: null,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("S3 storage requires");
  });

  it("rejects local upload storage in production by default", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
      TOTP_ENCRYPTION_KEY: productionTotpKey,
      STORAGE_PROVIDER: "local",
      ALLOW_LOCAL_UPLOAD_STORAGE_IN_PRODUCTION: null,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("STORAGE_PROVIDER=s3");
  });

  it("allows local production uploads only with an explicit shared-volume override", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
      TOTP_ENCRYPTION_KEY: productionTotpKey,
      STORAGE_PROVIDER: "local",
      ALLOW_LOCAL_UPLOAD_STORAGE_IN_PRODUCTION: "true",
    });

    expect(result.status).toBe(0);
  });

  it("requires a metrics token when production metrics are enabled", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
      TOTP_ENCRYPTION_KEY: productionTotpKey,
      METRICS_ENABLED: "true",
      METRICS_TOKEN: null,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("METRICS_TOKEN");
  });

  it("accepts queue and redis production hardening flags", () => {
    const result = runNode(
      [
        "const env = require('./src/config/env');",
        "if (env.REDIS_REQUIRED !== true) process.exit(1);",
        "if (env.QUEUE_REDIS_FAILURE_MODE !== 'throw') process.exit(2);",
      ].join(""),
      {
        NODE_ENV: "production",
        COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
        TOTP_ENCRYPTION_KEY: productionTotpKey,
        REDIS_REQUIRED: "true",
        QUEUE_REDIS_FAILURE_MODE: "throw",
      },
    );

    expect(result.status).toBe(0);
  });

  it("lets production migrations disable database SSL explicitly", () => {
    const result = runNode(
      [
        "const config = require('./knexfile');",
        "if (config.production.connection.ssl !== false) process.exit(1);",
      ].join(""),
      {
        NODE_ENV: "production",
        DATABASE_SSL: "false",
      },
    );

    expect(result.status).toBe(0);
  });

  it("requires production Redis to fail fast instead of silently degrading", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
      TOTP_ENCRYPTION_KEY: productionTotpKey,
      REDIS_REQUIRED: "false",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("REDIS_REQUIRED");
  });

  it("requires production queues to throw when Redis is unavailable", () => {
    const result = runNode("require('./src/config/env')", {
      NODE_ENV: "production",
      COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
      TOTP_ENCRYPTION_KEY: productionTotpKey,
      QUEUE_REDIS_FAILURE_MODE: "skip",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain(
      "QUEUE_REDIS_FAILURE_MODE",
    );
  });

  it("parses the legacy upload metadata fallback flag explicitly", () => {
    const result = runNode(
      [
        "const env = require('./src/config/env');",
        "if (env.UPLOAD_LEGACY_METADATA_FALLBACK_ENABLED !== false) process.exit(1);",
      ].join(""),
      {
        NODE_ENV: "production",
        COOKIE_SECRET: "production-cookie-secret-with-at-least-32-chars",
        TOTP_ENCRYPTION_KEY: productionTotpKey,
        UPLOAD_LEGACY_METADATA_FALLBACK_ENABLED: "false",
      },
    );

    expect(result.status).toBe(0);
  });
});
