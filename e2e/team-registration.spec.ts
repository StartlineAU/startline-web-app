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
    const organiser = await prisma.event.findUniqueOrThrow({
      where: { id: PAID_TEAM_ID },
      select: { organiserId: true },
    });
    const team = await prisma.team.create({
      data: { eventId: PAID_TEAM_ID, name: "Quad Squad", ticketLabel: "Squad", size: 4 },
    });
    const names = ["Ari", "Bo", "Cy", "Di"];
    for (const [i, first] of names.entries()) {
      await prisma.registration.create({
        data: {
          eventId: PAID_TEAM_ID,
          organiserId: organiser.organiserId,
          athleteName: `${first} Quad`,
          athleteEmail: `quad-${i}@example.com`,
          firstName: first,
          lastName: "Quad",
          waveLabel: "Squad",
          status: "CONFIRMED",
          teamId: team.id,
          amountCents: 4500,
        },
      });
    }

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

  test("the editor asks for a team size and prices per person", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(`/organiser/new-listing?id=${PAID_TEAM_ID}`);

    const ticket = page.getByTestId("ticket-row").first();
    await expect(ticket.getByLabel("People per team")).toHaveValue("4");
    await expect(ticket.getByText("Price per person")).toBeVisible();
    await expect(ticket.getByText("Teams available")).toBeVisible();
    await expect(page.getByTestId("fee-breakdown-team")).toContainText(/a team of 4 pays/i);
  });
});
