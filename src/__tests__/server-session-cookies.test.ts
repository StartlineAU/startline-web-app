import { beforeEach, describe, expect, it, vi } from "vitest";

// getServerSession's cookie path. The cookie names, LastAuthUser included, are
// chosen by the client, so identity may only come from verified tokens that
// belong to this app client and to the same subject.

const mocks = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  tokens: new Map<string, Record<string, unknown>>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (mocks.jar.has(name) ? { name, value: mocks.jar.get(name)! } : undefined),
  }),
  headers: async () => new Headers(),
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: async (token: string) => {
    const payload = mocks.tokens.get(token);
    if (!payload) throw new Error("signature verification failed");
    return { payload };
  },
}));

vi.mock("@/lib/prisma", () => ({ default: {} }));

const CLIENT_ID = "webclient";
const PREFIX = `CognitoIdentityServiceProvider.${CLIENT_ID}`;

async function loadSession() {
  vi.resetModules();
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = CLIENT_ID;
  const mod = await import("@/lib/amplify-server");
  return mod.getServerSession();
}

function signIn(lastAuthUser: string, access?: string, id?: string) {
  mocks.jar.set(`${PREFIX}.LastAuthUser`, lastAuthUser);
  if (access) mocks.jar.set(`${PREFIX}.${lastAuthUser}.accessToken`, access);
  if (id) mocks.jar.set(`${PREFIX}.${lastAuthUser}.idToken`, id);
}

const ATTACKER_ACCESS = { token_use: "access", client_id: CLIENT_ID, sub: "attacker-sub", username: "attacker-sub" };
const ATTACKER_ID = { token_use: "id", aud: CLIENT_ID, sub: "attacker-sub", email: "attacker@example.com", email_verified: "true" };
const VICTIM_ID = { token_use: "id", aud: CLIENT_ID, sub: "victim-sub", email: "victim@example.com" };

beforeEach(() => {
  mocks.jar.clear();
  mocks.tokens.clear();
  mocks.tokens.set("attacker-access", ATTACKER_ACCESS);
  mocks.tokens.set("attacker-id", ATTACKER_ID);
  mocks.tokens.set("victim-id", VICTIM_ID);
});

describe("getServerSession from Amplify cookies", () => {
  it("takes the email from the verified id token", async () => {
    signIn("attacker-sub", "attacker-access", "attacker-id");
    const session = await loadSession();
    expect(session).toMatchObject({ sub: "attacker-sub", email: "attacker@example.com", emailTrusted: true });
  });

  it("never takes the email from LastAuthUser", async () => {
    // Own valid access token filed under the victim's address, no id token.
    signIn("victim@example.com", "attacker-access");
    expect(await loadSession()).toBeNull();
  });

  it("ignores LastAuthUser even when a valid id token is present", async () => {
    signIn("victim@example.com", "attacker-access", "attacker-id");
    const session = await loadSession();
    expect(session?.email).toBe("attacker@example.com");
  });

  it("refuses another person's id token paired with your access token", async () => {
    signIn("attacker-sub", "attacker-access", "victim-id");
    expect(await loadSession()).toBeNull();
  });

  it("refuses an access token issued to a different app client", async () => {
    mocks.tokens.set("other-access", { ...ATTACKER_ACCESS, client_id: "other-client" });
    signIn("attacker-sub", "other-access", "attacker-id");
    expect(await loadSession()).toBeNull();
  });

  it("refuses an id token presented as the access token", async () => {
    signIn("attacker-sub", "attacker-id", "attacker-id");
    expect(await loadSession()).toBeNull();
  });

  it("refuses an id token that does not verify", async () => {
    signIn("attacker-sub", "attacker-access", "forged-id");
    expect(await loadSession()).toBeNull();
  });

  it("marks an unverified provider email as untrusted", async () => {
    mocks.tokens.set("google-id", {
      ...ATTACKER_ID,
      identities: [{ providerName: "Google" }],
      email_verified: "false",
    });
    signIn("attacker-sub", "attacker-access", "google-id");
    expect((await loadSession())?.emailTrusted).toBe(false);
  });
});
