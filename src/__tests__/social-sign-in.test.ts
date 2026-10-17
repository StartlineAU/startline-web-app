import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("aws-amplify/auth", () => ({ signInWithRedirect: vi.fn() }));

import {
  claimSocialRetry,
  enabledSocialProviders,
  isLinkedAccountRetry,
  socialSignInErrorMessage,
  takeSocialReturnTo,
} from "@/lib/social-sign-in";

// Node has no sessionStorage; a Map-backed stand-in is enough.
const store = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

beforeEach(() => store.clear());

describe("takeSocialReturnTo", () => {
  it.each([
    ["/events/abc?tab=1", "/events/abc?tab=1"],
    ["//evil.example/path", "/"],
    ["https://evil.example", "/"],
    ["/auth/callback?error=x", "/"],
  ])("%s -> %s", (stored, expected) => {
    store.set("startline_social_return_to", stored);
    expect(takeSocialReturnTo()).toBe(expected);
  });

  it("falls back to the home page and clears the flow's keys", () => {
    store.set("startline_social_provider", "google");
    store.set("startline_social_retried", "1");
    expect(takeSocialReturnTo()).toBe("/");
    expect(store.size).toBe(0);
  });
});

describe("claimSocialRetry", () => {
  it("allows exactly one retry for the stored provider", () => {
    store.set("startline_social_provider", "apple");
    expect(claimSocialRetry()).toBe("apple");
    expect(claimSocialRetry()).toBeNull();
  });

  it("refuses an unknown provider", () => {
    store.set("startline_social_provider", "facebook");
    expect(claimSocialRetry()).toBeNull();
  });
});

describe("socialSignInErrorMessage", () => {
  it("maps the pre sign-up trigger's codes", () => {
    expect(socialSignInErrorMessage("invalid_request PreSignUp failed with error STARTLINE_MFA_ACCOUNT.")).toMatch(/authenticator app/);
    expect(socialSignInErrorMessage("PreSignUp failed with error STARTLINE_FEDERATED_ACCOUNT.")).toMatch(/already signs in with Google or Apple/);
    expect(socialSignInErrorMessage("access_denied")).toBe("Sign-in was cancelled.");
    expect(socialSignInErrorMessage("server_error boom")).toBe("We couldn't sign you in. Please try again.");
  });

  it("recognises Cognito's reply to a just-linked account", () => {
    expect(isLinkedAccountRetry("invalid_request Already found an entry for username google_123")).toBe(true);
    expect(isLinkedAccountRetry("access_denied")).toBe(false);
  });
});

describe("enabledSocialProviders", () => {
  it("is empty without a Cognito domain, whatever the list says", () => {
    vi.stubEnv("NEXT_PUBLIC_COGNITO_DOMAIN", "");
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_SIGN_IN", "google,apple");
    expect(enabledSocialProviders()).toEqual([]);
  });

  it("keeps only known providers", () => {
    vi.stubEnv("NEXT_PUBLIC_COGNITO_DOMAIN", "sl-staging.auth.ap-southeast-2.amazoncognito.com");
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_SIGN_IN", " google , facebook,apple");
    expect(enabledSocialProviders()).toEqual(["google", "apple"]);
  });
});
