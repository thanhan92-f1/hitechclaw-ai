import type { Page } from "@playwright/test";

export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export function filterBenignPageErrors(errors: string[]): string[] {
  return errors.filter((error) => !error.includes("ResizeObserver"));
}
