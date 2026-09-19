import { test, expect, type Page } from "@playwright/test";
import { organiserLogin } from "./helpers";

// Profile merchandise (#338): items an organiser shows on their public
// profile, and copies into an event's checkout.

// Sarah Mitchell's own event, so the ownership guard on the add-ons route passes.
const EVENT_ID = "seed-event-001";
const CATALOGUE = `/api/organiser/events/${EVENT_ID}/add-ons`;
const MERCHANDISE = "/api/organiser/merchandise";

const tee = {
  name: "Club tee",
  description: "Soft cotton, club colours.",
  priceCents: 3500,
  imageUrl: null,
  optionLabel: "Size",
  options: ["S", "M", "L"],
};

/** Starts each test with an empty profile and an event selling nothing. */
async function reset(page: Page): Promise<void> {
  expect((await page.request.put(CATALOGUE, { data: { addOns: [] } })).ok()).toBeTruthy();
  expect((await page.request.put(MERCHANDISE, { data: { merchandise: [] } })).ok()).toBeTruthy();
}

async function organiserId(page: Page): Promise<string> {
  const res = await page.request.get("/api/organiser/profile");
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

test.describe.configure({ mode: "serial" });

test.describe("organiser profile merchandise", () => {
  test.beforeEach(async ({ page }) => {
    await organiserLogin(page);
    await reset(page);
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await organiserLogin(page);
    await reset(page);
    await page.close();
  });

  test("an organiser adds an item on their profile and athletes see it", async ({ page }) => {
    // Three pages, each a cold compile on a fresh dev server.
    test.slow();
    await page.goto("/organiser/profile");
    const section = page.getByTestId("merchandise-manager");
    await section.getByRole("button", { name: /add your first item/i }).click();

    // The profile has no stock: that is set per event.
    await expect(section.getByLabel("Units available for option 1")).toHaveCount(0);

    await section.locator("#addon-name-0").fill("Club tee");
    await section.locator("#addon-price-0").fill("35");
    await section.getByRole("button", { name: /save merchandise/i }).click();

    await expect(section.getByTestId("merchandise-showcase")).toContainText("Club tee");
    await expect(section.getByTestId("merchandise-showcase")).toContainText("$35");

    const res = await page.request.get(MERCHANDISE);
    expect((await res.json()).merchandise).toHaveLength(1);

    await page.goto(`/organisers/${await organiserId(page)}`);
    const showcase = page.getByTestId("merchandise-showcase");
    await expect(showcase).toContainText("Club tee");
    await expect(showcase).toContainText(/not on sale at an event right now/i);
  });

  test("athletes do not see an empty merchandise section", async ({ page }) => {
    await page.goto(`/organisers/${await organiserId(page)}`);
    await expect(page.getByRole("heading", { name: /^Upcoming Events/i })).toBeVisible();
    await expect(page.getByTestId("merchandise-showcase")).toHaveCount(0);
  });

  test("the event editor offers profile items and explains what is public", async ({ page }) => {
    expect((await page.request.post(MERCHANDISE, { data: { item: tee } })).status()).toBe(201);

    await page.goto(`/organiser/new-listing?id=${EVENT_ID}`);
    await expect(page).toHaveURL(/\/organiser\/new-listing/);
    await page.waitForLoadState("networkidle");
    await page.getByText("Tickets & Pricing").first().click();

    await expect(page.getByText(/exclusive to this event's checkout/i)).toBeVisible();
    // The editor loads the profile list itself, so the picker arrives after it.
    const picker = page.getByTestId("addon-profile-picker");
    const item = picker.getByRole("button", { name: /club tee/i });
    await expect(item).toBeVisible({ timeout: 20000 });
    await item.click();

    // Copied in with its options and the link to the profile, but no stock:
    // how many this event has is the organiser's call.
    await expect(page.locator("#addon-name-0")).toHaveValue("Club tee");
    await expect(page.locator("#addon-price-0")).toHaveValue("35.00");
    await expect(page.getByLabel("Option name 2")).toHaveValue("M");
    await expect(page.getByLabel("Units available for option 1")).toHaveValue("");
    await expect(page.getByText(/on your public profile\./i)).toBeVisible();

    // Already in this event, so it leaves the picker.
    await expect(picker).toHaveCount(0);
  });

  test("an event's item published to the profile shows where it is on sale", async ({ page }) => {
    const created = await page.request.post(MERCHANDISE, { data: { item: tee } });
    const { id: merchandiseId } = await created.json();

    const saved = await page.request.put(CATALOGUE, {
      data: {
        addOns: [{
          name: "Club tee", description: null, priceCents: 3500, imageUrl: null,
          optionLabel: "Size", merchandiseId,
          variants: [{ label: "M", stock: 10 }],
        }],
      },
    });
    expect(saved.ok()).toBeTruthy();
    expect((await saved.json()).addOns[0].merchandiseId).toBe(merchandiseId);

    await page.goto(`/organisers/${await organiserId(page)}`);
    const showcase = page.getByTestId("merchandise-showcase");
    await expect(showcase).toContainText(/add it to your entry at/i);
    await expect(showcase.locator(`a[href="/events/${EVENT_ID}"]`)).toBeVisible();
  });

  test("ticking 'also show on my profile' publishes a copy when the event saves", async ({ page }) => {
    // The race management dashboard is the heaviest page in the portal.
    test.slow();
    await page.goto(`/organiser/events/${EVENT_ID}/dashboard?panel=manage`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^add-ons/i }).click();

    await page.getByRole("button", { name: /add merchandise/i }).click();
    await page.locator("#addon-name-0").fill("Finisher cap");
    await page.locator("#addon-price-0").fill("20");
    for (let i = 1; i <= 3; i++) await page.getByLabel(`Units available for option ${i}`).fill("5");
    await page.getByLabel(/also show on my public profile/i).check();
    await page.getByRole("button", { name: /save merchandise/i }).click();

    await expect(page.getByText("Add-ons saved.")).toBeVisible();
    await expect(page.getByText(/on your public profile\./i)).toBeVisible();

    const profile = await (await page.request.get(MERCHANDISE)).json();
    expect(profile.merchandise.map((m: { name: string }) => m.name)).toEqual(["Finisher cap"]);
    const catalogue = await (await page.request.get(CATALOGUE)).json();
    expect(catalogue.addOns[0].merchandiseId).toBe(profile.merchandise[0].id);
  });
});
