import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const e2eAccessJwtSecret =
  process.env.GOALIX_ACCESS_JWT_SECRET ||
  "playwright-e2e-access-secret-32-chars-minimum";

process.env.GOALIX_ACCESS_JWT_SECRET = e2eAccessJwtSecret;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: "npm run dev:frontend",
        env: {
          ...process.env,
          GOALIX_ACCESS_JWT_SECRET: e2eAccessJwtSecret,
        },
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
