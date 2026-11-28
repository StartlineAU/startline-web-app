import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { adminLogin, ensureDatabaseUrl } from "./helpers";

// An admin sets up an organisation for an organiser who is not on Startline
// yet, lists its events, and the organiser claims it as Owner
// (lib/organiser-claim.ts). The claimant is the `athlete` bypass identity,
// Harper Jones, the seed's one account with no organisation.

ensureDatabaseUrl();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CLAIMANT = "harper.jones@startline.test";
const ORG_NAME = "E2E Claimable Runners";
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// Harper must end with no organisation, or other specs that use the
// `athlete` identity are redirected to the organiser portal.
async function cleanUp() {
  await prisma.organiser.deleteMany({
    where: { OR: [{ orgName: ORG_NAME }, { email: CLAIMANT }] },
  });
}

test.beforeEach(cleanUp);
test.afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

test.describe("Admin-created organisations", () => {
  test("admin creates one, sends the claim invite, and only the invited account can claim it", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/organisers");

    await page.getByRole("button", { name: /add organisation/i }).click();
    const form = page.getByRole("form", { name: "Add organisation" });
    await form.getByLabel("Organisation name").fill(ORG_NAME);
    await form.getByLabel("Organiser email").fill(CLAIMANT);
    await form.getByLabel(/email the claim invite now/i).check();
    await form.getByRole("button", { name: /create organisation/i }).click();

    // The banner, and the organisation's own card, say where it went.
    await expect(page.getByText(`Claim invite sent to ${CLAIMANT}`).first()).toBeVisible();
    const inviteUrl = await page.getByText(/\/organiser\/invite\?token=/).textContent();
    const token = new URL(inviteUrl!.trim()).searchParams.get("token");
    expect(token).toBeTruthy();

    const organiser = await prisma.organiser.findFirst({
      where: { orgName: ORG_NAME },
      select: { id: true, pendingClaim: true, verified: true, _count: { select: { members: true } } },
    });
    expect(organiser).toMatchObject({ pendingClaim: true, verified: true, _count: { members: 0 } });

    // The card says it is waiting to be claimed.
    await expect(page.getByText("Unclaimed").first()).toBeVisible();

    // Another account holding the link cannot claim it.
    const wrong = await fetch(`${BASE_URL}/api/organiser/invites/accept`, {
      method: "POST",
      headers: { Cookie: "__e2e_bypass=user", "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(wrong.status).toBe(403);

    // The invited account sees a claim, not a manager invitation.
    const view = await fetch(`${BASE_URL}/api/organiser/invites?token=${encodeURIComponent(token!)}`, {
      headers: { Cookie: "__e2e_bypass=athlete" },
    });
    expect(await view.json()).toMatchObject({ role: "OWNER", state: "pending", signedInAsInvitee: true });

    const accepted = await fetch(`${BASE_URL}/api/organiser/invites/accept`, {
      method: "POST",
      headers: { Cookie: "__e2e_bypass=athlete", "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(accepted.status).toBe(200);

    const claimed = await prisma.organiser.findUnique({
      where: { id: organiser!.id },
      select: { pendingClaim: true, members: { select: { role: true, user: { select: { email: true } } } } },
    });
    expect(claimed?.pendingClaim).toBe(false);
    expect(claimed?.members).toEqual([{ role: "OWNER", user: { email: CLAIMANT } }]);

    // Claimed is final: the admin can no longer send a claim link.
    await page.reload();
    await expect(page.getByText(ORG_NAME)).toBeVisible();
    const again = await page.request.post(`/api/admin/organisers/${organiser!.id}/claim-invite`, { data: {} });
    expect(again.status()).toBe(409);
  });

  test("admin can pick an unclaimed organisation when creating an event", async ({ page }) => {
    await prisma.organiser.create({
      data: { email: CLAIMANT, orgName: ORG_NAME, verified: true, pendingClaim: true, photos: [] },
    });
    await adminLogin(page);
    await page.goto("/admin/events/create");
    const select = page.locator("select").first();
    await expect(select.locator("option", { hasText: `${ORG_NAME} · verified · unclaimed` })).toHaveCount(1);
  });

  test("setting up an organisation under an address Startline already used offers the claim instead", async () => {
    await prisma.organiser.create({
      data: { email: CLAIMANT, orgName: ORG_NAME, verified: true, pendingClaim: true, photos: [] },
    });

    const res = await fetch(`${BASE_URL}/api/organiser/setup`, {
      method: "POST",
      headers: { Cookie: "__e2e_bypass=athlete", "Content-Type": "application/json" },
      body: JSON.stringify({
        orgName: "Someone New", contactName: "Harper Jones", contactEmail: CLAIMANT, phone: "",
      }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "CLAIM_AVAILABLE" });

    const invites = await prisma.organiserInvite.findMany({
      where: { organiser: { email: CLAIMANT } },
      select: { role: true, email: true },
    });
    expect(invites).toEqual([{ role: "OWNER", email: CLAIMANT }]);
  });
});
