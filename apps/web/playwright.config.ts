import { defineConfig, devices } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 6 * 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    trace: "off",
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: BASE, reuseExistingServer: true, timeout: 120_000 },
});
