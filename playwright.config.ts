import "dotenv/config";
import { defineConfig } from "@playwright/test";
import { assertTestDatabase } from "./lib/test-database";
const databaseUrl = assertTestDatabase(process.env.DATABASE_URL);
export default defineConfig({
  globalSetup: "./tests/e2e/setup.ts",
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      process.env.E2E_PRODUCTION === "true" ? "npm run start" : "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      APP_ORIGIN: "http://localhost:3000",
    },
  },
});
