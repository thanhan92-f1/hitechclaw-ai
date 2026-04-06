import { test as setup, expect } from "@playwright/test";
import { ADMIN_TOKEN, MC_URL } from "../helpers/auth";

const authFile = "tests/.auth/admin.json";

setup("authenticate admin session", async ({ page }) => {
  const response = await page.context().request.post(`${MC_URL}/api/auth/init`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  expect(response.ok()).toBeTruthy();
  await page.context().storageState({ path: authFile });
});
