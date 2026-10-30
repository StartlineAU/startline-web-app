import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLegalPath,
  publicSiteMode,
  servesWhileWaitlisted,
} from "@/lib/site-mode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publicSiteMode", () => {
  it("defaults to the waitlist when unset", () => {
    vi.stubEnv("PUBLIC_SITE_MODE", "");
    expect(publicSiteMode()).toBe("waitlist");
  });

  it("defaults to the waitlist when the value is unrecognised", () => {
    for (const value of ["", "open", "1", "true"]) {
      vi.stubEnv("PUBLIC_SITE_MODE", value);
      expect(publicSiteMode(), value).toBe("waitlist");
    }
  });

  it("accepts live regardless of case and surrounding space", () => {
    vi.stubEnv("PUBLIC_SITE_MODE", "live");
    expect(publicSiteMode()).toBe("live");
    vi.stubEnv("PUBLIC_SITE_MODE", " LIVE ");
    expect(publicSiteMode()).toBe("live");
  });

  it("accepts waitlist explicitly", () => {
    vi.stubEnv("PUBLIC_SITE_MODE", "waitlist");
    expect(publicSiteMode()).toBe("waitlist");
  });
});

describe("servesWhileWaitlisted", () => {
  it("keeps the waitlist page and its API reachable", () => {
    expect(servesWhileWaitlisted("/waitlist")).toBe(true);
    expect(servesWhileWaitlisted("/api/waitlist")).toBe(true);
  });

  it("keeps the organiser sign-up door reachable (issue #302)", () => {
    expect(servesWhileWaitlisted("/organiser-setup")).toBe(true);
    expect(servesWhileWaitlisted("/api/organiser/setup")).toBe(true);
  });

  it("keeps the provider sign-in callbacks reachable", () => {
    expect(servesWhileWaitlisted("/auth/callback")).toBe(true);
    expect(servesWhileWaitlisted("/auth/onboarding")).toBe(true);
    expect(servesWhileWaitlisted("/auth/link/callback")).toBe(true);
  });

  it("keeps callers that cannot hold a staff session reachable", () => {
    expect(servesWhileWaitlisted("/api/stripe/webhook")).toBe(true);
    expect(servesWhileWaitlisted("/api/stripe/account-events")).toBe(true);
    expect(servesWhileWaitlisted("/api/internal/events/lifecycle")).toBe(true);
    expect(servesWhileWaitlisted("/checkin/evt-1/abc")).toBe(true);
    expect(servesWhileWaitlisted("/api/checkin")).toBe(true);
  });

  it("keeps build output and images reachable", () => {
    expect(servesWhileWaitlisted("/_next/static/chunk.js")).toBe(true);
    expect(servesWhileWaitlisted("/images/logo-title.png")).toBe(true);
  });

  it("leaves the athlete site closed", () => {
    expect(servesWhileWaitlisted("/")).toBe(false);
    expect(servesWhileWaitlisted("/events")).toBe(false);
    expect(servesWhileWaitlisted("/events/evt-1")).toBe(false);
    expect(servesWhileWaitlisted("/profile")).toBe(false);
    expect(servesWhileWaitlisted("/about")).toBe(false);
    expect(servesWhileWaitlisted("/faq")).toBe(false);
    expect(servesWhileWaitlisted("/api/events")).toBe(false);
  });

  it("matches a prefix only on a path boundary", () => {
    expect(servesWhileWaitlisted("/checkin")).toBe(true);
    expect(servesWhileWaitlisted("/checkin-notes")).toBe(false);
    expect(servesWhileWaitlisted("/organiser-setup-notes")).toBe(false);
  });

  // The organiser portal keeps its own landing page while the athlete site is
  // closed; it is on a different host, not one of these paths.
  it("does not open the organiser or admin portals on the athlete host", () => {
    expect(servesWhileWaitlisted("/organiser/dashboard")).toBe(false);
    expect(servesWhileWaitlisted("/admin/dashboard")).toBe(false);
  });
});

describe("isLegalPath", () => {
  it("names the three pages that exist on both sites", () => {
    expect(isLegalPath("/terms")).toBe(true);
    expect(isLegalPath("/privacy")).toBe(true);
    expect(isLegalPath("/cookies")).toBe(true);
  });

  it("does not match similar or nested paths", () => {
    expect(isLegalPath("/terms/")).toBe(false);
    expect(isLegalPath("/terms-of-service")).toBe(false);
    expect(isLegalPath("/events")).toBe(false);
  });
});
