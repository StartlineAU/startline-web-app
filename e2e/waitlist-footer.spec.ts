import { test, expect, chromium } from "@playwright/test";

// The admin contact address is for the launched site, so the waitlist footer
// shows it on production only. The gate reads the browser's host, so the
// production side is exercised by pointing the apex domain at the dev server
// with Chromium's host-resolver rule and loading the page as production would.

const CONTACT = "admin@startlineau.com";
const DOMAIN = "startlineau.com";

/** The port the dev server is actually on, so this works wherever it is running. */
function devServerPort(baseURL: string | undefined): string {
  return new URL(baseURL ?? "http://localhost:3000").port || "80";
}

/** A browser whose DNS sends these hosts to the local dev server. */
function launchWithHosts(hosts: string[]) {
  const map = hosts.map((host) => `MAP ${host} 127.0.0.1`).join(", ");
  return chromium.launch({ args: [`--host-resolver-rules=${map}`] });
}

test.describe("waitlist footer contact address", () => {
  test("production shows the admin address in the footer", async ({}, testInfo) => {
    const port = devServerPort(testInfo.project.use.baseURL);
    const browser = await launchWithHosts([DOMAIN, `www.${DOMAIN}`]);
    try {
      for (const host of [DOMAIN, `www.${DOMAIN}`]) {
        const page = await browser.newPage();
        await page.goto(`http://${host}:${port}/waitlist`);

        const link = page.locator("footer").getByRole("link", { name: CONTACT });
        await expect(link, host).toBeVisible();
        await expect(link, host).toHaveAttribute("href", `mailto:${CONTACT}`);
        // Still the legal footer, and the legal links keep working.
        await expect(page.locator("footer").getByRole("link", { name: "Terms", exact: true }), host).toBeVisible();
      }
    } finally {
      await browser.close();
    }
  });

  test("every other deployment leaves the address out", async ({}, testInfo) => {
    const port = devServerPort(testInfo.project.use.baseURL);
    for (const host of ["localhost", "waitlist-staging.example.test"]) {
      const browser = await launchWithHosts([host]);
      try {
        const page = await browser.newPage();
        await page.goto(`http://${host}:${port}/waitlist`);
        await page.waitForLoadState("networkidle");

        const footer = page.locator("footer");
        await expect(footer).toContainText("ABN 85 775 067 904");
        await expect(footer.getByRole("link", { name: CONTACT }), host).toHaveCount(0);
      } finally {
        await browser.close();
      }
    }
  });
});
