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

export async function organiserLogin(page: Page, email = "test.organiser@startlineau.com"): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto("/organiser");
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: /sign in to portal/i }).waitFor({ state: "visible", timeout: 8000 });
      break;
    } catch {
      if (attempt === 2) throw new Error("Organiser login page failed to load after 3 attempts");
      await page.waitForTimeout(3000);
    }
  }

  await page.getByPlaceholder(/events@/i).fill(email);
  await page.locator('input[type="password"]').first().fill("Password123!");
  await page.getByRole("button", { name: /sign in to portal/i }).click();

  await page.waitForURL("**/organiser/dashboard**", { timeout: 30000 });
}

export async function adminLogin(page: Page, email = "admin@startlineau.com"): Promise<void> {
  // Navigate to login page - may need retries for Turbopack cold start
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto("/admin/login");
      await page.waitForLoadState("networkidle");
      await page.waitForSelector('button:has-text("Sign in")', { state: "visible", timeout: 8000 });
      break;
    } catch {
      if (attempt === 2) throw new Error("Login page failed to load after 3 attempts");
      await page.waitForTimeout(3000);
    }
  }

  await page.getByPlaceholder(/admin@startlineau/i).fill(email);
  await page.locator('input[type="password"]').first().fill("Password123!");
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL("**/admin/dashboard**", { timeout: 30000 });
}
