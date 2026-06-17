import type { Page } from "@playwright/test";

export async function goToHomepage(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

export async function searchEvents(page: Page, query: string): Promise<void> {
  const searchInput = page.getByPlaceholder(/search/i);
  if (await searchInput.isVisible()) {
    await searchInput.fill(query);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
}

export async function selectStateFilter(page: Page, state: string): Promise<void> {
  const button = page.getByRole("button", { name: new RegExp(state, "i") });
  if (await button.isVisible()) {
    await button.click();
    await page.waitForTimeout(300);
  }
}

export async function adminLogin(page: Page, email = "test.organiser@startlineau.com"): Promise<void> {
  await page.goto("/admin/login");
  await page.waitForLoadState("networkidle");

  await page.getByPlaceholder(/admin@startlineau/i).fill(email);
  await page.locator('input[type="password"]').first().fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL("**/admin/dashboard**", { timeout: 10000 });
}
