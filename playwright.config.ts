import { defineConfig } from "@playwright/test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const data = mkdtempSync(join(tmpdir(), "yenze-e2e-"));
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3070",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: existsSync(chrome) ? chrome : undefined,
      args: ["--use-angle=swiftshader", "--enable-webgl"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node server/index.mjs",
      url: "http://127.0.0.1:3071/api/health",
      env: {
        PORT: "3071",
        YENZE_DATA_DIR: data,
        APP_ORIGIN: "http://127.0.0.1:3070",
        STRIPE_SECRET_KEY: "",
      },
    },
    {
      command: "npm run dev:ui -- --port 3070",
      url: "http://127.0.0.1:3070",
      env: { YENZE_API_URL: "http://127.0.0.1:3071" },
    },
  ],
});
