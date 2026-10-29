import { test, expect } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl } from "./helpers";

ensureDatabaseUrl();

// The registration flow is a 3-step design: Select ticket → Your details →
// Review & pay, with a sticky order-summary sidebar. Step 1 uses per-tier
// quantity steppers (mixed-tier orders allowed); step 2 shows one form per
// ticket, as an accordion when there is more than one ticket.
// seed-event-001 has an open tier (Late Entry) plus closed tiers (Early Bird,
// General) relative to the test clock.
const REG = "/events/seed-event-001/register";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Click the first open tier's "+" stepper `count` times. */
async function addTickets(page: import("@playwright/test").Page, count = 1) {
  const plus = page.getByRole("button", { name: /add one .* ticket/i }).first();
  for (let i = 0; i < count; i++) await plus.click();
}

/**
 * Date of birth uses the themed DatePicker popover (no native date input), so
 * drive it the way an athlete does: year grid → month arrows → day.
 */
async function pickDateOfBirth(page: import("@playwright/test").Page, iso: string, field = "#p0-dob") {
  const [year, month, day] = iso.split("-").map(Number);
  await page.locator(field).click();

  const header = page.getByRole("button", { name: new RegExp(`^(${MONTHS.join("|")}) \\d{4}$`) });
  await header.click();
  await page.getByRole("button", { name: String(year), exact: true }).click();

  for (let i = 0; i < 12; i++) {
    const text = await header.textContent();
    const viewMonth = MONTHS.findIndex(m => text?.startsWith(m));
    if (viewMonth === month - 1) break;
    await page.getByRole("button", { name: viewMonth > month - 1 ? "Previous month" : "Next month" }).click();
  }

  await page.getByRole("button", { name: String(day), exact: true }).click();
}

test.describe("registration flow", () => {
  test("shows the 3-step rail and tier selection first", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/select ticket/i).first()).toBeVisible();
    await expect(page.getByText(/your details/i).first()).toBeVisible();
    await expect(page.getByText(/review & pay/i).first()).toBeVisible();
    await expect(page.getByText(/choose your tickets/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /secure your/i })).toBeVisible();
  });

  test("shows back to event link", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: /back to event/i }).first()).toBeVisible();
  });

  test("Continue is disabled until at least one ticket is added", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    const cont = page.getByRole("button", { name: /^Continue/ });
    await expect(cont).toBeDisabled();
    await addTickets(page, 1);
    await expect(cont).toBeEnabled();
  });

  test("register page visual snapshot", async ({ page }) => {
    await page.goto("/events/seed-event-001/register");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "register-page");
  });

  test("quantity stepper adds and removes tickets, updating the total", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/select a tier to see your total/i)).toBeVisible();
    await addTickets(page, 2);
    await expect(page.getByText(/order summary/i)).toBeVisible();
    await expect(page.getByText(/^total$/i)).toBeVisible();
    await expect(page.getByText(/2 ×/).first()).toBeVisible();

    // Stepping back down to zero clears the summary again.
    const minus = page.getByRole("button", { name: /remove one .* ticket/i }).first();
    await minus.click();
    await minus.click();
    await expect(page.getByText(/select a tier to see your total/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Continue/ })).toBeDisabled();
  });

  test("closed ticket tiers show as closed with no quantity stepper", async ({ page }) => {
    // Regression: closed waves used to be selectable and purchasable.
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    const earlyBird = page.getByText("Early Bird", { exact: true });
    if (await earlyBird.isVisible().catch(() => false)) {
      await expect(page.getByText(/closed$/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /add one early bird ticket/i })).toHaveCount(0);
    }
  });

  test("details step shows Contact / Personal / Safety with gender + medical", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 1);
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Contact / Personal / Safety fields (anchored by id to avoid footer collisions).
    await expect(page.locator("#p0-firstName")).toBeVisible();
    await expect(page.locator("#p0-email")).toBeVisible();
    await expect(page.locator("#p0-gender")).toBeVisible();
    await expect(page.locator("#p0-ecName")).toBeVisible();
    await expect(page.locator("#p0-medical")).toBeVisible();
  });

  test("details Continue explains what is missing instead of greying out", async ({ page }) => {
    // #374: a disabled Continue gave the athlete no reason. It now stays
    // clickable, marks the invalid fields and keeps them on the step.
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 1);
    await page.getByRole("button", { name: /^Continue/ }).click();

    await expect(page.locator("#p0-firstName")).toBeVisible();
    const cont = page.getByRole("button", { name: /^Continue/ });
    await expect(cont).toBeEnabled();
    await cont.click();
    await expect(page.getByText("Please fix the highlighted fields.")).toBeVisible();
    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(page.locator("#p0-firstName")).toBeVisible();

    await page.locator("#p0-firstName").fill("Jordan");
    await page.locator("#p0-lastName").fill("Clarke");
    await page.locator("#p0-email").fill("jordan@example.com");
    await pickDateOfBirth(page, "1994-03-20");
    await page.locator("#p0-ecName").fill("Sam Clarke");
    await page.locator("#p0-ecPhone").fill("0498 111 222");
    await cont.click();
    await expect(page.locator("#p0-firstName")).toHaveCount(0);
  });

  test("an emergency phone matching the athlete's own is called out on Continue", async ({ page }) => {
    // The exact case from #374: every field filled, nothing visibly wrong,
    // Continue greyed out because the two phone numbers were the same.
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 1);
    await page.getByRole("button", { name: /^Continue/ }).click();

    await page.locator("#p0-firstName").fill("Jordan");
    await page.locator("#p0-lastName").fill("Clarke");
    await page.locator("#p0-email").fill("jordan@example.com");
    await page.locator("#p0-mobile").fill("0404 127 373");
    await pickDateOfBirth(page, "1994-03-20");
    await page.locator("#p0-ecName").fill("Wendy Clarke");
    await page.locator("#p0-ecPhone").fill("0404127373");

    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByText(/emergency contact number must differ/i)).toBeVisible();
    await expect(page.locator("#p0-ecPhone")).toBeVisible();
  });

  test("multi-ticket order shows one accordion form per ticket", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 2);
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Each ticket gets a clearly-labelled accordion card; ticket 1 opens first.
    await expect(page.getByText(/ticket 1 of 2/i)).toBeVisible();
    await expect(page.getByText(/ticket 2 of 2/i)).toBeVisible();
    await expect(page.locator("#p0-firstName")).toBeVisible();
    await expect(page.locator("#p1-firstName")).toHaveCount(0);

    // Shared emergency contact is the default for multi-ticket orders.
    await expect(page.getByText(/use one emergency contact for all tickets/i)).toBeVisible();
    await expect(page.locator("#shared-ecName")).toBeVisible();
    await expect(page.locator("#p0-ecName")).toHaveCount(0);

    // Opening ticket 2 collapses ticket 1.
    await page.getByText(/ticket 2 of 2/i).click();
    await expect(page.locator("#p1-firstName")).toBeVisible();
    await expect(page.locator("#p0-firstName")).toHaveCount(0);
  });

  test("opting out of the shared emergency contact shows per-ticket fields", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 2);
    await page.getByRole("button", { name: /^Continue/ }).click();

    await expect(page.locator("#shared-ecName")).toBeVisible();
    await page.getByText(/use one emergency contact for all tickets/i).click();
    await expect(page.locator("#shared-ecName")).toHaveCount(0);
    // The open ticket form now carries its own emergency contact fields.
    await expect(page.locator("#p0-ecName")).toBeVisible();
  });

  test("ticket quantity is locked on the details step", async ({ page }) => {
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 2);
    await page.getByRole("button", { name: /^Continue/ }).click();

    await expect(page.getByText(/ticket 1 of 2/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /add another participant/i })).toHaveCount(0);

    // Going Back preserves the selection for editing.
    await page.getByRole("button", { name: /^Back$/i }).click();
    await expect(page.getByText(/choose your tickets/i)).toBeVisible();
    await expect(page.getByText(/2 ×/).first()).toBeVisible();
  });

  test("the 'Back to event' breadcrumb clears the fixed nav", async ({ page }) => {
    // Regression: the register page lacked top padding for the fixed 56px nav,
    // so the breadcrumb rendered underneath the header on every step.
    await page.goto(REG);
    await page.waitForLoadState("networkidle");

    const nav = await page.locator("nav").first().boundingBox();
    const crumb = await page.getByRole("link", { name: /back to event/i }).first().boundingBox();
    expect(nav).not.toBeNull();
    expect(crumb).not.toBeNull();
    // The breadcrumb's top must sit at or below the nav's bottom edge.
    expect(crumb!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height);
  });

  test("a guest goes from details straight to payment, with no email code", async ({ page }) => {
    // Issue #387: checkout used to stop every guest, and every participant
    // email other than the signed-in one, for a 6-digit code before payment.
    // Like any guest checkout, the confirmation email after the order is now
    // the only email step.
    await page.goto(REG);
    await page.waitForLoadState("networkidle");
    await addTickets(page, 1);
    await page.getByRole("button", { name: /^Continue/ }).click();

    await expect(page.locator("#p0-firstName")).toBeVisible();
    await page.locator("#p0-firstName").fill("Jordan");
    await page.locator("#p0-lastName").fill("Clarke");
    await page.locator("#p0-email").fill(`guest-${Date.now()}@example.com`);
    await pickDateOfBirth(page, "1994-03-20");
    await page.locator("#p0-ecName").fill("Sam Clarke");
    await page.locator("#p0-ecPhone").fill("0498 111 222");
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Review & pay is reached directly: the payment form, its loading state,
    // or (without Stripe keys locally) the recoverable "couldn't start" panel.
    const payStep = page
      .getByText("3 / 3")
      .or(page.getByRole("status", { name: "Loading payment" }))
      .or(page.getByText(/we couldn't start your payment/i));
    await expect(payStep.first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/verify email addresses/i)).toHaveCount(0);
    await expect(page.locator('input[inputmode="numeric"]')).toHaveCount(0);
  });
});

test.describe("confirmation page", () => {
  test("confirmation page visual snapshot", async ({ page }) => {
    await page.goto("/events/seed-event-001/register/confirmation");
    await page.waitForLoadState("networkidle");
    await argosScreenshot(page, "registration-confirmation");
  });

  test("renders standalone with confirmation message and links", async ({ page }) => {
    await page.goto("/events/seed-event-001/register/confirmation");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/registration/i).first()).toBeVisible();
    await expect(page.getByText(/confirmed/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /back to event/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /browse more events/i })).toBeVisible();
  });
});

// A free event has no ticket sale, so the athlete RSVPs as their signed-in
// account. These fixtures are local to this spec and are removed again.
const FREE_MULTI_ID = "e2e-free-rsvp-multi";
const FREE_SINGLE_ID = "e2e-free-rsvp-single";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function createFreeEvent(id: string, title: string, waves: { label: string; price: string }[]) {
  const organiser = await prisma.organiser.findFirst({
    where: { orgName: "Apex Endurance Events" },
    select: { id: true },
  });
  if (!organiser) throw new Error("Apex Endurance Events is missing from the seed");

  await prisma.event.create({
    data: {
      id,
      organiserId: organiser.id,
      status: "APPROVED",
      slug: id,
      title,
      discipline: "running",
      description: "Free RSVP E2E fixture.",
      eventDate: "2027-03-14",
      startTime: "07:00",
      endTime: "10:00",
      venue: "Albert Park",
      address: "Albert Park, Melbourne VIC",
      city: "Melbourne",
      state: "VIC",
      format: "individual",
      level: "open",
      categories: ["5K"],
      cap: 100,
      minAge: 16,
      waves,
      photos: [],
    },
  });
}

test.describe("free event RSVP", () => {
  test.beforeAll(async () => {
    await prisma.registration.deleteMany({ where: { eventId: { in: [FREE_MULTI_ID, FREE_SINGLE_ID] } } });
    await prisma.event.deleteMany({ where: { id: { in: [FREE_MULTI_ID, FREE_SINGLE_ID] } } });
    await createFreeEvent(FREE_MULTI_ID, "Free RSVP Multi Tier", [
      { label: "General", price: "0" },
      { label: "Junior", price: "0" },
    ]);
    await createFreeEvent(FREE_SINGLE_ID, "Free RSVP Single Tier", [
      { label: "General", price: "0" },
    ]);
  });

  test.beforeEach(async () => {
    await prisma.registration.deleteMany({ where: { eventId: { in: [FREE_MULTI_ID, FREE_SINGLE_ID] } } });
  });

  test.afterAll(async () => {
    await prisma.registration.deleteMany({ where: { eventId: { in: [FREE_MULTI_ID, FREE_SINGLE_ID] } } });
    await prisma.event.deleteMany({ where: { id: { in: [FREE_MULTI_ID, FREE_SINGLE_ID] } } });
    await prisma.$disconnect();
  });

  test("asks a signed-out visitor to sign in before an RSVP", async ({ page }) => {
    await page.goto(`/events/${FREE_MULTI_ID}/register`);

    await expect(page.getByRole("heading", { name: /sign in to/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in to rsvp/i })).toBeVisible();
    await expect(page.locator("#p0-firstName")).toHaveCount(0);
  });

  test("the event page offers I'm going rather than a ticket checkout", async ({ page }) => {
    await page.goto(`/events/${FREE_MULTI_ID}`);

    await expect(page.getByRole("link", { name: /i'm going/i }).first()).toBeVisible();
  });

  test("asks for a tier, then RSVPs with the account and accepted terms", async ({ page }) => {
    await page.context().addCookies([
      { name: "__e2e_bypass", value: "user", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
    await page.goto(`/events/${FREE_MULTI_ID}/register`);

    await expect(page.getByRole("radio", { name: /General/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Junior/i })).toBeVisible();
    await page.getByRole("radio", { name: /Junior/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();

    const review = page.getByTestId("rsvp-review");
    await expect(review.getByText("Review your RSVP")).toBeVisible();
    await expect(review.getByText("Jade Nguyen", { exact: true })).toBeVisible();
    await expect(review.getByText("jade.nguyen@startline.test", { exact: true })).toBeVisible();
    await expect(review.locator("#registration-terms-copy")).toHaveText(
      /I agree to the Startline\s+Terms of Service\s+and this event's\s+entry terms & waiver,\s+and confirm/,
    );
    await expect(page.locator("#p0-firstName")).toHaveCount(0);
    await expect(page.getByText("Payment not required")).toHaveCount(0);

    await page.locator('[role="checkbox"][aria-describedby="registration-terms-copy"]').click();
    await page.getByRole("button", { name: /i'm going/i }).click();

    await expect(page.getByText(/you're in/i)).toBeVisible();
    await expect(page.getByText(/registration/i).first()).toBeVisible();

    await expect.poll(async () => {
      const registration = await prisma.registration.findFirst({
        where: { eventId: FREE_MULTI_ID, status: "CONFIRMED" },
        select: { athleteName: true, athleteEmail: true, waveLabel: true },
      });
      return registration;
    }).toMatchObject({
      athleteName: "Jade Nguyen",
      athleteEmail: "jade.nguyen@startline.test",
      waveLabel: "Junior",
    });
  });

  test("a single free tier goes straight to the RSVP confirmation", async ({ page }) => {
    await page.context().addCookies([
      { name: "__e2e_bypass", value: "user", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
    await page.goto(`/events/${FREE_SINGLE_ID}/register`);

    await expect(page.getByText("Review your RSVP")).toBeVisible();
    await expect(page.getByRole("button", { name: /i'm going/i })).toBeVisible();
    await expect(page.locator("#p0-firstName")).toHaveCount(0);
  });
});
