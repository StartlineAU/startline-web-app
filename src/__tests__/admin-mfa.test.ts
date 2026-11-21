import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ snapshot: vi.fn() }));

vi.mock("@/lib/cognito-sign-in-methods", () => ({ getCognitoUserSnapshot: mocks.snapshot }));

async function load() {
  vi.resetModules();
  return import("@/lib/admin-mfa");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NEXT_PUBLIC_COGNITO_USER_POOL_ID", "ap-southeast-2_pool");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const ADMIN = { sub: "sub-admin", username: "admin@example.com" };

describe("adminHasAuthenticator", () => {
  it("asks Cognito whether the authenticator app is on", async () => {
    const { adminHasAuthenticator } = await load();
    mocks.snapshot.mockResolvedValue({ mfaEnabled: true });
    expect(await adminHasAuthenticator(ADMIN)).toBe(true);

    mocks.snapshot.mockResolvedValue({ mfaEnabled: false });
    expect(await adminHasAuthenticator({ ...ADMIN, sub: "other" })).toBe(false);
  });

  it("caches a yes but asks again after a no", async () => {
    const { adminHasAuthenticator } = await load();
    mocks.snapshot.mockResolvedValue({ mfaEnabled: false });
    await adminHasAuthenticator(ADMIN);
    mocks.snapshot.mockResolvedValue({ mfaEnabled: true });
    expect(await adminHasAuthenticator(ADMIN)).toBe(true);
    expect(await adminHasAuthenticator(ADMIN)).toBe(true);
    expect(mocks.snapshot).toHaveBeenCalledTimes(2);
  });

  it("refuses when Cognito cannot be asked", async () => {
    const { adminHasAuthenticator } = await load();
    mocks.snapshot.mockRejectedValue(new Error("throttled"));
    expect(await adminHasAuthenticator(ADMIN)).toBe(false);
  });

  it("refuses a session with no username to look up", async () => {
    const { adminHasAuthenticator } = await load();
    expect(await adminHasAuthenticator({ sub: "x" })).toBe(false);
  });

  it("refuses in production when no pool is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_COGNITO_USER_POOL_ID", "");
    vi.stubEnv("NODE_ENV", "production");
    const { adminHasAuthenticator } = await load();
    expect(await adminHasAuthenticator(ADMIN)).toBe(false);
  });

  it("lets a dev bypass identity through without Cognito", async () => {
    const { adminHasAuthenticator } = await load();
    expect(await adminHasAuthenticator({ ...ADMIN, bypass: "admin" })).toBe(true);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
