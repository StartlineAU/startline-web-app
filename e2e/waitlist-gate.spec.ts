import { test, expect } from "@playwright/test";

// The waitlist gate only runs on the production hostnames, which neither CI nor
// local dev serves. These requests therefore send the Host header the deployed
// site receives, straight at the dev server, and read the HTML back. A browser
// page cannot set Host, so the request client is the right tool here.
const PROD_HOST = "startlineau.com";

const asProduction = (host = PROD_HOST) => ({ headers: { Host: host } });

/** The footer the live site never renders. */
const WAITLIST_FOOTER = 'aria-label="Legal"';
/** The mobile menu button, part of the real site chrome. */
const SITE_NAV = 'aria-label="Toggle menu"';

test.describe("production waitlist gate", () => {
  test("keeps the athlete homepage on the waitlist", async ({ request }) => {
    const res = await request.get("/", asProduction());

    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("Cross the start line");
    expect(html).toContain(WAITLIST_FOOTER);
    // The waitlist carries the contact address, so a visitor can reach someone
    // before the site opens.
    expect(html).toContain('href="mailto:admin@startlineau.com"');
    expect(html).not.toContain(SITE_NAV);
  });

  test("gates the rest of the athlete site, not only the homepage", async ({ request }) => {
    for (const path of ["/events", "/events/seed-event-001", "/about", "/faq"]) {
      const res = await request.get(path, asProduction());
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      expect(html, path).toContain("Cross the start line");
      expect(html, path).not.toContain(SITE_NAV);
    }
  });

  test("gates the www hostname too", async ({ request }) => {
    const res = await request.get("/events", asProduction("www.startlineau.com"));

    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("Cross the start line");
  });

  test("serves the legal pages in their waitlist layout", async ({ request }) => {
    for (const [path, heading] of [
      ["/terms", "Terms of Service"],
      ["/privacy", "Privacy Policy"],
      ["/cookies", "Cookie Policy"],
    ] as const) {
      const res = await request.get(path, asProduction());
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      expect(html, path).toContain(heading);
      // The waitlist layout keeps only the logo and the legal footer, so the
      // full site navigation (and its sign-up) is not on offer.
      expect(html, path).toContain(WAITLIST_FOOTER);
      expect(html, path).not.toContain(SITE_NAV);
    }
  });

  test("does not swallow callers that cannot sign in", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", asProduction());

    // Not the waitlist HTML stamped on a 200: Stripe would read that as
    // delivered. The handler answers with its own error instead.
    expect(res.status()).not.toBe(200);
    expect(await res.text()).not.toContain("Cross the start line");
  });

  test("leaves the waitlist itself reachable", async ({ request }) => {
    const res = await request.get("/waitlist", asProduction());

    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("Cross the start line");
  });

  test("keeps the site open where all portals share a host", async ({ request }) => {
    // Local dev and staging are single-host deployments. Whatever the waitlist
    // mode says, they serve the real site.
    const res = await request.get("/about");

    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).not.toContain(WAITLIST_FOOTER);
    expect(html).toContain(SITE_NAV);
  });
});
