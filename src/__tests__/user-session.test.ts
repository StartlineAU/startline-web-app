import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: (...args: unknown[]) => mocks.findUnique(...args),
      upsert: (...args: unknown[]) => mocks.upsert(...args),
      create: (...args: unknown[]) => mocks.create(...args),
    },
  },
}));

import { resolveUserRow } from "@/lib/user-session";

beforeEach(() => {
  mocks.findUnique.mockReset();
  mocks.upsert.mockReset();
  mocks.create.mockReset();
});

describe("resolveUserRow", () => {
  it("returns the row already bound to the sub", async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: "u1", email: "a@example.com", name: "A", isBanned: false });

    expect(await resolveUserRow({ sub: "sub-1", email: "a@example.com", emailTrusted: true })).toEqual({ id: "u1", email: "a@example.com", name: "A" });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("adopts a row that has no sub yet, so guest and seed rows link up", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u2", cognitoSub: null });
    mocks.upsert.mockResolvedValueOnce({ id: "u2", email: "b@example.com", name: "B" });

    expect(await resolveUserRow({ sub: "sub-2", email: "b@example.com", emailTrusted: true })).toEqual({ id: "u2", email: "b@example.com", name: "B" });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "b@example.com" }, update: { cognitoSub: "sub-2" } }),
    );
  });

  it("refuses a row already bound to a different sub (account takeover)", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u3", cognitoSub: "11111111-2222-3333-4444-555555555555" });

    expect(await resolveUserRow({ sub: "google_123", email: "victim@example.com", emailTrusted: true })).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("still lets a dev bypass identity adopt its seeded row", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u4", cognitoSub: "11111111-2222-3333-4444-555555555555" });
    mocks.upsert.mockResolvedValueOnce({ id: "u4", email: "sarah.mitchell@startline.test", name: "Sarah" });

    expect(await resolveUserRow({ sub: "dev-bypass-organiser", email: "sarah.mitchell@startline.test" })).not.toBeNull();
    expect(mocks.upsert).toHaveBeenCalled();
  });

  it("creates a row when nothing matches", async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.upsert.mockResolvedValueOnce({ id: "u5", email: "new@example.com", name: null });

    expect(await resolveUserRow({ sub: "sub-5", email: "new@example.com", emailTrusted: true })).toEqual({ id: "u5", email: "new@example.com", name: null });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "new@example.com" } }),
    );
  });

  it("creates a row keyed by the sub when the session carries no email", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    mocks.create.mockResolvedValueOnce({ id: "u6", email: "sub-6", name: null });

    expect(await resolveUserRow({ sub: "sub-6", email: "" })).toEqual({ id: "u6", email: "sub-6", name: null });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { cognitoSub: "sub-6", email: "sub-6", name: undefined } }),
    );
  });

  it("will not adopt a row by an unverified email", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);

    expect(await resolveUserRow({ sub: "sub-7", email: "victim@example.com", emailTrusted: false })).toBeNull();
    expect(await resolveUserRow({ sub: "sub-7", email: "victim@example.com" })).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("refuses a banned account found by sub", async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: "u8", email: "b@example.com", name: null, isBanned: true });

    expect(await resolveUserRow({ sub: "sub-8", email: "b@example.com", emailTrusted: true })).toBeNull();
  });

  it("refuses to bind a sub to a banned account found by email", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u9", cognitoSub: null, isBanned: true });

    expect(await resolveUserRow({ sub: "sub-9", email: "b@example.com", emailTrusted: true })).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
