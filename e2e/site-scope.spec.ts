import { test, expect } from "@playwright/test";
import { organiserLogin } from "./helpers";

// #536: the site lists three disciplines (Running, Run Clubs, Other) and the
// About page is a single short column ending in a Contact link.

const REMOVED = ["CrossFit", "Hybrid", "Cycling", "Swimming", "Triathlon"];

test.describe("reduced disciplines", () => {
  test("the events API filters by run club", async ({ request }) => {
    const res = await request.get("/api/events?type=run_club&limit=50");
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.events.length).toBeGreaterThan(0);
    for (const e of body.events) expect(e.discipline).toBe("run_club");
    expect(body.events.map((e: { id: string }) => e.id)).toContain("seed-event-009");
  });

  test("events under a removed discipline are listed as Other", async ({ request }) => {
    const res = await request.get("/api/events?type=other&limit=50");
    expect(res.status()).toBe(200);
    const body = await res.json();

    // The seed's swims, rides and throwdowns are stored as "other".
    expect(body.events.length).toBeGreaterThan(0);
    for (const e of body.events) expect(e.discipline).toBe("other");
  });

  test("the footer links only the three disciplines", async ({ page }) => {
    await page.goto("/about");
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: "Running", exact: true })).toHaveAttribute("href", "/events?type=running");
    await expect(footer.getByRole("link", { name: "Run Clubs", exact: true })).toHaveAttribute("href", "/events?type=run_club");
    await expect(footer.getByRole("link", { name: "Other", exact: true })).toHaveAttribute("href", "/events?type=other");
    for (const name of REMOVED) {
      await expect(footer.getByRole("link", { name, exact: true })).toHaveCount(0);
    }
  });

  test("the listing wizard offers Running, Run Club and Other", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");

    for (const name of ["Running", "Run Club", "Other"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible({ timeout: 15000 });
    }
    for (const name of REMOVED) {
      await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toHaveCount(0);
    }
  });
});

test.describe("about page", () => {
  test("is one short column with a team photo and a contact link", async ({ page }) => {
    await page.goto("/about");

    await expect(page.getByRole("heading", { level: 1, name: /Built for the start line/i })).toBeVisible();
    await expect(page.getByRole("img", { name: "The Startline founders" })).toBeVisible();
    await expect(page.getByText(/founded by Lachlan Martin, Nathan Sweet, Hugo Shrowder\s+and Noah Helu/i)).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Contact", exact: true })).toHaveAttribute("href", "/contact");
  });
});
