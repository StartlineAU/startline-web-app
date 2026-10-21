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
    mocks.findUnique.mockResolvedValueOnce({ id: "u1", email: "a@example.com", name: "A" });

    expect(await resolveUserRow("sub-1", "a@example.com")).toEqual({ id: "u1", email: "a@example.com", name: "A" });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("adopts a row that has no sub yet, so guest and seed rows link up", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u2", cognitoSub: null });
    mocks.upsert.mockResolvedValueOnce({ id: "u2", email: "b@example.com", name: "B" });

    expect(await resolveUserRow("sub-2", "b@example.com")).toEqual({ id: "u2", email: "b@example.com", name: "B" });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "b@example.com" }, update: { cognitoSub: "sub-2" } }),
    );
  });

  it("refuses a row already bound to a different sub (account takeover)", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u3", cognitoSub: "11111111-2222-3333-4444-555555555555" });

    expect(await resolveUserRow("google_123", "victim@example.com")).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("still lets a dev bypass identity adopt its seeded row", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u4", cognitoSub: "11111111-2222-3333-4444-555555555555" });
    mocks.upsert.mockResolvedValueOnce({ id: "u4", email: "sarah.mitchell@startline.test", name: "Sarah" });

    expect(await resolveUserRow("dev-bypass-organiser", "sarah.mitchell@startline.test")).not.toBeNull();
    expect(mocks.upsert).toHaveBeenCalled();
  });

  it("creates a row when nothing matches", async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.upsert.mockResolvedValueOnce({ id: "u5", email: "new@example.com", name: null });

    expect(await resolveUserRow("sub-5", "new@example.com")).toEqual({ id: "u5", email: "new@example.com", name: null });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "new@example.com" } }),
    );
  });

  it("creates a row keyed by the sub when the session carries no email", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    mocks.create.mockResolvedValueOnce({ id: "u6", email: "sub-6", name: null });

    expect(await resolveUserRow("sub-6", "")).toEqual({ id: "u6", email: "sub-6", name: null });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { cognitoSub: "sub-6", email: "sub-6", name: undefined } }),
    );
  });
});
