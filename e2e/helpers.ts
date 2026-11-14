import { expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "fs";

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

export async function organiserLogin(page: Page, _email = "sarah.mitchell@startline.test"): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "organiser", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  await page.goto("/organiser/dashboard");
  await page.waitForURL("**/organiser/dashboard**", { timeout: 15000 });
}

export async function organiserMemberLogin(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "member", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  await page.goto("/organiser/dashboard");
  await page.waitForURL("**/organiser/dashboard**", { timeout: 15000 });
}

/**
 * Open the settings dialog from an already-loaded organiser page.
 *
 * "Edit Profile" is server-rendered: a click that lands before React hydrates
 * focuses the button but never fires onClick, so no dialog appears. The modal
 * itself also waits for AuthContext to resolve, which happens in an effect
 * after hydration. On CI the dev server is compiling routes while this runs, so
 * the wait is long — retry the open until the dialog is actually up rather than
 * hoping the first click won.
 *
 * Callers should mark their test `test.slow()`: this can consume most of the
 * default budget and the test has real work left to do after it returns.
 */
export async function openOrganiserSettings(page: Page) {
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(async () => {
    if (!(await settings.isVisible())) {
      await page.getByRole("button", { name: "Edit Profile" }).click();
    }
    await expect(settings).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 40000 });
  return settings;
}

// Avery Quinn — MANAGER of both Apex Endurance Events and Coastal Fitness
// Collective (no OWNER role). The only seeded user whose active organiser is
// decided purely by the startline_active_org cookie (issue #231).
export async function multiOrganiserLogin(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "avery", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  await page.goto("/organiser/dashboard");
  await page.waitForURL("**/organiser/dashboard**", { timeout: 15000 });
}

export async function adminLogin(page: Page, _email = "marcus.stirling@startline.test"): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "admin", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
  await page.goto("/admin/dashboard");
  await page.waitForURL("**/admin/dashboard**", { timeout: 15000 });
}

// Resets a seeded registration on seed-event-001 back to a known state so
// tests that mutate shared seed rows stay idempotent across runs/retries.
// Uses the organiser API so the bypass cookie covers auth.
export async function resetRegistration(
  page: Page,
  athleteName: string,
  patch: Record<string, string | null>,
): Promise<void> {
  const res = await page.request.get("/api/organiser/events/seed-event-001/registrations");
  expect(res.ok()).toBeTruthy();
  const { registrations } = await res.json();
  const reg = registrations.find((r: { name: string }) => r.name === athleteName);
  expect(reg, `expected a seeded registration for ${athleteName}`).toBeTruthy();
  const patchRes = await page.request.patch("/api/organiser/events/seed-event-001/registrations", {
    data: { registrations: [{ registrationId: reg.id, ...patch }] },
  });
  expect(patchRes.ok()).toBeTruthy();
}

/**
 * Pick a time from the shared TimePicker popover.
 *
 * The wizard used a native `input[type="time"]` that tests drove with .fill().
 * It is now a custom popover (the OS panel ignored the design system), so there
 * is no input to fill: open the trigger, choose from three listboxes, confirm.
 *
 * `name` is the trigger's accessible name, e.g. "Start time".
 */
export async function pickTime(
  page: Page,
  name: string,
  time: { hour: string; minute: string; period: "AM" | "PM" },
): Promise<void> {
  // Close anything already open. The date picker stays open in "pick end date"
  // mode after a start date is chosen, and its calendar overlays this field, so
  // the click would never land. Popover triggers toggle, so clicking the open
  // one shuts it.
  for (const open of await page
    .locator('button[aria-haspopup="dialog"][aria-expanded="true"]')
    .all()) {
    await open.click();
  }

  const trigger = page.getByRole("button", { name, exact: true });
  const panel = page.getByRole("dialog", { name: /choose a time/i });

  await trigger.click();
  await expect(panel).toBeVisible();

  await panel.getByRole("listbox", { name: "Hour" })
    .getByRole("option", { name: time.hour, exact: true }).click();
  await panel.getByRole("listbox", { name: "Minute" })
    .getByRole("option", { name: time.minute, exact: true }).click();
  await panel.getByRole("listbox", { name: "AM or PM" })
    .getByRole("option", { name: time.period, exact: true }).click();

  await panel.getByRole("button", { name: /^done$/i }).click();
  await expect(panel).toBeHidden();
}

/**
 * The organiser dashboard has landed. It used to be asserted with an <h1>
 * greeting that the header tidy-up removed, so anchor on the metric strip and
 * the primary action instead - both are load-bearing UI, not decoration.
 */
export async function expectOrganiserDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/organiser\/dashboard/);
  await expect(page.getByText("All time", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /add listing/i })).toBeVisible();
}

/**
 * Point Prisma at the same database the dev server uses, for specs that set up
 * or clean up rows directly.
 *
 * Reads DATABASE_URL from .env.local, then .env: a worktree keeps its own in
 * .env.local, while a plain checkout has only .env. Quotes are stripped, since
 * dotenv allows them and a connection string carrying them fails to parse.
 * Only this one variable is read — loading a whole env file would leak
 * NEXT_PUBLIC_* values (e.g. a real Cognito pool id) into the shared worker
 * env and make auth.spec's hasCognito guard run its real-Cognito tests.
 */
export function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const value = readFileSync(file, "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
    if (value) {
      process.env.DATABASE_URL = value.replace(/^["']|["']$/g, "");
      return;
    }
  }
}

/**
 * Open a row of the listing editor's Event Details card (#528): date, time,
 * location, format, divisions or intensity. Each row opens in place;
 * a row that is already open is left as it is.
 */
export async function openDetail(page: Page, row: string): Promise<void> {
  // A finished row opens the next one by itself, so the row may already be
  // open, or open between looking and clicking. Only ever click it open.
  const toggle = page.locator(`#region-${row} button[aria-expanded]`).first();
  await expect(async () => {
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true", { timeout: 1500 });
  }).toPass({ timeout: 15000 });
}

/**
 * Set a single-day event on today's date in the listing editor, then close
 * the calendar. After a start date the calendar stays open for an end date,
 * and it can drop down over the Time row and swallow a click on it, so close
 * it by clicking away, as an organiser would.
 */
export async function pickSingleDayToday(page: Page): Promise<void> {
  await openDetail(page, "date");
  await page.getByText("Pick start date").click();
  await page.getByRole("button", { name: /today/i }).click();
  await page.getByRole("heading", { name: /Event Overview/ }).click();
  await expect(page.locator('#region-date [aria-haspopup="dialog"]')).toHaveAttribute("aria-expanded", "false");
}

/** Pick the category (stored as discipline) from the pill on the listing editor's banner. */
export async function chooseDiscipline(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Choose category" }).click();
  await page.getByRole("dialog", { name: "Category" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();
}

/**
 * A draft with every field the listing editor requires, so Publish goes
 * straight to the terms dialog. Created through the organiser API for the
 * signed-in organiser; returns its id.
 */
export async function createCompleteDraft(page: Page, title: string): Promise<string> {
  const res = await page.request.post("/api/organiser/events", {
    data: {
      title,
      discipline: "running",
      description: "<p>Flat, fast and friendly.</p>",
      eventDate: "2027-03-14",
      startTime: "07:00",
      endTime: "10:00",
      venue: "Albert Park",
      address: "Aughtie Dr, Albert Park VIC 3206",
      city: "Melbourne",
      state: "vic",
      format: "individual",
      level: "moderate",
      categories: ["10K"],
      cap: 500,
      registrationType: "startline",
      waves: [{ label: "General", price: "45", closes: "", startTime: "", qty: 500 }],
      coverImageUrl: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1600&q=80",
      photos: [],
      submit: false,
    },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()).id;
}
