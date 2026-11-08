import { test, expect } from "@playwright/test";
import { adminLogin, pickTime } from "./helpers";

// #470: organisers absorb Stripe's processing fee. The ticket step previews
// what each ticket pays out, and it must match what checkout charges to the
// cent. A$50, athlete pays the booking fee:
//   booking fee  3.95% x 50 + 1.45           = A$3.43
//   athlete pays 50 + 3.43                   = A$53.43
//   Stripe fee   1.75% x 53.43 + 0.30        = A$1.24 (on the whole charge)
//   you receive  50 - 1.24                   = A$48.76
test.describe("ticket fee preview", () => {
  test("shows the organiser's net after the Stripe fee", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/events/create");
    await expect(page.getByText("The Basics").first()).toBeVisible();

    // Step 1 — The Basics
    await page.getByPlaceholder(/Apex Throwdown/i).fill(`E2E Fee Preview ${Date.now()}`);
    await page.getByRole("button", { name: /individual solo athletes/i }).click();
    await page.getByRole("button", { name: /^running/i }).click();
    await page.getByRole("button", { name: /^10km$/i }).click();
    await page.getByRole("button", { name: /moderate/i }).click();
    await page.getByRole("button", { name: /1,000/i }).click();
    await page.getByRole("button", { name: /open to all/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2 — Date & Location
    await expect(page.getByText(/when and where/i).first()).toBeVisible();
    await page.getByText("Pick start date").click();
    await page.getByRole("button", { name: /today/i }).click();
    await pickTime(page, "Start time", { hour: "9", minute: "00", period: "AM" });
    await page.getByPlaceholder(/start typing an address/i).fill("1 Test St, Sydney NSW 2000");
    const cityInput = page.getByPlaceholder(/e.g. Melbourne/i);
    if (await cityInput.isVisible()) await cityInput.fill("Sydney");
    await page.getByRole("combobox", { name: /state/i }).click();
    await page.getByRole("option", { name: /NSW/ }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 3 — Tickets & Pricing
    await page.getByRole("button", { name: /startline/i }).first().click();
    await page.getByPlaceholder(/general admission/i).first().fill("Standard Entry");
    await page.locator('input[placeholder="129"]').first().fill("50");

    const preview = page.getByTestId("ticket-fee-preview").first();
    await expect(preview).toBeVisible();
    const row = (label: string) => preview.locator(`[data-fee-row="${label}"]`);
    await expect(row("Athlete pays")).toContainText("A$53.43");
    await expect(row("You receive")).toContainText("A$48.76");
    await expect(row("Startline fee")).toContainText("A$3.43");
    await expect(row("Stripe fee")).toContainText("A$1.24");
  });
});
