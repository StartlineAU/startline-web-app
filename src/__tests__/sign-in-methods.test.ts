import { describe, expect, it } from "vitest";
import {
  identityFor,
  identitiesFromSnapshot,
  linkErrorMessage,
  mayRemoveProvider,
  parseIdentities,
  parseIdentityEntries,
  safeReturnTo,
  signInMethodsFromCognito,
} from "@/lib/sign-in-methods";
import {
  cognitoProviderName,
  socialProviderFromCognitoName,
  socialProviderLabel,
} from "@/lib/social-providers";

const google = { providerName: "Google", userId: "google-123" };
const apple = { providerName: "SignInWithApple", userId: "apple-456" };

function snapshot(userStatus: string | null, identities: unknown[]) {
  return {
    userStatus,
    attributes: [{ Name: "identities", Value: JSON.stringify(identities) }],
  };
}

describe("provider names", () => {
  it("uses Cognito's names, not Amplify's", () => {
    expect(cognitoProviderName("google")).toBe("Google");
    expect(cognitoProviderName("apple")).toBe("SignInWithApple");
    expect(socialProviderFromCognitoName("SignInWithApple")).toBe("apple");
    expect(socialProviderFromCognitoName("Apple")).toBeNull();
    expect(socialProviderLabel("apple")).toBe("Apple");
  });
});

describe("parseIdentities", () => {
  it("reads Google and Apple identities from the profile attribute", () => {
    expect(parseIdentities(JSON.stringify([google, apple]))).toEqual([
      { provider: "google", providerName: "Google", subject: "google-123" },
      { provider: "apple", providerName: "SignInWithApple", subject: "apple-456" },
    ]);
  });

  it("ignores malformed entries, unknown providers and duplicates", () => {
    const value = JSON.stringify([
      { providerName: "Facebook", userId: "fb-1" },
      { providerName: "Google" },
      google,
      { ...google, userId: "google-999" },
      "not an object",
    ]);
    expect(parseIdentities(value)).toEqual([
      { provider: "google", providerName: "Google", subject: "google-123" },
    ]);
  });

  it("accepts the id-token's already-parsed array and rejects junk", () => {
    expect(parseIdentityEntries([google])).toEqual([
      { provider: "google", providerName: "Google", subject: "google-123" },
    ]);
    expect(parseIdentityEntries("{")).toEqual([]);
    expect(parseIdentities("not json")).toEqual([]);
    expect(parseIdentities(null)).toEqual([]);
  });

  it("finds a linked identity by provider", () => {
    const identities = identitiesFromSnapshot(snapshot("CONFIRMED", [google]));
    expect(identityFor(identities, "google")?.subject).toBe("google-123");
    expect(identityFor(identities, "apple")).toBeNull();
  });
});

describe("signInMethodsFromCognito", () => {
  it("does not let a provider-only account disconnect its only identity", () => {
    const methods = signInMethodsFromCognito(snapshot("EXTERNAL_PROVIDER", [google]), ["google", "apple"]);
    expect(methods.hasPassword).toBe(false);
    expect(methods.providers).toEqual([
      { provider: "google", label: "Google", linked: true, enabled: true, canRemove: false },
      { provider: "apple", label: "Apple", linked: false, enabled: true, canRemove: false },
    ]);
    expect(mayRemoveProvider(methods, "google")).toBe(false);
  });

  it("allows a provider to go when a password remains", () => {
    const methods = signInMethodsFromCognito(snapshot("CONFIRMED", [google]), ["google", "apple"]);
    expect(methods.hasPassword).toBe(true);
    expect(mayRemoveProvider(methods, "google")).toBe(true);
  });

  it("allows either identity to go when another provider remains", () => {
    const methods = signInMethodsFromCognito(
      snapshot("EXTERNAL_PROVIDER", [google, apple]),
      ["google", "apple"],
    );
    expect(mayRemoveProvider(methods, "google")).toBe(true);
    expect(mayRemoveProvider(methods, "apple")).toBe(true);
  });

  it("keeps a linked provider visible when this deployment no longer offers it", () => {
    const methods = signInMethodsFromCognito(snapshot("CONFIRMED", [google]), []);
    const googleMethod = methods.providers.find((method) => method.provider === "google");
    expect(googleMethod).toMatchObject({ linked: true, enabled: false, canRemove: true });
  });

  it("treats a normal Cognito user as having a password", () => {
    expect(signInMethodsFromCognito(snapshot("CONFIRMED", []), []).hasPassword).toBe(true);
    expect(signInMethodsFromCognito(snapshot("FORCE_CHANGE_PASSWORD", []), []).hasPassword).toBe(true);
  });
});

describe("linkErrorMessage", () => {
  it("explains a collision, a lockout and a cancelled flow", () => {
    expect(linkErrorMessage("already-linked")).toMatch(/different Startline account/);
    expect(linkErrorMessage("last-method")).toMatch(/Connect another/);
    expect(linkErrorMessage("cancelled")).toMatch(/cancelled/);
    expect(linkErrorMessage("not-enabled")).toMatch(/not available/);
    expect(linkErrorMessage("rate-limited")).toMatch(/wait a few minutes/);
    expect(linkErrorMessage("unexpected")).toMatch(/couldn't connect/);
    expect(linkErrorMessage(null)).toBeNull();
  });
});

describe("safeReturnTo", () => {
  it("only keeps same-site page paths", () => {
    expect(safeReturnTo("/organiser/dashboard")).toBe("/organiser/dashboard");
    expect(safeReturnTo("/?tab=1")).toBe("/?tab=1");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("/auth/callback")).toBe("/");
    expect(safeReturnTo(undefined)).toBe("/");
  });
});
