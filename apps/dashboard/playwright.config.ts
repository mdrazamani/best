import path from "node:path";
import { defineConfig } from "@playwright/test";

const artifactDir = path.resolve(process.env.ERRNOX_E2E_ARTIFACT_DIR ?? "artifacts/e2e-dashboard/latest");

export default defineConfig({
  testDir: path.resolve("e2e"),
  testMatch: ["**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 6 * 60 * 1000,
  expect: {
    timeout: 20_000,
  },
  retries: process.env.CI ? 1 : 0,
  outputDir: path.join(artifactDir, "test-results"),
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(artifactDir, "reports", "playwright.json") }],
    ["html", { outputFolder: path.join(artifactDir, "playwright-report"), open: "never" }],
  ],
  use: {
    baseURL: process.env.ERRNOX_E2E_BASE_URL ?? "http://127.0.0.1:3002",
    headless: true,
    locale: "en-US",
    timezoneId: "UTC",
    trace: "on",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
});
