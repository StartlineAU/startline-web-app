import { describe, expect, it } from "vitest";
import { simulatedSignInMethods } from "@/lib/e2e-sign-in-methods";
import {
  canChangeEmail,
  canUseMfa,
  linkedProviders,
  signInMethodsFromCognito,
  type CognitoUserSnapshot,
} from "@/lib/sign-in-methods";

function snapshot(userStatus: string, identities: unknown[] = []): CognitoUserSnapshot {
  return {
    userStatus,
    attributes: identities.length
      ? [{ Name: "identities", Value: JSON.stringify(identities) }]
      : [],
  };
}

const google = { providerName: "Google", userId: "google-1" };
const apple = { providerName: "SignInWithApple", userId: "apple-1" };

describe("login security rules", () => {
  it("allows an email change only with a password and no linked providers", () => {
    expect(canChangeEmail(signInMethodsFromCognito(snapshot("CONFIRMED"), ["google", "apple"]))).toBe(true);
    expect(canChangeEmail(signInMethodsFromCognito(snapshot("CONFIRMED", [google]), ["google", "apple"]))).toBe(false);
    expect(canChangeEmail(signInMethodsFromCognito(snapshot("EXTERNAL_PROVIDER", [google]), ["google", "apple"]))).toBe(false);
  });

  it("allows TOTP only once there is a password", () => {
    expect(canUseMfa(signInMethodsFromCognito(snapshot("CONFIRMED", [google]), ["google", "apple"]))).toBe(true);
    expect(canUseMfa(signInMethodsFromCognito(snapshot("EXTERNAL_PROVIDER", [google]), ["google", "apple"]))).toBe(false);
  });

  it("lists only the providers that are linked", () => {
    const methods = signInMethodsFromCognito(snapshot("CONFIRMED", [google]), ["google", "apple"]);
    expect(linkedProviders(methods)).toEqual(["google"]);
    expect(linkedProviders(signInMethodsFromCognito(snapshot("CONFIRMED"), ["google", "apple"]))).toEqual([]);
  });
});

describe("simulatedSignInMethods", () => {
  it("models provider-only, Apple-only and linked accounts", () => {
    const social = simulatedSignInMethods("social", ["google", "apple"]);
    expect(social.hasPassword).toBe(false);
    expect(linkedProviders(social)).toEqual(["google"]);

    const appleOnly = simulatedSignInMethods("apple", ["google", "apple"]);
    expect(appleOnly.hasPassword).toBe(false);
    expect(linkedProviders(appleOnly)).toEqual(["apple"]);

    const linked = simulatedSignInMethods("linked", ["google", "apple"]);
    expect(linked.hasPassword).toBe(true);
    expect(linkedProviders(linked)).toEqual(["google"]);

    const passwordOnly = simulatedSignInMethods("athlete", ["google", "apple"]);
    expect(passwordOnly.hasPassword).toBe(true);
    expect(linkedProviders(passwordOnly)).toEqual([]);
  });

  it("marks a provider-only disconnect as unavailable", () => {
    const methods = simulatedSignInMethods("social", ["google", "apple"]);
    const googleMethod = methods.providers.find((method) => method.provider === "google");
    expect(googleMethod?.canRemove).toBe(false);
  });
});
