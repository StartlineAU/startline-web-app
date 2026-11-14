import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  methods: vi.fn(),
  passwordStepUp: vi.fn(),
  authenticatorStepUp: vi.fn(),
  signGrant: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/session-sign-in-methods", () => ({ getSessionSignInMethods: vi.fn() }));
vi.mock("@/lib/social-providers", () => ({ enabledSocialProviders: () => ["google", "apple"] }));
vi.mock("@/lib/cognito-sign-in-methods", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cognito-sign-in-methods")>();
  return {
    SignInMethodError: actual.SignInMethodError,
    getSignInMethods: mocks.methods,
    unlinkProvider: vi.fn(),
    verifyAuthenticatorStepUp: mocks.authenticatorStepUp,
    verifyPasswordStepUp: mocks.passwordStepUp,
  };
});
vi.mock("@/lib/cognito-oauth", () => ({
  createLinkRequest: () => ({ url: "https://auth.example/authorize", state: "st", verifier: "ver" }),
  LINK_COOKIE_MAX_AGE: 600,
  LINK_COOKIES: { state: "s", verifier: "v", provider: "p", returnTo: "r", grant: "g" },
  signLinkGrant: mocks.signGrant,
}));

import { POST } from "@/app/api/user/sign-in-methods/route";
import { SignInMethodError } from "@/lib/cognito-sign-in-methods";

const now = () => Math.floor(Date.now() / 1000);

function link(body: Record<string, unknown> = {}) {
  return POST(new Request("http://localhost/api/user/sign-in-methods", {
    method: "POST",
    body: JSON.stringify({ action: "link", provider: "google", ...body }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.session.mockResolvedValue({ sub: "sub-1", username: "user@example.com", authTime: now() - 3600 });
  mocks.signGrant.mockReturnValue("grant-token");
  mocks.passwordStepUp.mockResolvedValue(undefined);
  mocks.authenticatorStepUp.mockResolvedValue(undefined);
});

describe("linking a provider needs proof beyond the session", () => {
  it("asks a password account for its password", async () => {
    mocks.methods.mockResolvedValue({ hasPassword: true, mfaRequired: false, providers: [] });

    const res = await link();

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("password-proof-required");
  });

  it("links a password account once the password checks out, with a grant", async () => {
    mocks.methods.mockResolvedValue({ hasPassword: true, mfaRequired: false, providers: [] });

    const res = await link({ password: "secret" });

    expect(res.status).toBe(200);
    expect(mocks.passwordStepUp).toHaveBeenCalledWith({ username: "user@example.com", password: "secret" });
    expect(res.headers.get("set-cookie")).toContain("g=grant-token");
  });

  it("refuses a wrong password", async () => {
    mocks.methods.mockResolvedValue({ hasPassword: true, mfaRequired: false, providers: [] });
    mocks.passwordStepUp.mockRejectedValue(new SignInMethodError("step-up-failed", 403, "nope"));

    expect((await link({ password: "wrong" })).status).toBe(403);
  });

  it("asks an account with an authenticator app for the password and a code", async () => {
    mocks.methods.mockResolvedValue({ hasPassword: true, mfaRequired: true, providers: [] });

    expect((await link({ password: "secret" })).status).toBe(400);
    expect((await link({ password: "secret", code: "123456" })).status).toBe(200);
    expect(mocks.authenticatorStepUp).toHaveBeenCalled();
  });

  it("asks a provider-only account to have signed in recently", async () => {
    mocks.methods.mockResolvedValue({ hasPassword: false, mfaRequired: false, providers: [] });

    const stale = await link();
    expect(stale.status).toBe(403);
    expect((await stale.json()).code).toBe("recent-sign-in-required");

    mocks.session.mockResolvedValue({ sub: "sub-1", username: "Google_1", authTime: now() - 60 });
    expect((await link()).status).toBe(200);
  });

  it("refuses to start without a grant to give the callback", async () => {
    mocks.methods.mockResolvedValue({ hasPassword: true, mfaRequired: false, providers: [] });
    mocks.signGrant.mockReturnValue(null);

    expect((await link({ password: "secret" })).status).toBe(501);
  });
});
