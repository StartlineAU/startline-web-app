import { describe, expect, it } from "vitest";
import {
  adminUrl,
  authCookieDomain,
  customerHref,
  organiserHref,
  organiserUrl,
  portalsAreSplit,
} from "@/lib/portal-domains";

const STAGING = "main.d1abc2def3.amplifyapp.com";
const PREVIEW = "pr-302.d1abc2def3.amplifyapp.com";

describe("portalsAreSplit", () => {
  it("is true only for the production hostnames", () => {
    expect(portalsAreSplit("startlineau.com")).toBe(true);
    expect(portalsAreSplit("www.startlineau.com")).toBe(true);
    expect(portalsAreSplit("organiser.startlineau.com")).toBe(true);
    expect(portalsAreSplit("admin.startlineau.com")).toBe(true);
  });

  it("is false wherever one host serves every portal", () => {
    expect(portalsAreSplit(STAGING)).toBe(false);
    expect(portalsAreSplit(PREVIEW)).toBe(false);
    expect(portalsAreSplit("localhost:3000")).toBe(false);
    expect(portalsAreSplit("")).toBe(false);
    expect(portalsAreSplit(null)).toBe(false);
  });

  it("ignores case and port", () => {
    expect(portalsAreSplit("Organiser.StartlineAU.com")).toBe(true);
    expect(portalsAreSplit("startlineau.com:443")).toBe(true);
  });
});

describe("cross-portal links", () => {
  it("goes absolute in production", () => {
    expect(customerHref("/organiser-setup", "organiser.startlineau.com")).toBe(
      "https://startlineau.com/organiser-setup",
    );
    expect(organiserHref("/organiser/dashboard", "startlineau.com")).toBe(
      "https://organiser.startlineau.com/organiser/dashboard",
    );
  });

  // The absolute URL pointed at a hostname that does not resolve on these
  // deployments, which is what turned "Get started" into a browser error page.
  it("stays relative where one host serves every portal", () => {
    expect(customerHref("/organiser-setup", STAGING)).toBe("/organiser-setup");
    expect(customerHref("/organiser-setup", PREVIEW)).toBe("/organiser-setup");
    expect(organiserHref("/organiser/dashboard", "localhost:3000")).toBe("/organiser/dashboard");
  });
});

describe("absolute portal URLs", () => {
  // Production's site URL is the athlete host, which rewrites /organiser/* to
  // the waitlist: a Stripe return_url built from it stranded the organiser
  // there after onboarding (issue #322).
  it("uses the portal's own hostname in production", () => {
    expect(organiserUrl("/organiser/payments/return", "https://startlineau.com")).toBe(
      "https://organiser.startlineau.com/organiser/payments/return",
    );
    expect(adminUrl("/admin/events/evt-1", "https://startlineau.com")).toBe(
      "https://admin.startlineau.com/admin/events/evt-1",
    );
  });

  it("stays on the site where one host serves every portal", () => {
    expect(organiserUrl("/organiser/payments", `https://${STAGING}`)).toBe(
      `https://${STAGING}/organiser/payments`,
    );
    expect(adminUrl("/admin/events/evt-1", "http://localhost:3000/")).toBe(
      "http://localhost:3000/admin/events/evt-1",
    );
  });

  it("still prefixes a site URL it cannot parse", () => {
    expect(adminUrl("/admin/events", "not a url")).toBe("not a url/admin/events");
  });
});

describe("authCookieDomain", () => {
  // Host-only cookies left organiser.startlineau.com permanently signed out.
  it("shares the session across the production subdomains", () => {
    expect(authCookieDomain("startlineau.com")).toBe(".startlineau.com");
    expect(authCookieDomain("www.startlineau.com")).toBe(".startlineau.com");
    expect(authCookieDomain("organiser.startlineau.com")).toBe(".startlineau.com");
    expect(authCookieDomain("admin.startlineau.com")).toBe(".startlineau.com");
  });

  // Naming a domain the browser is not on makes it drop the cookie outright,
  // which would break auth everywhere except production.
  it("leaves the domain unset off that registrable domain", () => {
    expect(authCookieDomain(STAGING)).toBeUndefined();
    expect(authCookieDomain(PREVIEW)).toBeUndefined();
    expect(authCookieDomain("localhost:3000")).toBeUndefined();
    expect(authCookieDomain("")).toBeUndefined();
  });

  it("is not fooled by a lookalike suffix", () => {
    expect(authCookieDomain("notstartlineau.com")).toBeUndefined();
    expect(authCookieDomain("startlineau.com.evil.test")).toBeUndefined();
  });
});
