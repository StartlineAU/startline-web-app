import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockSend = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("@aws-sdk/client-cognito-identity-provider", () => {
  class Command {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  return {
    CognitoIdentityProviderClient: class {
      send = mockSend;
    },
    AdminGetUserCommand: class extends Command { readonly type = "get"; },
    AdminDeleteUserCommand: class extends Command { readonly type = "delete"; },
    AdminLinkProviderForUserCommand: class extends Command { readonly type = "link"; },
    AdminDisableProviderForUserCommand: class extends Command { readonly type = "disable"; },
  };
});

vi.mock("@/lib/prisma", () => ({
  default: { user: { findFirst: mockFindFirst } },
}));

type Module = typeof import("@/lib/cognito-sign-in-methods");
let mod: Module;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_COGNITO_USER_POOL_ID", "ap-southeast-2_test");
  vi.stubEnv("NEXT_PUBLIC_AWS_REGION", "ap-southeast-2");
  vi.resetModules();
  mod = await import("@/lib/cognito-sign-in-methods");
});

beforeEach(() => {
  mockSend.mockReset();
  mockFindFirst.mockReset();
  mockFindFirst.mockResolvedValue(null);
});

const google = { providerName: "Google", userId: "google-123" };

function user(status: string, identities: unknown[]) {
  return {
    Username: "someone",
    UserStatus: status,
    UserAttributes: [{ Name: "identities", Value: JSON.stringify(identities) }],
  };
}

function commandTypes() {
  return mockSend.mock.calls.map(([command]) => command.type);
}

describe("unlinkProvider", () => {
  it("refuses to remove the last sign-in method without calling Cognito", async () => {
    mockSend.mockResolvedValueOnce(user("EXTERNAL_PROVIDER", [google]));

    await expect(mod.unlinkProvider({
      username: "someone",
      provider: "google",
      enabledProviders: ["google", "apple"],
    })).rejects.toMatchObject({ code: "last-method", status: 409 });

    expect(commandTypes()).toEqual(["get"]);
  });

  it("disables the provider when a password remains and returns the new state", async () => {
    mockSend
      .mockResolvedValueOnce(user("CONFIRMED", [google]))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(user("CONFIRMED", []));

    const methods = await mod.unlinkProvider({
      username: "someone",
      provider: "google",
      enabledProviders: ["google"],
    });

    expect(commandTypes()).toEqual(["get", "disable", "get"]);
    expect(mockSend.mock.calls[1][0].input).toEqual({
      UserPoolId: "ap-southeast-2_test",
      User: {
        ProviderName: "Google",
        ProviderAttributeName: "Cognito_Subject",
        ProviderAttributeValue: "google-123",
      },
    });
    expect(methods.providers.find((method) => method.provider === "google")?.linked).toBe(false);
  });
});

describe("completeProviderLink", () => {
  const base = {
    currentUsername: "someone",
    currentSub: "current-sub",
    provider: "google" as const,
    providerSubject: "google-123",
    resultUsername: "Google_google-123",
    resultSub: "result-sub",
    resultEmail: "person@example.com",
    enabledProviders: ["google" as const],
  };

  it("deletes the throwaway provider profile and links its identity to the account", async () => {
    mockSend
      .mockResolvedValueOnce(user("CONFIRMED", []))
      .mockResolvedValueOnce(user("EXTERNAL_PROVIDER", [google]))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(user("CONFIRMED", [google]));

    const methods = await mod.completeProviderLink(base);

    expect(commandTypes()).toEqual(["get", "get", "delete", "link", "get"]);
    expect(mockSend.mock.calls[2][0].input).toEqual({
      UserPoolId: "ap-southeast-2_test",
      Username: "Google_google-123",
    });
    expect(mockSend.mock.calls[3][0].input).toEqual({
      UserPoolId: "ap-southeast-2_test",
      DestinationUser: { ProviderName: "Cognito", ProviderAttributeValue: "someone" },
      SourceUser: {
        ProviderName: "Google",
        ProviderAttributeName: "Cognito_Subject",
        ProviderAttributeValue: "google-123",
      },
    });
    expect(methods.providers.find((method) => method.provider === "google")?.linked).toBe(true);
  });

  it("refuses an identity that already belongs to a local account", async () => {
    mockSend
      .mockResolvedValueOnce(user("CONFIRMED", []))
      .mockResolvedValueOnce(user("CONFIRMED", [google]));

    await expect(mod.completeProviderLink(base)).rejects.toMatchObject({
      code: "already-linked",
      status: 409,
    });
    expect(commandTypes()).toEqual(["get", "get"]);
  });

  it("refuses when a Startline user already points at the provider profile", async () => {
    mockSend
      .mockResolvedValueOnce(user("CONFIRMED", []))
      .mockResolvedValueOnce(user("EXTERNAL_PROVIDER", [google]));
    mockFindFirst.mockResolvedValue({ cognitoSub: "other-sub" });

    await expect(mod.completeProviderLink(base)).rejects.toMatchObject({ code: "already-linked" });
    expect(commandTypes()).toEqual(["get", "get"]);
  });

  it("does nothing when the provider is already linked to this account", async () => {
    mockSend.mockResolvedValueOnce(user("CONFIRMED", [google]));

    await mod.completeProviderLink(base);

    expect(commandTypes()).toEqual(["get"]);
  });

  it("treats a flow the pre sign-up trigger linked as already done", async () => {
    mockSend
      .mockResolvedValueOnce(user("CONFIRMED", []))
      .mockResolvedValueOnce(user("CONFIRMED", [google]));

    await mod.completeProviderLink({ ...base, resultSub: "current-sub" });

    expect(commandTypes()).toEqual(["get", "get"]);
  });

  it("does not report success when the re-read shows no link", async () => {
    mockSend
      .mockResolvedValueOnce(user("CONFIRMED", []))
      .mockResolvedValueOnce(user("CONFIRMED", []));

    await expect(mod.completeProviderLink({ ...base, resultSub: "current-sub" }))
      .rejects.toMatchObject({ code: "failed" });
  });
});
