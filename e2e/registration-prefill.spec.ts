import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDatabaseUrl } from "./helpers";

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// #532: checkout put the buyer's own name and number in the emergency contact
// fields. A saved contact that is the buyer themselves is no longer prefilled,
// and the contact fields are their own autofill section so the browser does
// not copy the buyer's details into them either.
const REG = "/events/seed-event-001/register";
const EMAIL = "jade.nguyen@startline.test";

test.describe.serial("registration prefill: emergency contact", () => {
  let saved: { name: string | null; mobile: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null } | null = null;

  test.beforeAll(async () => {
    saved = await prisma.user.findUnique({
      where: { email: EMAIL },
      select: { name: true, mobile: true, emergencyContactName: true, emergencyContactPhone: true },
    });
  });

  test.afterAll(async () => {
    if (saved) await prisma.user.update({ where: { email: EMAIL }, data: saved });
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: "__e2e_bypass", value: "user", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
  });

  async function openDetails(page: import("@playwright/test").Page) {
    await page.goto(REG);
    await page.getByRole("button", { name: /add one .* ticket/i }).first().click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.locator("#p0-firstName")).toHaveValue("Jade", { timeout: 30000 });
  }

  test("a saved contact that is the buyer is not prefilled", async ({ page }) => {
    await prisma.user.update({
      where: { email: EMAIL },
      data: { name: "Jade Nguyen", mobile: "0412345678", emergencyContactName: "Jade Nguyen", emergencyContactPhone: "0412345678" },
    });

    await openDetails(page);
    await expect(page.locator("#p0-ecName")).toHaveValue("");
    await expect(page.locator("#p0-ecPhone")).toHaveValue("");
  });

  test("a real saved contact is still prefilled", async ({ page }) => {
    await prisma.user.update({
      where: { email: EMAIL },
      data: { name: "Jade Nguyen", mobile: "0412345678", emergencyContactName: "Sam Nguyen", emergencyContactPhone: "0498111222" },
    });

    await openDetails(page);
    await expect(page.locator("#p0-ecName")).toHaveValue("Sam Nguyen");
    await expect(page.locator("#p0-ecPhone")).not.toHaveValue("");
  });

  test("the contact fields are a separate autofill section", async ({ page }) => {
    await openDetails(page);
    await expect(page.locator("#p0-ecName")).toHaveAttribute("autocomplete", "section-emergency-contact name");
    await expect(page.locator("#p0-ecPhone")).toHaveAttribute("autocomplete", "section-emergency-contact tel");
  });
});
