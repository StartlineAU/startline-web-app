import { describe, expect, it } from "vitest";
import {
  accessTokenIsForClient,
  idTokenIsForClient,
  nativeSessionFromClaims,
} from "@/lib/native-api-auth";

const CLIENT_ID = "startline-client";

function access(overrides: Record<string, unknown> = {}) {
  return {
    token_use: "access",
    client_id: CLIENT_ID,
    sub: "user-sub",
    username: "athlete@example.com",
    "cognito:groups": ["athletes"],
    ...overrides,
  };
}

function id(overrides: Record<string, unknown> = {}) {
  return {
    token_use: "id",
    aud: CLIENT_ID,
    sub: "user-sub",
    email: "athlete@example.com",
    email_verified: "true",
    name: "Test Athlete",
    ...overrides,
  };
}

describe("native API authentication claims", () => {
  it("accepts an access token issued to this app client", () => {
    expect(accessTokenIsForClient(access(), CLIENT_ID)).toBe(true);
  });

  it("rejects tokens from another client or an ID token", () => {
    expect(accessTokenIsForClient(access({ client_id: "other" }), CLIENT_ID)).toBe(false);
    expect(accessTokenIsForClient(access({ token_use: "id" }), CLIENT_ID)).toBe(false);
  });

  it("requires the ID token to describe the same subject", () => {
    expect(idTokenIsForClient(id(), CLIENT_ID, "user-sub")).toBe(true);
    expect(idTokenIsForClient(id({ sub: "someone-else" }), CLIENT_ID, "user-sub")).toBe(false);
  });

  it("accepts an audience array containing the app client", () => {
    expect(idTokenIsForClient(id({ aud: ["other", CLIENT_ID] }), CLIENT_ID, "user-sub")).toBe(true);
  });

  it("builds a session from verified access and ID claims", () => {
    expect(nativeSessionFromClaims(access(), id(), CLIENT_ID)).toEqual({
      sub: "user-sub",
      username: "athlete@example.com",
      email: "athlete@example.com",
      groups: ["athletes"],
      phoneNumber: undefined,
      birthdate: undefined,
      name: "Test Athlete",
      emailTrusted: true,
    });
  });

  it("marks provider-issued unverified emails as untrusted", () => {
    const session = nativeSessionFromClaims(
      access(),
      id({ identities: [{ providerName: "Google" }], email_verified: "false" }),
      CLIENT_ID,
    );
    expect(session?.emailTrusted).toBe(false);
  });

  it("does not produce a session for mismatched token subjects", () => {
    expect(nativeSessionFromClaims(access(), id({ sub: "other" }), CLIENT_ID)).toBeNull();
  });

  it("drops non-string group claims", () => {
    const session = nativeSessionFromClaims(
      access({ "cognito:groups": ["admins", 7] }),
      id(),
      CLIENT_ID,
    );
    expect(session?.groups).toEqual(["admins"]);
  });

  it("allows access-token-only requests but exposes no trusted email", () => {
    const session = nativeSessionFromClaims(access(), null, CLIENT_ID);
    expect(session?.email).toBe("");
    expect(session?.emailTrusted).toBe(false);
  });
});
