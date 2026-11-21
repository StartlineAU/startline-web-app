import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl, organiserLogin, organiserMemberLogin, expectOrganiserDashboard } from "./helpers";

ensureDatabaseUrl();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const INVITEE = "jade.nguyen@startline.test";
const NOBODY = "nobody@nowhere.test";
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function apexId(): Promise<string> {
  const org = await prisma.organiser.findFirst({ where: { orgName: "Apex Endurance Events" }, select: { id: true } });
  expect(org, "seeded Apex organiser should exist").toBeTruthy();
  return org!.id;
}

// Jade is invited to Apex here; undo it so the next run and other specs see
// the seeded roster.
async function cleanUp() {
  const organiserId = await apexId();
  await prisma.organiserInvite.deleteMany({ where: { organiserId, email: { in: [INVITEE, NOBODY] } } });
  await prisma.organiserMember.deleteMany({
    where: { organiserId, role: "MANAGER", user: { email: INVITEE } },
  });
}

test.beforeEach(cleanUp);
test.afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

test.describe("organiser members", () => {
  test("owner sees members page with both members", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/members");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();
    await expect(page.getByText("sarah.mitchell@startline.test")).toBeVisible();
    // Scoped to main: the sidebar renders its own "Owner" badge, so an unscoped
    // locator is a strict-mode violation the moment the nav finishes rendering.
    await expect(page.getByRole("main").getByText("Owner", { exact: true })).toBeVisible();
    await expect(page.getByText("tom.whitfield@startline.test")).toBeVisible();
    await expect(page.getByText("Manager", { exact: true }).first()).toBeVisible();
  });

  test("owner invites by email, and the person joins only when they accept", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/members");
    await page.getByRole("heading", { name: /members/i }).waitFor();

    await page.getByPlaceholder("team@email.com").fill(INVITEE);
    await page.getByRole("button", { name: /invite member/i }).click();

    await expect(page.getByText(/invitation sent to/i)).toBeVisible();
    const inviteUrl = await page.getByLabel("Invitation link").inputValue();
    const token = new URL(inviteUrl).searchParams.get("token");
    expect(token).toBeTruthy();

    // Invited, not a member yet.
    const organiserId = await apexId();
    expect(await prisma.organiserMember.count({ where: { organiserId, user: { email: INVITEE } } })).toBe(0);

    // Someone else holding the link cannot use it.
    const wrong = await fetch(`${BASE_URL}/api/organiser/invites/accept`, {
      method: "POST",
      headers: { Cookie: "__e2e_bypass=athlete", "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(wrong.status).toBe(403);

    // The invited account accepts.
    const accepted = await fetch(`${BASE_URL}/api/organiser/invites/accept`, {
      method: "POST",
      headers: { Cookie: "__e2e_bypass=user", "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(accepted.status).toBe(200);
    expect(await prisma.organiserMember.count({ where: { organiserId, user: { email: INVITEE } } })).toBe(1);

    await page.reload();
    await expect(page.getByRole("main").getByText(INVITEE).first()).toBeVisible();
  });

  test("inviting an address says nothing about whether it has an account", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/members");
    await page.getByRole("heading", { name: /members/i }).waitFor();

    await page.getByPlaceholder("team@email.com").fill(NOBODY);
    await page.getByRole("button", { name: /invite member/i }).click();

    await expect(page.getByText(/invitation sent to/i)).toBeVisible();
    await expect(page.getByText(/no account found/i)).toHaveCount(0);
    await page.getByRole("button", { name: `Withdraw the invitation to ${NOBODY}` }).click();
    await expect(page.getByRole("button", { name: `Withdraw the invitation to ${NOBODY}` })).toHaveCount(0);
  });

  test("member (manager) can view the roster but not manage it", async ({ page }) => {
    await organiserMemberLogin(page);
    await page.goto("/organiser/members");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();
    await expect(page.getByText("sarah.mitchell@startline.test")).toBeVisible();
    await expect(page.getByPlaceholder("team@email.com")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /transfer ownership/i })).not.toBeVisible();
  });

  test("member (admin) cannot add members", async ({ page }) => {
    await organiserMemberLogin(page);
    const res = await page.request.post("/api/organiser/members", {
      data: { email: "jade.nguyen@startline.test" },
    });
    expect(res.status()).toBe(403);
  });

  test("member (admin) can still reach the dashboard", async ({ page }) => {
    await organiserMemberLogin(page);
    await expectOrganiserDashboard(page);
  });
});
