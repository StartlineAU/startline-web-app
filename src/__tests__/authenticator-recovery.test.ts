import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashRecoveryCode } from "@/lib/recovery-codes";

const mockSend = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdateMany = vi.fn();
const mockUserUpdate = vi.fn();

vi.mock("@aws-sdk/client-cognito-identity-provider", () => {
  class Command {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  return {
    CognitoIdentityProviderClient: class {
      send = mockSend;
    },
    AdminInitiateAuthCommand: class extends Command { readonly type = "initiate"; },
    AdminSetUserMFAPreferenceCommand: class extends Command { readonly type = "mfa"; },
  };
});

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: mockFindUnique, update: mockUserUpdate },
    recoveryCode: { updateMany: mockUpdateMany },
  },
}));

type Module = typeof import("@/lib/authenticator-recovery");
let mod: Module;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_COGNITO_USER_POOL_ID", "ap-southeast-2_test");
  vi.stubEnv("NEXT_PUBLIC_COGNITO_LINK_CLIENT_ID", "link-client");
  vi.resetModules();
  mod = await import("@/lib/authenticator-recovery");
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockUserUpdate.mockResolvedValue({});
});

const code = "ABCDE-FGHJK";
const input = { email: "Person@Example.com", password: "Password123!", code };

function challenge() {
  return { ChallengeName: "SOFTWARE_TOKEN_MFA", Session: "session-1" };
}

function userWith(codes: string[]) {
  return {
    id: "user-1",
    recoveryCodeRows: codes.map((hash, index) => ({ id: `code-${index}`, codeHash: hash })),
  };
}

describe("resetAuthenticatorWithRecoveryCode", () => {
  it("spends a matching code and turns the authenticator app off", async () => {
    mockSend.mockResolvedValueOnce(challenge()).mockResolvedValueOnce({});
    mockFindUnique.mockResolvedValue(userWith([hashRecoveryCode("ZZZZZ-ZZZZZ"), hashRecoveryCode(code)]));

    await expect(mod.resetAuthenticatorWithRecoveryCode(input)).resolves.toEqual({ kind: "reset" });

    expect(mockSend.mock.calls[0][0].input).toMatchObject({
      ClientId: "link-client",
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "person@example.com", PASSWORD: "Password123!" },
    });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "code-1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(mockSend.mock.calls[1][0].input).toEqual({
      UserPoolId: "ap-southeast-2_test",
      Username: "person@example.com",
      SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { mfaEnabled: false },
    });
  });

  it("refuses a wrong password before looking at any code", async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error("Incorrect"), { name: "NotAuthorizedException" }));

    await expect(mod.resetAuthenticatorWithRecoveryCode(input)).resolves.toEqual({ kind: "bad-credentials" });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("refuses a wrong code and leaves it unused", async () => {
    mockSend.mockResolvedValueOnce(challenge());
    mockFindUnique.mockResolvedValue(userWith([hashRecoveryCode(code)]));

    await expect(mod.resetAuthenticatorWithRecoveryCode({ ...input, code: "ZZZZZ-ZZZZZ" }))
      .resolves.toEqual({ kind: "bad-code" });
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("refuses a code another request already spent", async () => {
    mockSend.mockResolvedValueOnce(challenge());
    mockFindUnique.mockResolvedValue(userWith([hashRecoveryCode(code)]));
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(mod.resetAuthenticatorWithRecoveryCode(input)).resolves.toEqual({ kind: "bad-code" });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("says so when there are no codes left", async () => {
    mockSend.mockResolvedValueOnce(challenge());
    mockFindUnique.mockResolvedValue(userWith([]));

    await expect(mod.resetAuthenticatorWithRecoveryCode(input)).resolves.toEqual({ kind: "no-codes" });
  });

  it("treats an account without an authenticator challenge as bad credentials", async () => {
    mockSend.mockResolvedValueOnce({ ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "session-1" });

    await expect(mod.resetAuthenticatorWithRecoveryCode(input)).resolves.toEqual({ kind: "bad-credentials" });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
