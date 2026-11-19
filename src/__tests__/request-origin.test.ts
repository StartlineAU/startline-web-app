import { describe, expect, it } from "vitest";
import { crossSiteWriteBlocked } from "@/lib/request-origin";

const base = {
  method: "POST",
  pathname: "/api/user/mfa",
  host: "startlineau.com",
  origin: "https://startlineau.com",
  authorization: null,
  protocol: "https:",
};

describe("crossSiteWriteBlocked", () => {
  it("lets the site's own pages and the other portals write", () => {
    expect(crossSiteWriteBlocked(base)).toBe(false);
    expect(crossSiteWriteBlocked({ ...base, origin: "https://organiser.startlineau.com" })).toBe(false);
    expect(crossSiteWriteBlocked({ ...base, host: "main.d1.amplifyapp.com", origin: "https://main.d1.amplifyapp.com" })).toBe(false);
  });

  it("refuses a write from a sibling subdomain, which SameSite=Lax lets through", () => {
    expect(crossSiteWriteBlocked({ ...base, origin: "https://docs.startlineau.com" })).toBe(true);
    expect(crossSiteWriteBlocked({ ...base, origin: "https://evil.example" })).toBe(true);
    expect(crossSiteWriteBlocked({ ...base, origin: "null" })).toBe(true);
  });

  it("only applies to state-changing API calls", () => {
    expect(crossSiteWriteBlocked({ ...base, method: "GET", origin: "https://evil.example" })).toBe(false);
    expect(crossSiteWriteBlocked({ ...base, pathname: "/events", origin: "https://evil.example" })).toBe(false);
  });

  it("passes requests without an Origin (Stripe, the scheduler) and bearer-token clients", () => {
    expect(crossSiteWriteBlocked({ ...base, origin: null })).toBe(false);
    expect(crossSiteWriteBlocked({ ...base, origin: "https://evil.example", authorization: "Bearer abc" })).toBe(false);
  });

  it("accepts http only for the request's own plain-http host", () => {
    expect(crossSiteWriteBlocked({ ...base, host: "localhost:3000", origin: "http://localhost:3000", protocol: "http:" })).toBe(false);
    expect(crossSiteWriteBlocked({ ...base, origin: "http://startlineau.com" })).toBe(true);
  });
});
