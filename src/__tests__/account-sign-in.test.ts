import { describe, it, expect } from "vitest";
import {
  canChangeEmail,
  canUnlinkProvider,
  canUseMfa,
  parseIdentities,
  providerListLabel,
  simulatedSignInState,
} from "@/lib/account-sign-in-shared";

const google = JSON.stringify([
  { userId: "google-1", providerName: "Google", providerType: "Google", primary: "true" },
]);
const apple = JSON.stringify([
  { userId: "apple-1", providerName: "SignInWithApple", providerType: "SignInWithApple", primary: "true" },
]);

describe("parseIdentities", () => {
  it("reads Google and Apple identities from Cognito's attribute", () => {
    expect(parseIdentities(google)).toEqual([
      { provider: "google", providerName: "Google", userId: "google-1" },
    ]);
    expect(parseIdentities(apple)).toEqual([
      { provider: "apple", providerName: "SignInWithApple", userId: "apple-1" },
    ]);
  });

  it("ignores missing, malformed and unknown providers", () => {
    expect(parseIdentities(undefined)).toEqual([]);
    expect(parseIdentities("not json")).toEqual([]);
    expect(parseIdentities("{}")).toEqual([]);
    expect(parseIdentities(JSON.stringify([{ providerName: "Facebook", userId: "fb-1" }]))).toEqual([]);
    expect(parseIdentities(JSON.stringify([{ providerName: "Google" }]))).toEqual([]);
  });

  it("drops duplicate provider identities", () => {
    const duplicate = JSON.stringify([
      { userId: "google-1", providerName: "Google" },
      { userId: "google-1", providerName: "Google" },
    ]);
    expect(parseIdentities(duplicate)).toHaveLength(1);
  });
});

describe("providerListLabel", () => {
  it("names one provider and joins two", () => {
    expect(providerListLabel([])).toBe("");
    expect(providerListLabel(["google"])).toBe("Google");
    expect(providerListLabel(["apple"])).toBe("Apple");
    expect(providerListLabel(["google", "apple"])).toBe("Google and Apple");
  });
});

describe("sign-in rules", () => {
  const providerOnly = { hasPassword: false, identities: [{ provider: "google" as const, providerName: "Google", userId: "g" }] };
  const linked = { hasPassword: true, identities: [{ provider: "google" as const, providerName: "Google", userId: "g" }] };
  const passwordOnly = { hasPassword: true, identities: [] };

  it("only allows an email change once every provider is unlinked", () => {
    expect(canChangeEmail(providerOnly)).toBe(false);
    expect(canChangeEmail(linked)).toBe(false);
    expect(canChangeEmail(passwordOnly)).toBe(true);
  });

  it("only offers TOTP once there is a password", () => {
    expect(canUseMfa(providerOnly)).toBe(false);
    expect(canUseMfa(linked)).toBe(true);
    expect(canUseMfa(passwordOnly)).toBe(true);
  });

  it("only unlinks a provider after a password exists", () => {
    expect(canUnlinkProvider(providerOnly, "google")).toBe(false);
    expect(canUnlinkProvider(linked, "google")).toBe(true);
    expect(canUnlinkProvider(linked, "apple")).toBe(false);
  });
});

describe("simulatedSignInState", () => {
  it("models the E2E identities", () => {
    expect(simulatedSignInState("social")).toMatchObject({ hasPassword: false });
    expect(simulatedSignInState("social").identities[0].provider).toBe("google");
    expect(simulatedSignInState("apple").identities[0].provider).toBe("apple");
    expect(simulatedSignInState("linked")).toMatchObject({ hasPassword: true });
    expect(simulatedSignInState("athlete")).toEqual({ hasPassword: true, identities: [] });
  });
});
