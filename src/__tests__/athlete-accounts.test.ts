import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  AdminGetUserCommand: class { constructor(public input: unknown) {} },
  ListUsersCommand: class { constructor(public input: unknown) {} },
  AdminCreateUserCommand: class { constructor(public input: unknown) {} },
  UsernameExistsException: class extends Error {},
}));

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class { send = mocks.send; },
  AdminCreateUserCommand: mocks.AdminCreateUserCommand,
  AdminGetUserCommand: mocks.AdminGetUserCommand,
  ListUsersCommand: mocks.ListUsersCommand,
  UsernameExistsException: mocks.UsernameExistsException,
}));

async function load() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_COGNITO_USER_POOL_ID", "ap-southeast-2_test");
  return import("@/lib/athlete-accounts");
}

function notFound() {
  return Object.assign(new Error("User does not exist."), { name: "UserNotFoundException" });
}

describe("findCognitoUserByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the email as the username for a native Cognito user", async () => {
    mocks.send.mockResolvedValue({
      Username: "user@example.com",
      UserStatus: "CONFIRMED",
    });
    const { findCognitoUserByEmail } = await load();

    await expect(findCognitoUserByEmail("user@example.com")).resolves.toEqual({
      username: "user@example.com",
      status: "CONFIRMED",
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("falls back to the email filter for a provider-generated username", async () => {
    mocks.send
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({
        Users: [{ Username: "Google_1094", UserStatus: "EXTERNAL_PROVIDER" }],
      });
    const { findCognitoUserByEmail } = await load();

    await expect(findCognitoUserByEmail("person@gmail.com")).resolves.toEqual({
      username: "Google_1094",
      status: "EXTERNAL_PROVIDER",
    });
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect((mocks.send.mock.calls[1][0] as InstanceType<typeof mocks.ListUsersCommand>).input)
      .toMatchObject({ Filter: 'email = "person@gmail.com"' });
  });

  it("returns null when neither lookup finds the address", async () => {
    mocks.send
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({ Users: [] });
    const { findCognitoUserByEmail } = await load();

    await expect(findCognitoUserByEmail("missing@example.com")).resolves.toBeNull();
  });
});

describe("ensureAthleteCognitoUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a user for a new email and returns its sub, not its username", async () => {
    mocks.send
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({ Users: [] })
      .mockResolvedValueOnce({
        User: { Username: "new@example.com", Attributes: [{ Name: "sub", Value: "sub-123" }] },
      });
    const { ensureAthleteCognitoUser } = await load();

    await expect(ensureAthleteCognitoUser("New@Example.com ")).resolves.toBe("sub-123");
  });

  it("returns null for an email that already has a native user", async () => {
    mocks.send.mockResolvedValueOnce({ Username: "taken@example.com", UserStatus: "CONFIRMED" });
    const { ensureAthleteCognitoUser } = await load();

    await expect(ensureAthleteCognitoUser("taken@example.com")).resolves.toBeNull();
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("returns null for an email held by a Google user, without creating a second user", async () => {
    mocks.send
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({ Users: [{ Username: "Google_123", UserStatus: "EXTERNAL_PROVIDER" }] });
    const { ensureAthleteCognitoUser } = await load();

    await expect(ensureAthleteCognitoUser("gmail@example.com")).resolves.toBeNull();
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it("returns null when a concurrent checkout created the user first", async () => {
    mocks.send
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({ Users: [] })
      .mockRejectedValueOnce(new mocks.UsernameExistsException("exists"));
    const { ensureAthleteCognitoUser } = await load();

    await expect(ensureAthleteCognitoUser("race@example.com")).resolves.toBeNull();
  });
});
