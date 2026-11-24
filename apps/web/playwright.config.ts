import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3121",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
  },
  webServer: {
    command: "node ../../scripts/setup.mjs start -H 127.0.0.1 -p 3121",
    url: "http://127.0.0.1:3121",
    env: {
      SINGLE_USER: "true",
      AUTH_TRUST_HOST: "true",
      DATABASE_URL: "file:./data/e2e.db",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    timeout: 90000,
  },
});
