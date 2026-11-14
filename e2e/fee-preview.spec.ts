import { test, expect } from "@playwright/test";
import { organiserLogin } from "./helpers";

// #470: organisers absorb Stripe's processing fee. Each ticket card previews
// what the ticket pays out, and it must match what checkout charges to the
// cent. A$50, athlete pays the booking fee (the editor's default):
//   booking fee  3.95% x 50 + 1.45           = A$3.43
//   athlete pays 50 + 3.43                   = A$53.43
//   Stripe fee   1.75% x 53.43 + 0.30        = A$1.24 (on the whole charge)
//   you receive  50 - 1.24                   = A$48.76
test.describe("ticket fee preview", () => {
  test("shows the organiser's net after the Stripe fee", async ({ page }) => {
    await organiserLogin(page);
    await page.goto("/organiser/new-listing");

    await page.getByLabel("Ticket price").fill("50");

    const preview = page.getByTestId("fee-breakdown").first();
    await expect(preview).toBeVisible();
    const row = (label: string) => preview.locator(`[data-fee-row="${label}"]`);
    await expect(row("Athlete pays")).toContainText("A$53.43");
    await expect(row("You receive")).toContainText("A$48.76");
    await expect(row("Startline fee")).toContainText("A$3.43");
    await expect(row("Stripe fee")).toContainText("A$1.24");
  });
});
