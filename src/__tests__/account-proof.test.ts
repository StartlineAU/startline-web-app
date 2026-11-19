import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ password: vi.fn(), authenticator: vi.fn() }));

vi.mock("@/lib/cognito-sign-in-methods", () => ({
  SignInMethodError: class SignInMethodError extends Error {
    constructor(public code: string, public status: number, message: string) { super(message); }
  },
  verifyPasswordStepUp: mocks.password,
  verifyAuthenticatorStepUp: mocks.authenticator,
}));

import { accountProofKind, requireAccountProof } from "@/lib/account-proof";

const NOW = 1_800_000_000_000;
const SESSION = { username: "user@example.com", authTime: NOW / 1000 - 3600 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.password.mockResolvedValue(undefined);
  mocks.authenticator.mockResolvedValue(undefined);
});

describe("accountProofKind", () => {
  it("asks for the strongest proof the account has", () => {
    expect(accountProofKind({ hasPassword: true, mfaRequired: true })).toBe("password-and-code");
    expect(accountProofKind({ hasPassword: true, mfaRequired: false })).toBe("password");
    expect(accountProofKind({ hasPassword: false, mfaRequired: false })).toBe("recent-sign-in");
  });
});

describe("requireAccountProof", () => {
  it("checks the password and code with an authenticator app", async () => {
    await expect(requireAccountProof(SESSION, { hasPassword: true, mfaRequired: true }, { password: "p" }, NOW))
      .rejects.toMatchObject({ code: "step-up-required" });
    await requireAccountProof(SESSION, { hasPassword: true, mfaRequired: true }, { password: "p", code: "123456" }, NOW);
    expect(mocks.authenticator).toHaveBeenCalledWith({ username: "user@example.com", password: "p", code: "123456" });
  });

  it("checks the password on a password account", async () => {
    await expect(requireAccountProof(SESSION, { hasPassword: true, mfaRequired: false }, {}, NOW))
      .rejects.toMatchObject({ code: "password-proof-required" });
    await requireAccountProof(SESSION, { hasPassword: true, mfaRequired: false }, { password: "p" }, NOW);
    expect(mocks.password).toHaveBeenCalledWith({ username: "user@example.com", password: "p" });
  });

  it("needs a recent sign-in on a provider-only account", async () => {
    const methods = { hasPassword: false, mfaRequired: false };
    await expect(requireAccountProof(SESSION, methods, {}, NOW)).rejects.toMatchObject({ code: "recent-sign-in-required" });
    await expect(requireAccountProof({ ...SESSION, authTime: NOW / 1000 - 60 }, methods, {}, NOW)).resolves.toBeUndefined();
    await expect(requireAccountProof({ username: "x" }, methods, {}, NOW)).rejects.toMatchObject({ code: "recent-sign-in-required" });
  });

  it("skips the dev bypass identities, which have no Cognito user", async () => {
    await expect(
      requireAccountProof({ bypass: "athlete" }, { hasPassword: true, mfaRequired: false }, {}, NOW),
    ).resolves.toBeUndefined();
    expect(mocks.password).not.toHaveBeenCalled();
  });
});
