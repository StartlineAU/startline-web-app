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

    // The disciplines live in the Category dialog behind the banner pill.
    await page.getByRole("button", { name: "Choose category" }).click();
    const dialog = page.getByRole("dialog", { name: "Category" });
    for (const name of ["Running", "Run Club", "Other"]) {
      await expect(dialog.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible({ timeout: 15000 });
    }
    for (const name of REMOVED) {
      await expect(dialog.getByRole("button", { name: new RegExp(`^${name}`) })).toHaveCount(0);
    }
  });
});

test.describe("about page (#539)", () => {
  test("carries the SEO title, description, H1 and indexing", async ({ page }) => {
    await page.goto("/about");

    const title = await page.title();
    expect(title).toBe("About Startline | Running & Fitness Events in Australia");
    expect(title.length).toBeLessThanOrEqual(60);

    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toMatch(/Melbourne-born/);
    expect(description!.length).toBeLessThanOrEqual(155);

    await expect(page.getByRole("heading", { level: 1 }))
      .toHaveText("About Startline: Your Start Line for Every Race in Australia");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/about$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index, follow/);
  });

  test("publishes Organization schema and no FAQ", async ({ page }) => {
    await page.goto("/about");

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const schemas = blocks.map((b) => JSON.parse(b));
    const org = schemas.find((s) => s["@type"] === "Organization");

    expect(org).toMatchObject({ name: "Startline", url: "https://www.startlineau.com" });
    expect(org.logo).toMatch(/^https:\/\/.+\/images\/logo\.png$/);
    expect(org.sameAs).toContain("https://www.instagram.com/startlineau/");

    // The FAQ lives on /faq, not here.
    expect(schemas.some((s) => s["@type"] === "FAQPage")).toBe(false);
    await expect(page.locator("main details")).toHaveCount(0);
  });

  test("links to events and contact", async ({ page }) => {
    await page.goto("/about");
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "/events");
    await expect(main.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute("href", "/contact");
  });
});
