import { existsSync, readFileSync } from "fs";
import { defineConfig, devices } from "@playwright/test";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const raw = readFileSync(filePath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.test.local");
loadEnvFile(".env.local");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 1,
  timeout: 30000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1"
    ? undefined
    : {
        command: "node ./node_modules/next/dist/bin/next dev -p 3001",
        url: process.env.HITECHCLAW_AI_BASE_URL ?? "http://localhost:3001",
        reuseExistingServer: true,
        timeout: 120000,
      },
  use: {
    baseURL: process.env.HITECHCLAW_AI_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    video: "off",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
