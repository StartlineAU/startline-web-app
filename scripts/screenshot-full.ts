import { chromium } from "@playwright/test";
import path from "path";

const BASE     = "http://localhost:3000";
const SHOTS    = path.join(process.cwd());

const wait = async (page: import("@playwright/test").Page, url: string, file: string) => {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => !document.querySelector(".animate-spin"), { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${path.basename(file)}`);
};

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 30 });

  // ── Public / user-facing site ─────────────────────────────────────────────
  {
    const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    console.log("\n── Public site ──");
    await wait(page, `${BASE}/`,                     `${SHOTS}/site-home.png`);
    await wait(page, `${BASE}/events`,               `${SHOTS}/site-events.png`).catch(() => {
      console.log("  (events page skipped — may require auth)");
    });
    await ctx.close();
  }

  // ── Admin portal ──────────────────────────────────────────────────────────
  {
    const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/admin/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]',    "admin@startline.test");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/admin/dashboard`, { timeout: 15000 });
    console.log("\n── Admin portal ──");

    await wait(page, `${BASE}/admin/dashboard`,             `${SHOTS}/admin-dashboard.png`);
    await wait(page, `${BASE}/admin/events?status=APPROVED`,`${SHOTS}/admin-events.png`);
    await wait(page, `${BASE}/admin/events?status=PENDING`, `${SHOTS}/admin-events-pending.png`);
    await wait(page, `${BASE}/admin/organisers`,            `${SHOTS}/admin-organisers.png`);
    await wait(page, `${BASE}/admin/users`,                 `${SHOTS}/admin-users.png`);
    await wait(page, `${BASE}/admin/registrations`,         `${SHOTS}/admin-registrations.png`);
    await wait(page, `${BASE}/admin/analytics`,             `${SHOTS}/admin-analytics.png`);
    await wait(page, `${BASE}/admin/audit`,                 `${SHOTS}/admin-audit.png`);
    await ctx.close();
  }

  await browser.close();
  console.log("\nDone.");
}

run().catch((e) => { console.error(e); process.exit(1); });
