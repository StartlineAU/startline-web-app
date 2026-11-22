import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl, organiserLogin } from "./helpers";

ensureDatabaseUrl();

// Team registration (#541). A team ticket is a tier with a team size: the
// price is per person, the quantity counts teams, the buyer enters every
// member, and race-day bib/wave/check-in/result belong to the team.
//
// Fixtures are free events so no Stripe keys are needed; they are local to
// this spec and removed again.
const FREE_TEAM_ID = "e2e-team-free-pairs";
const PAID_TEAM_ID = "e2e-team-paid-squads";
// The teammate added from Activity gets an account; removed again on clean-up.
const LATER_MEMBER_EMAIL = "e2e-team-later-member@example.com";
const ATHLETE_EMAIL = "harper.jones@startline.test";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function pickDateOfBirth(page: Page, iso: string, field: string) {
  const [year, month, day] = iso.split("-").map(Number);
  await page.locator(field).click();
  const header = page.getByRole("button", { name: new RegExp(`^(${MONTHS.join("|")}) \\d{4}$`) });
  await header.click();
  await page.getByRole("button", { name: String(year), exact: true }).click();
  for (let i = 0; i < 12; i++) {
    const text = await header.textContent();
    const viewMonth = MONTHS.findIndex((m) => text?.startsWith(m));
    if (viewMonth === month - 1) break;
    await page.getByRole("button", { name: viewMonth > month - 1 ? "Previous month" : "Next month" }).click();
  }
  await page.getByRole("button", { name: String(day), exact: true }).click();
}

async function createTeamEvent(id: string, title: string, waves: unknown[]) {
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
      description: "Team registration E2E fixture.",
      eventDate: "2027-03-14",
      startTime: "07:00",
      endTime: "10:00",
      venue: "Albert Park",
      address: "Albert Park, Melbourne VIC",
      city: "Melbourne",
      state: "VIC",
      format: "team",
      level: "open",
      categories: ["5K"],
      cap: 20,
      minAge: 16,
      waves: waves as object[],
      photos: [],
      // Bibs are opt-in (#566); the race-management tests set a team's bib.
      bibMode: "PRIVATE",
    },
  });
}

/** A team of four on the paid event; `statuses` per member, all confirmed by default. */
async function seedQuadSquad(statuses: ("CONFIRMED" | "CANCELLED" | "REFUNDED")[] = []) {
  const { organiserId } = await prisma.event.findUniqueOrThrow({
    where: { id: PAID_TEAM_ID },
    select: { organiserId: true },
  });
  const team = await prisma.team.create({
    data: { eventId: PAID_TEAM_ID, name: "Quad Squad", ticketLabel: "Squad", size: 4 },
  });
  const members: { id: string }[] = [];
  for (const [i, first] of ["Ari", "Bo", "Cy", "Di"].entries()) {
    members.push(await prisma.registration.create({
      data: {
        eventId: PAID_TEAM_ID,
        organiserId,
        athleteName: `${first} Quad`,
        athleteEmail: `quad-${i}@example.com`,
        firstName: first,
        lastName: "Quad",
        dateOfBirth: "1990-05-01",
        waveLabel: "Squad",
        status: statuses[i] ?? "CONFIRMED",
        teamId: team.id,
        amountCents: 4500,
      },
      select: { id: true },
    }));
  }
  return { team, members };
}

async function cleanUp() {
  const ids = [FREE_TEAM_ID, PAID_TEAM_ID];
  await prisma.user.deleteMany({ where: { email: LATER_MEMBER_EMAIL } });
  await prisma.registration.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.team.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
}

test.describe("team registration", () => {
  test.beforeAll(async () => {
    await cleanUp();
    await createTeamEvent(FREE_TEAM_ID, "Free Pairs Relay", [
      { label: "Pairs", price: "0", teamSize: 2, qty: 10 },
    ]);
    await createTeamEvent(PAID_TEAM_ID, "Squad Challenge", [
      { label: "Squad", price: "45", teamSize: 4, qty: 5 },
    ]);
  });

  test.beforeEach(async () => {
    await prisma.registration.deleteMany({ where: { eventId: { in: [FREE_TEAM_ID, PAID_TEAM_ID] } } });
    await prisma.team.deleteMany({ where: { eventId: { in: [FREE_TEAM_ID, PAID_TEAM_ID] } } });
  });

  test.afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  test("the event page shows the per-person price and the team size", async ({ page }) => {
    await page.goto(`/events/${PAID_TEAM_ID}`);
    const team = page.getByTestId("pricing-team").first();
    await expect(team).toContainText(/teams of 4/i);
    await expect(team).toContainText("$180 per team");
    await expect(page.getByText(/per person/i).first()).toBeVisible();
  });

  test("checkout charges the per-person price times the team size", async ({ page }) => {
    await page.goto(`/events/${PAID_TEAM_ID}/register`);
    await expect(page.getByTestId("register-team-size")).toContainText(/teams of 4/i);
    await page.getByRole("button", { name: /add one squad team/i }).click();

    // One team of four at $45 each: the summary lists four people.
    await expect(page.getByText(/1 team × Squad \(4 people\)/).first()).toBeVisible();
    await page.getByRole("button", { name: /^Continue/ }).click();

    await expect(page.getByTestId("team-names")).toBeVisible();
    await expect(page.getByText(/member 1 of 4/i)).toBeVisible();
    await expect(page.getByText(/member 4 of 4/i)).toBeVisible();
  });

  test("a free pair registers as one team with both members", async ({ page }) => {
    await page.goto(`/events/${FREE_TEAM_ID}/register`);

    // A team ticket is never a one-tap RSVP: the buyer enters both members.
    await page.getByRole("button", { name: /add one pairs team/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();

    await page.locator("#team-name-0").fill("Harbour Hustlers");
    const stamp = Date.now();
    for (const [i, first] of [[0, "Alex"], [1, "Blair"]] as const) {
      if (i > 0) {
        await page.getByText(/member 2 of 2/i).click();
        // A teammate starts as "add later"; this test names them at checkout.
        await page.getByRole("radio", { name: "Enter details now" }).click();
      }
      await page.locator(`#p${i}-firstName`).fill(first);
      await page.locator(`#p${i}-lastName`).fill("Rivers");
      await page.locator(`#p${i}-email`).fill(`team-${i}-${stamp}@example.com`);
      await pickDateOfBirth(page, "1992-05-10", `#p${i}-dob`);
    }
    await page.locator("#shared-ecName").fill("Sam Rivers");
    await page.locator("#shared-ecPhone").fill("0498 111 222");
    await page.getByRole("button", { name: /^Continue/ }).click();

    await page.locator('[role="checkbox"][aria-describedby="registration-terms-copy"]').click();
    await page.getByRole("button", { name: /confirm registration/i }).click();
    await expect(page.getByText(/you're in/i)).toBeVisible();

    await expect.poll(async () => {
      const team = await prisma.team.findFirst({
        where: { eventId: FREE_TEAM_ID },
        select: { name: true, size: true, members: { select: { status: true } } },
      });
      return team && { name: team.name, size: team.size, members: team.members.length };
    }).toEqual({ name: "Harbour Hustlers", size: 2, members: 2 });
  });

  test("a buyer names only themselves and leaves a teammate for later", async ({ page }) => {
    await page.goto(`/events/${FREE_TEAM_ID}/register`);
    await page.getByRole("button", { name: /add one pairs team/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Checkout says up front that teammates can be added afterwards.
    await expect(page.getByTestId("team-details-later-copy")).toContainText(/added later from your Activity page/i);
    await page.locator("#team-name-0").fill("Later Larks");

    const stamp = Date.now();
    const buyerEmail = `team-buyer-${stamp}@example.com`;
    await page.locator("#p0-firstName").fill("Robin");
    await page.locator("#p0-lastName").fill("Lark");
    await page.locator("#p0-email").fill(buyerEmail);
    await pickDateOfBirth(page, "1991-02-03", "#p0-dob");

    // Member 2 is "add later" without the buyer doing anything.
    await page.getByText(/member 2 of 2/i).click();
    await expect(page.getByRole("radio", { name: "Add details later" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("details-later-note")).toBeVisible();

    await page.locator("#shared-ecName").fill("Sam Lark");
    await page.locator("#shared-ecPhone").fill("0498 111 222");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByText("Details to add later")).toBeVisible();

    await page.locator('[role="checkbox"][aria-describedby="registration-terms-copy"]').click();
    await page.getByRole("button", { name: /confirm registration/i }).click();
    await expect(page.getByText(/you're in/i)).toBeVisible();
    await expect(page.getByTestId("team-details-later-note")).toContainText(/1 team member to add/i);

    // Both places are written; the second is the buyer's until it is named.
    await expect.poll(async () => {
      const rows = await prisma.registration.findMany({
        where: { eventId: FREE_TEAM_ID },
        select: { athleteName: true, athleteEmail: true, detailsPending: true, firstName: true },
        orderBy: { detailsPending: "asc" },
      });
      return rows;
    }).toEqual([
      { athleteName: "Robin Lark", athleteEmail: buyerEmail, detailsPending: false, firstName: "Robin" },
      { athleteName: "Team member 2", athleteEmail: buyerEmail, detailsPending: true, firstName: null },
    ]);
  });

  test("Activity warns about a teammate without details and adds them", async ({ page }) => {
    const { organiserId } = await prisma.event.findUniqueOrThrow({
      where: { id: FREE_TEAM_ID },
      select: { organiserId: true },
    });
    const team = await prisma.team.create({
      data: { eventId: FREE_TEAM_ID, name: "Harper Pair", ticketLabel: "Pairs", size: 2 },
    });
    const base = {
      eventId: FREE_TEAM_ID,
      organiserId,
      athleteEmail: ATHLETE_EMAIL,
      waveLabel: "Pairs",
      status: "CONFIRMED" as const,
      teamId: team.id,
    };
    await prisma.registration.create({
      data: { ...base, athleteName: "Harper Jones", firstName: "Harper", lastName: "Jones", dateOfBirth: "1994-04-04" },
    });
    const place = await prisma.registration.create({
      data: { ...base, athleteName: "Team member 2", detailsPending: true },
      select: { id: true },
    });

    await page.context().addCookies([
      { name: "__e2e_bypass", value: "athlete", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
    await page.goto("/activity");

    const card = page.locator(`[data-testid="registration-entry"][data-event-id="${FREE_TEAM_ID}"]`);
    await expect(card.getByTestId("team-details-warning")).toContainText(/1 team member needs their details/i);
    await card.getByRole("button", { name: /add details/i }).click();

    const dialog = page.getByTestId("team-member-details-dialog");
    await dialog.locator("#p0-firstName").fill("Casey");
    await dialog.locator("#p0-lastName").fill("Jones");
    await dialog.locator("#p0-email").fill(LATER_MEMBER_EMAIL);
    await pickDateOfBirth(page, "1993-08-09", "#p0-dob");
    await dialog.locator("#p0-ecName").fill("Harper Jones");
    await dialog.locator("#p0-ecPhone").fill("0498 111 333");
    await dialog.getByRole("button", { name: /save details/i }).click();

    await expect(card.getByTestId("team-details-warning")).toHaveCount(0);
    const entry = await prisma.registration.findUniqueOrThrow({
      where: { id: place.id },
      select: { athleteName: true, athleteEmail: true, detailsPending: true },
    });
    expect(entry).toEqual({ athleteName: "Casey Jones", athleteEmail: LATER_MEMBER_EMAIL, detailsPending: false });
    await expect(
      prisma.teamMemberChange.count({ where: { teamId: team.id, kind: "DETAILS_ADDED" } }),
    ).resolves.toBe(1);
  });

  test("race management shows the team on every member and edits them together", async ({ page }) => {
    const { team } = await seedQuadSquad();

    await organiserLogin(page);
    await page.goto(`/organiser/events/${PAID_TEAM_ID}/registrations`);
    await expect(page.getByTestId("team-badge").filter({ hasText: "Quad Squad" })).toHaveCount(4);

    // A bib set on one member is the team's: it lands on the Team row.
    await page.getByRole("button", { name: "Edit Ari Quad" }).click();
    await expect(page.getByTestId("edit-team")).toBeVisible();
    await page.locator("#edit-bib").fill("77");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect.poll(async () =>
      (await prisma.team.findUnique({ where: { id: team.id }, select: { bibNumber: true } }))?.bibNumber,
    ).toBe("77");
  });

  test("race management flags a team that has lost a member", async ({ page }) => {
    await seedQuadSquad(["CONFIRMED", "CONFIRMED", "CONFIRMED", "CANCELLED"]);

    await organiserLogin(page);
    await page.goto(`/organiser/events/${PAID_TEAM_ID}/registrations`);
    await expect(page.getByTestId("team-badge").filter({ hasText: "Quad Squad · 3/4" }).first()).toBeVisible();
  });

  test("a member swap refuses someone already entered, and is recorded when it goes through", async ({ page }) => {
    const { team, members } = await seedQuadSquad();
    await organiserLogin(page);
    const swap = (person: Record<string, string>) =>
      page.request.patch(`/api/organiser/events/${PAID_TEAM_ID}/teams/${team.id}`, {
        data: {
          member: {
            registrationId: members[0].id,
            dateOfBirth: "1990-05-01",
            mobile: "0412 345 678",
            emergencyContactName: "Sam Rivers",
            emergencyContactPhone: "0498 111 222",
            ...person,
          },
        },
      });

    // Bo is already on the team: checkout would refuse a second entry, so does a swap.
    const clash = await swap({ firstName: "Bo", lastName: "Quad", email: "quad-1@example.com" });
    expect(clash.status()).toBe(409);
    expect((await clash.json()).error).toMatch(/already holds an entry/);

    const ok = await swap({ firstName: "Eve", lastName: "Newman", email: "eve.newman@example.com" });
    expect(ok.status()).toBe(200);

    const entry = await prisma.registration.findUniqueOrThrow({
      where: { id: members[0].id },
      select: { athleteName: true, athleteEmail: true, teamId: true },
    });
    expect(entry).toEqual({ athleteName: "Eve Newman", athleteEmail: "eve.newman@example.com", teamId: team.id });

    const change = await prisma.teamMemberChange.findFirstOrThrow({ where: { teamId: team.id, kind: "SWAP" } });
    expect(change.registrationId).toBe(members[0].id);
    expect(change.before).toMatchObject({ athleteName: "Ari Quad" });
    expect(change.after).toMatchObject({ athleteName: "Eve Newman" });
  });

  test("a team ticket's size is locked once it has entries", async ({ page }) => {
    await seedQuadSquad();
    await organiserLogin(page);

    const res = await page.request.patch(`/api/organiser/events/${PAID_TEAM_ID}`, {
      data: { waves: [{ label: "Squad", price: "45", teamSize: 3, qty: 5 }] },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatch(/already has entries/);

    const event = await prisma.event.findUniqueOrThrow({ where: { id: PAID_TEAM_ID }, select: { waves: true } });
    expect((event.waves as { teamSize?: number }[])[0].teamSize).toBe(4);
  });

  test("the editor asks for a team size and prices per person", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(`/organiser/new-listing?id=${PAID_TEAM_ID}`);

    const ticket = page.getByTestId("ticket-row").first();
    // The editor starts on a blank individual ticket and swaps in the saved
    // one when the event loads, which can be slow on a cold CI server.
    await expect(ticket.getByLabel("Ticket category name")).toHaveValue("Squad", { timeout: 30000 });
    await expect(ticket.getByLabel("People per team", { exact: true })).toHaveValue("4");
    await expect(ticket.getByText("Price per person")).toBeVisible();
    await expect(ticket.getByText("Teams available")).toBeVisible();
    await page.getByTestId("fee-breakdown").first().getByRole("button", { name: "About fees and payout" }).click();
    await expect(page.getByTestId("fee-breakdown-team")).toContainText(/a team of 4 pays/i);
  });

  test("each ticket is set to Individual or Team, and the format follows", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");

    // Every ticket has the switch, with no format to choose first.
    const format = page.getByTestId("event-format");
    await expect(format).toContainText("Individual");
    const first = page.getByTestId("ticket-row").first();
    await first.getByRole("radio", { name: "Team" }).click();

    // Two people per team reads as Pairs.
    await expect(first.getByLabel("People per team", { exact: true })).toHaveValue("2");
    await expect(first.getByText("Price per person")).toBeVisible();
    await expect(first.getByText("Teams available")).toBeVisible();
    await expect(format).toContainText("Pairs");

    // Three or more reads as Team.
    await first.getByLabel("People per team", { exact: true }).fill("4");
    await expect(format).toContainText("Team");

    // A second, individual ticket makes it a mix.
    await page.getByRole("button", { name: /add another ticket/i }).click();
    await expect(format).toContainText("Individual & Team");
  });
});
