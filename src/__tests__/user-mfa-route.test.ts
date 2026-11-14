import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  methods: vi.fn(),
  findUser: vi.fn(),
  updateUser: vi.fn(),
  stepUp: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/session-sign-in-methods", () => ({ getSessionSignInMethods: mocks.methods }));
vi.mock("@/lib/prisma", () => ({ default: { user: { findUnique: mocks.findUser, update: mocks.updateUser } } }));
vi.mock("@/lib/cognito-sign-in-methods", () => ({
  SignInMethodError: class extends Error {},
  verifyAuthenticatorStepUp: mocks.stepUp,
}));
vi.mock("@/lib/authenticator-recovery", () => ({ clearRecoveryCodes: vi.fn(), issueRecoveryCodes: vi.fn() }));
vi.mock("@/lib/cognito-user", () => ({
  cognito: { send: mocks.send },
  describeCognitoError: () => ({ status: 500, error: "x" }),
  getAccessToken: async () => "access",
}));

import { POST } from "@/app/api/user/mfa/route";

function post(body: unknown) {
  return POST(new Request("http://localhost/api/user/mfa", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUser.mockResolvedValue({ id: "user-1" });
  mocks.updateUser.mockResolvedValue({});
  mocks.stepUp.mockResolvedValue(undefined);
});

describe("POST /api/user/mfa", () => {
  it("does not let an admin turn the authenticator app off", async () => {
    mocks.session.mockResolvedValue({ sub: "s", username: "admin@example.com", groups: ["admins"] });
    mocks.methods.mockResolvedValue({ hasPassword: true, mfaRequired: true });

    const res = await post({ action: "disable", password: "pw", code: "123456" });

    expect(res.status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("records only what Cognito says on enable", async () => {
    mocks.session.mockResolvedValue({ sub: "s", username: "a@example.com", groups: [] });
    mocks.methods.mockResolvedValue({ hasPassword: true, mfaRequired: false });

    const res = await post({ action: "enable" });

    expect(await res.json()).toEqual({ ok: true, mfaEnabled: false });
    expect(mocks.updateUser).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { mfaEnabled: false } });
  });
});
