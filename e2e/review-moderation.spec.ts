import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { adminLogin, ensureDatabaseUrl } from "./helpers";

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Issue #374: reporting goes through a reason overlay and reaches the admin
// Reported tab, an edited review replaces its card instead of duplicating it,
// and reviews can be filtered by event.
//
// Harper Jones (the "athlete" bypass identity) does the reporting. The seeded
// reviews have no author, so Harper can report them. Every run removes what it
// created, so it repeats cleanly.
const ATHLETE_EMAIL = "harper.jones@startline.test";
const REPORTED_REVIEW = "seed-review-007"; // Apex, "Challenging but rewarding"

async function athleteId(): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email: ATHLETE_EMAIL }, select: { id: true } });
  expect(user, "seed Harper Jones with CI=true").toBeTruthy();
  return user!.id;
}

async function apexOrganiserId(): Promise<string> {
  const review = await prisma.review.findUnique({ where: { id: REPORTED_REVIEW }, select: { organiserId: true } });
  expect(review, "seed reviews missing").toBeTruthy();
  return review!.organiserId;
}

async function cleanUp(): Promise<void> {
  const userId = await athleteId();
  await prisma.reviewReport.deleteMany({ where: { userId } });
  await prisma.reviewReport.deleteMany({ where: { reviewId: REPORTED_REVIEW } });
  await prisma.review.deleteMany({ where: { userId } });
  // Both routes allow 10 an hour per user; repeat local runs would hit that.
  await prisma.$executeRaw`DELETE FROM "rate_limits" WHERE "key" IN (${`review:${userId}`}, ${`review-report:${userId}`})`;
}

async function signInAsAthlete(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: "athlete", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

test.describe("review moderation (#374)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(cleanUp);
  test.afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  test("report API needs a listed reason and refuses your own review", async ({ page }) => {
    await signInAsAthlete(page);
    const organiserId = await apexOrganiserId();

    const noReason = await page.request.post(`/api/public/review/${REPORTED_REVIEW}/report`, { data: {} });
    expect(noReason.status()).toBe(400);

    const otherNoDetails = await page.request.post(`/api/public/review/${REPORTED_REVIEW}/report`, {
      data: { reason: "Other" },
    });
    expect(otherNoDetails.status()).toBe(400);

    const ok = await page.request.post(`/api/public/review/${REPORTED_REVIEW}/report`, {
      data: { reason: "Spam or advertising", details: "Links to a shop." },
    });
    expect(ok.status()).toBe(201);
    const stored = await prisma.reviewReport.findFirst({ where: { reviewId: REPORTED_REVIEW } });
    expect(stored?.reason).toBe("Spam or advertising: Links to a shop.");

    const again = await page.request.post(`/api/public/review/${REPORTED_REVIEW}/report`, {
      data: { reason: "Spam or advertising" },
    });
    expect(again.status()).toBe(409);

    const own = await page.request.post(`/api/public/reviews/${organiserId}`, {
      data: { overallRating: 4, title: "Own review", body: "Written by the reporter.", eventId: null },
    });
    expect(own.status()).toBe(201);
    const ownReport = await page.request.post(`/api/public/review/${(await own.json()).id}/report`, {
      data: { reason: "Spam or advertising" },
    });
    expect(ownReport.status()).toBe(400);
  });

  test("Report opens a reason overlay and the admin sees it under Reported", async ({ page, browser }) => {
    await signInAsAthlete(page);
    await page.goto(`/organisers/${await apexOrganiserId()}`);

    const card = page.locator(`[data-review-id="${REPORTED_REVIEW}"]`);
    await card.getByRole("button", { name: "Report" }).click();

    const dialog = page.getByRole("dialog", { name: "Report review" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(dialog.getByText("Choose a reason for the report.")).toBeVisible();

    await dialog.getByLabel("Offensive or abusive").check();
    await dialog.getByLabel(/details/i).fill("Insults another athlete.");
    await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(dialog.getByText("Report sent")).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
    await expect(card.getByText("Reported", { exact: true })).toBeVisible();

    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await adminLogin(admin);
    await admin.goto("/admin/reviews?filter=reported");
    await expect(admin.getByText("Challenging but rewarding")).toBeVisible();
    await expect(admin.getByText("Offensive or abusive: Insults another athlete.")).toBeVisible();

    await admin.getByRole("button", { name: "Dismiss" }).first().click();
    await expect(admin.getByText("Challenging but rewarding")).toHaveCount(0);
    expect(await prisma.reviewReport.count({ where: { reviewId: REPORTED_REVIEW } })).toBe(0);
    await adminContext.close();
  });

  test("editing your review replaces its card instead of adding a copy", async ({ page }) => {
    await signInAsAthlete(page);
    const organiserId = await apexOrganiserId();
    const created = await page.request.post(`/api/public/reviews/${organiserId}`, {
      data: { overallRating: 5, title: "First take", body: "Before the edit.", eventId: null },
    });
    expect(created.status()).toBe(201);
    const { reviewerName } = await created.json();

    await page.goto(`/organisers/${organiserId}`);
    const reviews = page.locator("#reviews");
    await reviews.getByRole("button", { name: "Edit your review" }).click();
    await page.getByPlaceholder("Summarise your experience…").fill("Second take");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Review submitted!")).toBeVisible();

    await expect(reviews.getByText("Second take", { exact: true })).toHaveCount(1, { timeout: 10000 });
    await expect(reviews.getByText("First take", { exact: true })).toHaveCount(0);
    await expect(reviews.getByText("Startline user", { exact: true })).toHaveCount(0);
    await expect(reviews.getByText(reviewerName, { exact: true }).first()).toBeVisible();
  });

  test("reviews can be filtered by event", async ({ page }) => {
    const organiserId = await apexOrganiserId();
    const event = await prisma.review.findUnique({ where: { id: REPORTED_REVIEW }, select: { eventTitle: true } });
    const eventTitle = event!.eventTitle!;

    await page.goto(`/organisers/${organiserId}`);
    const reviews = page.locator("#reviews");
    await expect(reviews.getByText(/^Showing all \d+ reviews$/)).toBeVisible();

    await reviews.getByRole("combobox", { name: "Filter reviews by event" }).click();
    await page.getByRole("option", { name: new RegExp(`^${eventTitle} \\(\\d+\\)$`) }).click();

    await expect(reviews.getByText(/^Showing \d+ of \d+ reviews$/)).toBeVisible();
    await expect(reviews.getByText("Challenging but rewarding")).toBeVisible();
    // seed-review-003 is on a different event and must drop out.
    await expect(reviews.getByText("Brilliant event, will be back")).toHaveCount(0);
  });
});
