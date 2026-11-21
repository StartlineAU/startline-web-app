import { test, expect } from "@playwright/test";

// #547: robots.txt and the sitemap it names are real files, not pages. The
// suite runs on localhost, which is not a production portal, so both tell a
// crawler to stay out. The production contents are covered by the unit tests.

test.describe("crawler files", () => {
  test("robots.txt is plain text that disallows a non-production host", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");

    const body = await res.text();
    expect(body).toContain("User-Agent: *");
    expect(body).toContain("Disallow: /");
    expect(body).not.toContain("<html");
  });

  test("sitemap.xml is valid XML with no URLs on a non-production host", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("xml");

    const body = await res.text();
    expect(body).toMatch(/^<\?xml/);
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(body).not.toContain("<loc>");
  });
});
