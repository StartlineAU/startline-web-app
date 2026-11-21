import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl } from "./helpers";

// Organiser contact details on the event page (between the gallery and the
// reviews) and on the athlete's ticket. The organisation picks which details
// show in Settings, and each event can override that in its listing.

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// A seeded, published event owned by Coastal Fitness Collective (Jade, "user").
const EVENT_ID = "seed-event-017";
const HARPER = "harper.jones@startline.test";
const BIB = "E2E-CONTACT";

type Flags = { showContactName: boolean; showContactEmail: boolean; showContactPhone: boolean };
let organiserId = "";
let original: Flags & { contactName: string | null; contactEmail: string | null; phone: string | null };

async function signInAs(page: Page, identity: "athlete" | "user" | "organiser") {
  await page.context().addCookies([
    { name: "__e2e_bypass", value: identity, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

async function setOrganisation(flags: Partial<Flags>) {
  await prisma.organiser.update({ where: { id: organiserId }, data: flags });
}

async function setEvent(flags: { [K in keyof Flags]?: boolean | null }) {
  await prisma.event.update({ where: { id: EVENT_ID }, data: flags });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: EVENT_ID },
    select: {
      organiser: {
        select: {
          id: true, contactName: true, contactEmail: true, phone: true,
          showContactName: true, showContactEmail: true, showContactPhone: true,
        },
      },
    },
  });
  const { id, ...rest } = event.organiser;
  organiserId = id;
  original = rest;
});

test.beforeEach(async () => {
  await prisma.registration.deleteMany({ where: { eventId: EVENT_ID, bibNumber: BIB } });
  await setEvent({ showContactName: null, showContactEmail: null, showContactPhone: null });
  await prisma.organiser.update({
    where: { id: organiserId },
    data: { ...original, showContactName: true, showContactEmail: true, showContactPhone: false },
  });
});

test.afterAll(async () => {
  await prisma.registration.deleteMany({ where: { eventId: EVENT_ID, bibNumber: BIB } });
  await setEvent({ showContactName: null, showContactEmail: null, showContactPhone: null });
  await prisma.organiser.update({ where: { id: organiserId }, data: original });
  await prisma.$disconnect();
});

test("the event page lists the organisation's chosen contact details between gallery and reviews", async ({ page }) => {
  await page.goto(`/events/${EVENT_ID}`);

  const contact = page.getByTestId("organiser-contact");
  await expect(page.getByRole("heading", { name: "Contact the organiser" })).toBeVisible({ timeout: 20000 });
  await expect(contact.locator('[data-contact="name"]')).toContainText(original.contactName!);
  await expect(contact.locator('[data-contact="email"] a')).toHaveAttribute("href", `mailto:${original.contactEmail}`);
  // Phone is off by default, and a hidden detail is not in the page at all.
  await expect(contact.locator('[data-contact="phone"]')).toHaveCount(0);
  expect(await page.content()).not.toContain(original.phone!);

  // Between the gallery and the reviews.
  const top = async (name: string) =>
    (await page.getByRole("heading", { name, exact: true }).boundingBox())!.y;
  const contactTop = await top("Contact the organiser");
  expect(contactTop).toBeGreaterThan(await top("Gallery"));
  expect(contactTop).toBeLessThan(await top("Reviews"));
});

test("an event's own choice overrides the organisation's, and none hides the section", async ({ page }) => {
  await setEvent({ showContactEmail: false, showContactPhone: true });
  await page.goto(`/events/${EVENT_ID}`);

  const contact = page.getByTestId("organiser-contact");
  await expect(contact.locator('[data-contact="phone"] a')).toHaveAttribute("href", /^tel:\+?\d+$/, { timeout: 20000 });
  await expect(contact.locator('[data-contact="email"]')).toHaveCount(0);
  expect(await page.content()).not.toContain(original.contactEmail!);

  await setEvent({ showContactName: false, showContactEmail: false, showContactPhone: false });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Reviews", exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("heading", { name: "Contact the organiser" })).toHaveCount(0);
});

test("the athlete's ticket shows the same contact details", async ({ page }) => {
  await setOrganisation({ showContactPhone: true });
  await prisma.registration.create({
    data: {
      eventId: EVENT_ID,
      organiserId,
      athleteName: "Harper Jones",
      athleteEmail: HARPER,
      bibNumber: BIB,
      status: "CONFIRMED",
    },
  });
  await signInAs(page, "athlete");
  await page.goto("/activity");

  await page
    .locator(`[data-testid="registration-entry"][data-event-id="${EVENT_ID}"]`)
    .getByTestId("event-card")
    .click();
  const contact = page.getByTestId("ticket-dialog").getByTestId("ticket-contact");
  await expect(contact).toBeVisible({ timeout: 15000 });
  await expect(contact).toContainText(original.contactName!);
  await expect(contact.locator('[data-contact="email"] a')).toHaveAttribute("href", `mailto:${original.contactEmail}`);
  await expect(contact.locator('[data-contact="phone"]')).toContainText(original.phone!);
});

test("an owner chooses in Settings which contact details athletes see", async ({ page }) => {
  await signInAs(page, "user");
  await page.goto("/organiser/dashboard?settings=organisation");

  const settings = page.getByRole("dialog", { name: "Settings" });
  const visibility = settings.getByTestId("contact-visibility");
  const phone = visibility.getByRole("switch", { name: "Show phone" });
  await expect(phone).toHaveAttribute("aria-checked", "false", { timeout: 30000 });
  await expect(visibility.getByRole("switch", { name: "Show email" })).toHaveAttribute("aria-checked", "true");

  await phone.click();
  await expect(phone).toHaveAttribute("aria-checked", "true");
  await settings.getByRole("button", { name: "Save", exact: true }).click();
  await expect(settings.getByText("Saved")).toBeVisible();

  await expect
    .poll(async () => (await prisma.organiser.findUniqueOrThrow({ where: { id: organiserId } })).showContactPhone)
    .toBe(true);
});

test("the listing editor sets this event's contact details, then hands them back to the organisation", async ({ page }) => {
  test.slow();
  await signInAs(page, "organiser");

  // A live event of its own. Borrowing a seeded Apex event raced the other
  // specs that edit Apex's events in parallel: the one picked could be moved
  // to draft or past its date mid-test, so Save changes never appeared or the
  // save was refused. Apex is verified and the event is free, so the save
  // applies at once rather than waiting for review.
  const created = await page.request.post("/api/organiser/events", {
    data: {
      title: `E2E Contact Override ${Date.now()}`,
      discipline: "Running",
      eventDate: "2027-06-14",
      startTime: "07:00",
      endTime: "10:00",
      venue: "Albert Park",
      address: "Aughtie Dr, Albert Park VIC 3206",
      city: "Melbourne",
      state: "VIC",
      format: "Individual",
      level: "All levels",
      registrationType: "startline",
      waves: [{ label: "General", price: "0", closes: "", startTime: "" }],
      submit: true,
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const apex = { id: (await created.json()).id as string };
  expect((await prisma.event.findUniqueOrThrow({ where: { id: apex.id } })).status).toBe("APPROVED");

  try {
    await page.goto(`/organiser/new-listing?id=${apex.id}`);

    const editor = page.getByTestId("contact-editor");
    const phone = editor.getByRole("button", { name: /^Phone/ });
    const save = page.getByRole("button", { name: "Save changes" }).filter({ visible: true }).first();
    // The editor renders an empty form first and fills it when the event's
    // fetch lands. A click before then is overwritten by that fill, and a save
    // before then has no event id. "Save changes" only appears once the event
    // has loaded, so it is the gate.
    await expect(save).toBeVisible({ timeout: 30000 });
    await expect(editor).toContainText("Following your organisation's setting");

    await phone.click();
    await expect(editor).toContainText("Set for this event");
    // Wait on the save itself, so a refused save fails with the server's
    // reason instead of a poll that only says the column stayed null.
    const saved = page.waitForResponse(
      (r) => r.url().endsWith(`/api/organiser/events/${apex.id}`) && r.request().method() === "PATCH",
      { timeout: 30000 },
    );
    await save.click();
    const res = await saved;
    const body = await res.text();
    expect(res.status(), `PATCH ${apex.id} answered ${res.status()}: ${body}`).toBe(200);
    expect(JSON.parse(body).pendingReview, `the save was queued for review: ${body}`).toBeFalsy();
    await expect
      .poll(async () => (await prisma.event.findUniqueOrThrow({ where: { id: apex.id } })).showContactPhone, { timeout: 20000 })
      .not.toBeNull();
  } finally {
    await prisma.event.deleteMany({ where: { id: apex.id } });
  }
});
