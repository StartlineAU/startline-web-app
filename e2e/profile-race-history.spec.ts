import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl } from "./helpers";
import { signEntryClaim } from "../lib/entry-claim-token";

ensureDatabaseUrl();
// The dev server signs links with this value too (playwright.config.ts, ci.yml).
process.env.ENTRY_CLAIM_SECRET ||= "e2e-entry-claim-secret";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// #592: every entry in an order carries the buyer's account, so an athlete who
// bought several tickets saw the event once per ticket on their profile. The
// profile now lists the buyer's own ticket. #598: anyone else entered in the
// order adds the race to their own profile themselves, from Activity or from
// the link in their confirmation email. Nobody can put it there for them.
const EVENT_ID = "e2e-profile-race-history";
const TITLE = "Profile History Multi Ticket";
const TEAM_EVENT_ID = "e2e-profile-race-history-team";
const TEAM_TITLE = "Profile History Team Ticket";
const LINK_EVENT_ID = "e2e-profile-race-history-link";
const LINK_TITLE = "Profile History Claim Link";

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
  return (history.registrations as { id: string; event: { id: string } }[]).filter((r) => r.event.id === eventId);
}

/** What Activity says about each of this account's entries in one event. */
async function activityFor(page: Page, eventId: string) {
  const res = await page.request.get("/api/user/registrations");
  expect(res.ok()).toBeTruthy();
  const { registrations } = await res.json();
  return (registrations as { id: string; eventId: string; onProfile: boolean; canAddToProfile: boolean }[])
    .filter((r) => r.eventId === eventId);
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
  const events = { in: [EVENT_ID, TEAM_EVENT_ID, LINK_EVENT_ID] };
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
    await createFreeEvent(LINK_EVENT_ID, LINK_TITLE, [{ label: "General", price: "0" }]);
    await prisma.user.create({ data: { cognitoSub: TEAMMATE_SUB, email: TEAMMATE_EMAIL, name: "Taylor Teammate" } });
  });

  test.afterAll(async () => {
    await removeFixtures();
    await prisma.$disconnect();
  });

  test("the buyer sees the event once, and a friend adds it to their own profile", async ({ page }) => {
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

    // Jade was entered by someone else. It is not on her profile until she
    // says it is hers: Activity offers it.
    await signInAs(page, "user");
    expect(await historyFor(page, EVENT_ID)).toHaveLength(0);
    const [offered] = await activityFor(page, EVENT_ID);
    expect(offered).toMatchObject({ onProfile: false, canAddToProfile: true });

    await page.goto("/activity");
    const offer = page.locator(`[data-testid="profile-offer"][data-registration-id="${offered.id}"]`);
    await offer.getByRole("button", { name: "Add to my profile" }).click();
    await expect(offer).toHaveCount(0);
    expect(await historyFor(page, EVENT_ID)).toHaveLength(1);

    // The buyer is never offered the tickets she bought for other people.
    await signInAs(page, "athlete");
    expect((await activityFor(page, EVENT_ID)).some((r) => r.canAddToProfile)).toBe(false);
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

    // The teammate is offered the race; nothing lands on their profile until
    // they add it.
    await signInAs(page, "teammate");
    expect(await historyFor(page, TEAM_EVENT_ID)).toHaveLength(0);
    const [offered] = await activityFor(page, TEAM_EVENT_ID);
    expect(offered.canAddToProfile).toBe(true);
    const added = await page.request.post(`/api/user/registrations/${offered.id}/claim`, { data: {} });
    expect(added.status(), await added.text()).toBe(200);
    expect(await historyFor(page, TEAM_EVENT_ID)).toHaveLength(1);

    // Their address changes; the race stays on their profile.
    await prisma.user.update({ where: { cognitoSub: TEAMMATE_SUB }, data: { email: "teammate.moved@startline.test" } });
    expect(await historyFor(page, TEAM_EVENT_ID)).toHaveLength(1);
  });

  test("the confirmation email's link adds a race entered under another address", async ({ page }) => {
    // Harper enters a friend under an address that has no Startline account.
    await signInAs(page, "athlete");
    const order = await page.request.post("/api/registrations/free", {
      data: {
        eventId: LINK_EVENT_ID,
        waveLabel: "General",
        acceptedTerms: true,
        participants: [
          person("Harper", "Jones", "harper.jones@startline.test", { isSelf: true }),
          person("Casey", "Unused", "casey.unused@startline.test", { dateOfBirth: "1991-03-03" }),
        ],
      },
    });
    expect(order.status(), await order.text()).toBe(200);
    const entry = await prisma.registration.findFirstOrThrow({
      where: { eventId: LINK_EVENT_ID, athleteEmail: "casey.unused@startline.test" },
      select: { id: true, athleteEmail: true },
    });
    const token = signEntryClaim({ registrationId: entry.id, athleteEmail: entry.athleteEmail });
    expect(token).not.toBeNull();
    const link = `/race/claim?t=${encodeURIComponent(token as string)}`;

    // Casey signs in to Startline with another address (the teammate account).
    await signInAs(page, "teammate");
    expect(await historyFor(page, LINK_EVENT_ID)).toHaveLength(0);

    // Opening the link adds nothing: mail scanners open links too.
    await page.goto(link);
    await expect(page.getByTestId("claim-summary")).toContainText(LINK_TITLE);
    expect(await historyFor(page, LINK_EVENT_ID)).toHaveLength(0);

    await page.getByRole("button", { name: "Add to my profile" }).click();
    await expect(page.getByRole("heading", { name: "On your profile" })).toBeVisible();
    expect(await historyFor(page, LINK_EVENT_ID)).toHaveLength(1);

    // The same link cannot move it to another account.
    await signInAs(page, "user");
    const again = await page.request.post(`/api/user/registrations/${entry.id}/claim`, { data: { token } });
    expect(again.status()).toBe(409);

    // A forged link is refused, and the page says so.
    await page.goto(`${link}x`);
    await expect(page.getByRole("heading", { name: /This link isn.t valid/ })).toBeVisible();

    // The owner can take it off their profile again; nobody else can.
    await signInAs(page, "athlete");
    const [buyersOwn] = await historyFor(page, LINK_EVENT_ID);
    await signInAs(page, "teammate");
    const refused = await page.request.delete(`/api/user/registrations/${buyersOwn.id}/claim`);
    expect(refused.status()).toBe(404);
    const removed = await page.request.delete(`/api/user/registrations/${entry.id}/claim`);
    expect(removed.status(), await removed.text()).toBe(200);
    expect(await historyFor(page, LINK_EVENT_ID)).toHaveLength(0);
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
