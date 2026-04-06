import { expect, type BrowserContext, type Page } from "@playwright/test";
import { ADMIN_TOKEN, MC_URL } from "./auth";

export async function ensureAdminSession(context: BrowserContext) {
  const response = await context.request.post(`${MC_URL}/api/auth/init`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  expect(response.ok()).toBeTruthy();
  return response;
}

export async function ensurePageIsAuthenticated(page: Page) {
  await ensureAdminSession(page.context());
}
