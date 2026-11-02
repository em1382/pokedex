import { availableParallelism } from "node:os";

import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build of the frontend and the
// Rails API with a small fixture database (backend/test/e2e/pokeapi.json), on
// their own ports so they don't clash with `pnpm dev`.
const API_PORT = 3101;
const WEB_PORT = 3100;
const RAILS_API_URL = `http://127.0.0.1:${API_PORT}`;
const E2E_DATABASE = "DATABASE_URL=sqlite3:storage/e2e.sqlite3";
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Playwright's default (half the CPUs) counts the host's CPUs even in a container
  // with a CPU limit, which overloads it; availableParallelism respects the limit.
  workers: Math.max(1, Math.floor(availableParallelism() / 2)),
  forbidOnly: CI,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Fresh fixture data on every run; its own pid file so a dev server can keep running.
      command:
        `cd ../backend && ${E2E_DATABASE} bin/rails db:prepare e2e:seed && ` +
        `${E2E_DATABASE} exec bin/rails server -b 127.0.0.1 -p ${API_PORT} -P tmp/pids/e2e.pid`,
      url: `${RAILS_API_URL}/up`,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      // Own build folder: building into .next would break a running `pnpm dev`.
      command: `pnpm build && pnpm start -H 127.0.0.1 -p ${WEB_PORT}`,
      env: { RAILS_API_URL, NEXT_DIST_DIR: ".next-e2e" },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !CI,
      timeout: 300_000,
    },
  ],
});
