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
      if (i > 0) await page.getByText(/member 2 of 2/i).click();
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
    await expect(ticket.getByLabel("People per team", { exact: true })).toHaveValue("4");
    await expect(ticket.getByText("Price per person")).toBeVisible();
    await expect(ticket.getByText("Teams available")).toBeVisible();
    await expect(page.getByTestId("fee-breakdown-team")).toContainText(/a team of 4 pays/i);
  });
});
