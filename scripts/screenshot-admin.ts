import { chromium } from "@playwright/test";
import path from "path";

const BASE = "http://localhost:3000";
const SHOTS_DIR = path.join(process.cwd());

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await ctx.newPage();

  // ── Login ────────────────────────────────────────────────────────────────
  console.log("Navigating to admin login…");
  await page.goto(`${BASE}/admin/login`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SHOTS_DIR}/admin-login.png` });

  await page.fill('input[type="email"]',    "admin@startline.test");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard after login
  await page.waitForURL(`${BASE}/admin/dashboard`, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  console.log("Logged in — on dashboard");
  await page.screenshot({ path: `${SHOTS_DIR}/admin-dashboard.png` });

  // helper: go to a page and wait until the loading spinner is gone
  const gotoAndWait = async (url: string, file: string) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    // wait for the spinner to disappear (data loaded) or 6 s max
    await page.waitForFunction(
      () => !document.querySelector(".animate-spin"),
      { timeout: 6000 },
    ).catch(() => {});
    await page.waitForTimeout(400); // let final paint settle
    await page.screenshot({ path: file });
    console.log(`  ✓ ${file.split("/").pop()}`);
  };

  // ── Events page (with new bulk / pin / delete controls) ──────────────────
  await gotoAndWait(`${BASE}/admin/events?status=APPROVED`, `${SHOTS_DIR}/admin-events-approved.png`);

  // ── Organisers page (with Suspend/Activate) ───────────────────────────────
  await gotoAndWait(`${BASE}/admin/organisers`, `${SHOTS_DIR}/admin-organisers.png`);

  // ── Users page ────────────────────────────────────────────────────────────
  await gotoAndWait(`${BASE}/admin/users`, `${SHOTS_DIR}/admin-users.png`);

  // ── Registrations page ────────────────────────────────────────────────────
  await gotoAndWait(`${BASE}/admin/registrations`, `${SHOTS_DIR}/admin-registrations.png`);

  // ── Analytics page ────────────────────────────────────────────────────────
  await gotoAndWait(`${BASE}/admin/analytics`, `${SHOTS_DIR}/admin-analytics.png`);

  // ── Audit log page ────────────────────────────────────────────────────────
  await gotoAndWait(`${BASE}/admin/audit`, `${SHOTS_DIR}/admin-audit.png`);

  console.log("\nAll screenshots saved.");
  await browser.close();
}

run().catch((err) => { console.error(err); process.exit(1); });
