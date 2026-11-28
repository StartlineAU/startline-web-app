import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl } from "./helpers";

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// #592: every entry in an order carries the buyer's account, so an athlete who
// bought several tickets saw the event once per ticket on their profile. The
// profile now lists the buyer's own ticket, and someone entered by another
// person sees the entry on their own account.
const EVENT_ID = "e2e-profile-race-history";
const TITLE = "Profile History Multi Ticket";
const TEAM_EVENT_ID = "e2e-profile-race-history-team";
const TEAM_TITLE = "Profile History Team Ticket";

// The "teammate" bypass identity. Its row is this spec's own, because one test
// changes its email, which a shared seed user must never have.
const TEAMMATE_SUB = "dev-bypass-teammate-test";
const TEAMMATE_EMAIL = "teammate.test@startline.test";

const cookie = (value: string) => ({
  name: "__e2e_bypass", value, domain: "localhost", path: "/", sameSite: "Lax" as const,
});

const details = (firstName: string, lastName: string, email: string, dateOfBirth = "1990-05-01") => ({
  firstName,
  lastName,
  email,
  dateOfBirth,
  gender: "",
  mobile: "0400000000",
  emergencyContactName: "Robin Contact",
  emergencyContactPhone: "0400000009",
  medicalNotes: "",
  estimatedFinish: "",
});

const person = (firstName: string, lastName: string, email: string, extra: object = {}) => ({
  ...details(firstName, lastName, email),
  waiverAccepted: true,
  waveLabel: "General",
  ...extra,
});

async function historyFor(page: Page, eventId: string) {
  const res = await page.request.get("/api/user/profile");
  expect(res.ok()).toBeTruthy();
  const { history } = await res.json();
  return (history.registrations as { event: { id: string } }[]).filter((r) => r.event.id === eventId);
}

async function signInAs(page: Page, identity: string) {
  await page.context().clearCookies();
  await page.context().addCookies([cookie(identity)]);
}

async function createFreeEvent(id: string, title: string, waves: object[]) {
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
      description: "Profile race history E2E fixture.",
      eventDate: "2027-04-18",
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
      waves,
      photos: [],
    },
  });
}

async function removeFixtures() {
  const events = { in: [EVENT_ID, TEAM_EVENT_ID] };
  await prisma.teamMemberChange.deleteMany({ where: { team: { eventId: events } } });
  await prisma.registration.deleteMany({ where: { eventId: events } });
  await prisma.event.deleteMany({ where: { id: events } });
  await prisma.user.deleteMany({ where: { cognitoSub: TEAMMATE_SUB } });
}

test.describe("profile race history with several tickets in one order (#592)", () => {
  test.beforeAll(async () => {
    await removeFixtures();
    await createFreeEvent(EVENT_ID, TITLE, [{ label: "General", price: "0" }]);
    await createFreeEvent(TEAM_EVENT_ID, TEAM_TITLE, [{ label: "Pairs", price: "0", teamSize: 2 }]);
    await prisma.user.create({ data: { cognitoSub: TEAMMATE_SUB, email: TEAMMATE_EMAIL, name: "Taylor Teammate" } });
  });

  test.afterAll(async () => {
    await removeFixtures();
    await prisma.$disconnect();
  });

  test("the buyer sees the event once, and a guest with an account sees it too", async ({ page }) => {
    // Harper buys three tickets: her own, her child's on her address, and Jade's.
    await signInAs(page, "athlete");
    const order = await page.request.post("/api/registrations/free", {
      data: {
        eventId: EVENT_ID,
        waveLabel: "General",
        acceptedTerms: true,
        participants: [
          person("Harper", "Jones", "harper.jones@startline.test", { isSelf: true }),
          person("Riley", "Jones", "harper.jones@startline.test", { dateOfBirth: "2008-02-11" }),
          person("Jade", "Nguyen", "jade.nguyen@startline.test", { dateOfBirth: "1992-09-30" }),
        ],
      },
    });
    expect(order.status(), await order.text()).toBe(200);
    expect((await order.json()).participantCount).toBe(3);

    // One card for the buyer, not one per ticket she paid for.
    expect(await historyFor(page, EVENT_ID)).toHaveLength(1);
    await page.goto("/profile");
    await expect(page.getByText(TITLE, { exact: true })).toHaveCount(1);

    // Jade was entered by someone else and has her own account.
    await signInAs(page, "user");
    expect(await historyFor(page, EVENT_ID)).toHaveLength(1);
  });

  test("a team member named later keeps the race after changing their email", async ({ page }) => {
    // Harper buys a pair and leaves her teammate's place for later.
    await signInAs(page, "athlete");
    const order = await page.request.post("/api/registrations/free", {
      data: {
        eventId: TEAM_EVENT_ID,
        waveLabel: "Pairs",
        acceptedTerms: true,
        teams: [{ name: "Profile Pair" }],
        participants: [
          person("Harper", "Jones", "harper.jones@startline.test", { waveLabel: "Pairs", team: 0, isSelf: true }),
          { ...person("", "", ""), waveLabel: "Pairs", team: 0, detailsLater: true },
        ],
      },
    });
    expect(order.status(), await order.text()).toBe(200);

    const pending = await prisma.registration.findFirstOrThrow({
      where: { eventId: TEAM_EVENT_ID, detailsPending: true },
      select: { id: true },
    });
    const named = await page.request.post(`/api/user/registrations/${pending.id}/details`, {
      data: details("Taylor", "Teammate", TEAMMATE_EMAIL, "1994-07-12"),
    });
    expect(named.status(), await named.text()).toBe(200);
    expect(await historyFor(page, TEAM_EVENT_ID)).toHaveLength(1);

    // The teammate's first visit finds it by email and pins it to the account.
    await signInAs(page, "teammate");
    expect(await historyFor(page, TEAM_EVENT_ID)).toHaveLength(1);

    // Their address changes; the race stays on their profile.
    await prisma.user.update({ where: { cognitoSub: TEAMMATE_SUB }, data: { email: "teammate.moved@startline.test" } });
    expect(await historyFor(page, TEAM_EVENT_ID)).toHaveLength(1);
  });

  test("someone else's ticket says which email reaches their profile, the buyer's own does not", async ({ page }) => {
    const hint = page.getByText("Use the email they sign in to Startline with", { exact: false });
    await signInAs(page, "athlete");
    await page.goto("/events/seed-event-001/register");
    await page.getByRole("button", { name: /add one .* ticket/i }).first().click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    // The first ticket starts as the buyer's own, filled from their profile.
    await expect(page.locator("#p0-firstName")).toHaveValue("Harper", { timeout: 30000 });
    await expect(hint).toHaveCount(0);

    await page.getByRole("radio", { name: "Someone else" }).click();
    await expect(hint).toBeVisible();
    await expect(page.locator("#p0-email")).toHaveAttribute("aria-describedby", "p0-emailHint");
  });
});
