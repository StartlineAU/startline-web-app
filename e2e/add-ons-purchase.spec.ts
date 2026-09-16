import { test, expect } from "@playwright/test";
import { organiserLogin } from "./helpers";

// Paid add-ons: merchandise sold alongside the entry. Extras are chosen per
// participant on step 2, because sizes are inherently per person, so the picker
// sits under each ticket's details form.
//
// The catalogue is established here rather than read from the seed, and on a
// different event from the seeded merchandise on purpose.
// e2e/add-ons-catalogue.spec.ts empties seed-event-001's catalogue repeatedly as
// part of its own setup, and files run concurrently across workers, so sharing
// that event would let a wipe land in the middle of a purchase test. Owning the
// fixture on an event nothing else touches is what makes these deterministic.
const EVENT_ID = "seed-event-005";
const REG = `/events/${EVENT_ID}/register`;
const CATALOGUE = `/api/organiser/events/${EVENT_ID}/add-ons`;

test.beforeAll(async ({ browser }) => {
  // This hook signs in, compiles two organiser routes and compiles the athlete
  // register page, any of which can be a first-hit Next.js compile. On a cold
  // .next that is minutes, not seconds, and the default 30s test timeout fails
  // the hook and with it every test in the file. Generous on purpose: it costs
  // nothing on a warm server, where the whole hook is under a second.
  test.setTimeout(300_000);

  const page = await browser.newPage();
  await organiserLogin(page);
  const res = await page.request.put(CATALOGUE, {
    data: {
      addOns: [
        {
          name: "Event tee",
          description: "Unisex fit, 100% cotton.",
          priceCents: 2500,
          imageUrl: null,
          optionLabel: "Size",
          variants: [
            { label: "S", stock: 25 },
            { label: "M", stock: 40 },
            { label: "L", stock: 30 },
            // Deliberately sold out: "sold out" is the state most worth being
            // able to look at.
            { label: "XL", stock: 0 },
          ],
        },
        {
          name: "Parking pass",
          description: "Reserved bay in the event car park for the day.",
          priceCents: 1200,
          imageUrl: null,
          optionLabel: "Day",
          variants: [{ label: "Saturday", stock: 60 }],
        },
      ],
    },
  });
  expect(res.ok()).toBeTruthy();

  // Warm the athlete-facing route and its availability endpoint here rather than
  // paying for both compiles inside the first test's 30s budget. domcontentloaded
  // rather than networkidle: this only needs the routes compiled, not the page
  // settled, and the tests below do their own waiting.
  await page.goto(REG, { waitUntil: "domcontentloaded" });
  await page.request.get(`/api/events/${EVENT_ID}/availability`);

  await page.close();
});

async function addTickets(page: import("@playwright/test").Page, count = 1) {
  const plus = page.getByRole("button", { name: /add one .* ticket/i }).first();
  for (let i = 0; i < count; i++) await plus.click();
}

async function goToDetails(page: import("@playwright/test").Page, tickets = 1) {
  await page.goto(REG);
  await page.waitForLoadState("networkidle");
  await addTickets(page, tickets);
  await page.getByRole("button", { name: /^Continue/ }).click();
}

test.describe("paid add-ons", () => {
  test("teases the extras on the ticket step, where participants do not exist yet", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/extras available/i)).toBeVisible();
    await expect(page.getByText(/Event tee/).first()).toBeVisible();
    await expect(page.getByText(/add them to each ticket on the next step/i)).toBeVisible();
  });

  test("shows the picker under the details form, grouped by its option label", async ({ page }) => {
    await goToDetails(page);

    await expect(page.getByText(/add extras/i)).toBeVisible();
    await expect(page.getByText("Event tee", { exact: true })).toBeVisible();
    await expect(page.getByText(/unisex fit/i)).toBeVisible();
    // The organiser names the option group; it is not hardcoded to "Size".
    await expect(page.getByText("Size", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Day", { exact: true }).first()).toBeVisible();
  });

  test("a size with no stock reads as sold out and cannot be added", async ({ page }) => {
    await goToDetails(page);

    await expect(page.getByRole("button", { name: /add one event tee XL/i })).toHaveCount(0);
    await expect(page.getByText(/sold out/i).first()).toBeVisible();
  });

  test("adding an extra puts a line on the order summary and moves the total", async ({ page }) => {
    await goToDetails(page);

    const totalBefore = await page.getByText(/^\$[\d,.]+$/).last().textContent();

    await page.getByRole("button", { name: /add one event tee M/i }).click();

    // The summary line carries the ticket number, so a group booking cannot
    // collide on duplicate labels.
    await expect(page.getByText(/Ticket 1 · Event tee \(M\) × 1/)).toBeVisible();
    const totalAfter = await page.getByText(/^\$[\d,.]+$/).last().textContent();
    expect(totalAfter).not.toBe(totalBefore);
  });

  test("removing an extra takes its line back off the summary", async ({ page }) => {
    await goToDetails(page);

    await page.getByRole("button", { name: /add one event tee M/i }).click();
    await expect(page.getByText(/Ticket 1 · Event tee \(M\) × 1/)).toBeVisible();

    await page.getByRole("button", { name: /remove one event tee M/i }).click();
    await expect(page.getByText(/Ticket 1 · Event tee \(M\)/)).toHaveCount(0);
  });

  test("each participant in a group booking gets their own extras", async ({ page }) => {
    await goToDetails(page, 2);

    // Ticket 1's accordion is open first.
    await page.getByRole("button", { name: /^Ticket 1 add one event tee M/i }).click();
    await expect(page.getByText(/Ticket 1 · Event tee \(M\) × 1/)).toBeVisible();

    // Open ticket 2 and buy the same shirt for them.
    await page.getByRole("button", { name: /Ticket 2 of 2/i }).click();
    await page.getByRole("button", { name: /^Ticket 2 add one event tee M/i }).click();

    // Two distinct lines, which is exactly what keeps the summary's React keys
    // unique when two people buy the same item.
    await expect(page.getByText(/Ticket 1 · Event tee \(M\) × 1/)).toBeVisible();
    await expect(page.getByText(/Ticket 2 · Event tee \(M\) × 1/)).toBeVisible();
  });

  test("extras survive into the review step", async ({ page }) => {
    await goToDetails(page);

    await page.getByRole("button", { name: /add one parking pass Saturday/i }).click();
    await expect(page.getByText(/Ticket 1 · Parking pass \(Saturday\) × 1/)).toBeVisible();
  });
});
