import { describe, it, expect, vi, afterEach } from "vitest";
import nextConfig from "../../next.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function contentSecurityPolicy(): Promise<string> {
  const rules = await nextConfig.headers!();
  const csp = rules[0].headers.find((header) => header.key === "Content-Security-Policy");
  if (!csp) throw new Error("Content-Security-Policy header is missing");
  return csp.value;
}

describe("Cognito in the Content-Security-Policy", () => {
  it("allows the configured custom domain", async () => {
    vi.stubEnv("NEXT_PUBLIC_COGNITO_DOMAIN", "auth-staging.startlineau.com");

    const csp = await contentSecurityPolicy();

    expect(csp).toContain("https://auth-staging.startlineau.com");
    // The prefix fallback stays allowed for the e2e suite and any pool still
    // on the old host.
    expect(csp).toContain("https://*.auth.ap-southeast-2.amazoncognito.com");
  });

  it("does not add an empty host when the domain is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_COGNITO_DOMAIN", "");

    expect(await contentSecurityPolicy()).not.toContain("https:// ");
  });
});

describe("Cloudflare Turnstile in the Content-Security-Policy", () => {
  it("allows the widget script, frame and network requests", async () => {
    const csp = await contentSecurityPolicy();

    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://api.mapbox.com https://challenges.cloudflare.com",
    );
    expect(csp).toContain(
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    );
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("https://challenges.cloudflare.com");
  });
});

describe("framing and baseline security headers", () => {
  async function headers(): Promise<Map<string, string>> {
    const rules = await nextConfig.headers!();
    return new Map(rules[0].headers.map((header) => [header.key, header.value]));
  }

  it("refuses to be framed, so no page can be overlaid to trick a click", async () => {
    const all = await headers();
    expect(all.get("X-Frame-Options")).toBe("DENY");
    expect(all.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("locks down the fallback, plugins, base URL and form targets", async () => {
    const csp = (await headers()).get("Content-Security-Policy")!;
    for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
      expect(csp).toContain(directive);
    }
  });

  it("sends nosniff, a referrer policy and a permissions policy", async () => {
    const all = await headers();
    expect(all.get("X-Content-Type-Options")).toBe("nosniff");
    expect(all.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(all.get("Permissions-Policy")).toContain("microphone=()");
  });

  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
