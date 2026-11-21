import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  blockFindFirst: vi.fn(),
  blockUpsert: vi.fn(),
  userFindMany: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    organiserBlock: { findFirst: mocks.blockFindFirst, upsert: mocks.blockUpsert },
    user: { findMany: mocks.userFindMany, findFirst: mocks.userFindFirst },
  },
}));

import {
  findOrganiserBlock,
  isBlockedByOrganiser,
  normalizeBlockEmail,
  upsertOrganiserBlock,
} from "@/lib/organiser-blocks";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blockFindFirst.mockResolvedValue(null);
  mocks.userFindMany.mockResolvedValue([]);
  mocks.userFindFirst.mockResolvedValue(null);
  mocks.blockUpsert.mockImplementation(async ({ create }) => ({ id: "blk-1", ...create }));
});

describe("findOrganiserBlock", () => {
  it("never queries for nobody", async () => {
    expect(await findOrganiserBlock("org-1", { userIds: ["", null], emails: [" ", undefined] })).toBeNull();
    expect(mocks.blockFindFirst).not.toHaveBeenCalled();
  });

  it("is scoped to the one organisation", async () => {
    await findOrganiserBlock("org-1", { emails: ["a@b.test"] });
    expect(mocks.blockFindFirst.mock.calls[0][0].where.organiserId).toBe("org-1");
  });

  it("matches the email trimmed and lowercased, as blocks are stored", async () => {
    await findOrganiserBlock("org-1", { emails: ["  Harper.Jones@Startline.TEST "] });
    expect(mocks.blockFindFirst.mock.calls[0][0].where.OR).toEqual([
      { email: { in: ["harper.jones@startline.test"] } },
    ]);
  });

  it("matches the account, and the account's own email for a block added by address", async () => {
    mocks.userFindMany.mockResolvedValue([{ email: "Harper@Startline.test" }]);

    await findOrganiserBlock("org-1", { userIds: ["user-1"], emails: ["guest@x.test"] });

    expect(mocks.blockFindFirst.mock.calls[0][0].where.OR).toEqual([
      { userId: { in: ["user-1"] } },
      { email: { in: ["guest@x.test", "harper@startline.test"] } },
    ]);
  });

  it("reports a match as blocked", async () => {
    mocks.blockFindFirst.mockResolvedValue({ id: "blk-1", email: "a@b.test" });
    expect(await isBlockedByOrganiser("org-1", { emails: ["a@b.test"] })).toBe(true);
  });

  it("reports no match as not blocked", async () => {
    expect(await isBlockedByOrganiser("org-1", { emails: ["a@b.test"] })).toBe(false);
  });
});

describe("upsertOrganiserBlock", () => {
  it("links the account found for the address", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "user-9" });

    await upsertOrganiserBlock({ organiserId: "org-1", email: " A@B.test ", createdByEmail: "owner@x.test" });

    const call = mocks.blockUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ organiserId_email: { organiserId: "org-1", email: "a@b.test" } });
    expect(call.create).toMatchObject({ email: "a@b.test", userId: "user-9", createdByEmail: "owner@x.test" });
  });

  it("does not drop an earlier account link when re-blocking by address alone", async () => {
    await upsertOrganiserBlock({ organiserId: "org-1", email: "a@b.test", createdByEmail: "owner@x.test" });
    expect(mocks.blockUpsert.mock.calls[0][0].update).toEqual({});
  });

  it("refuses an empty address", async () => {
    await expect(
      upsertOrganiserBlock({ organiserId: "org-1", email: "  ", createdByEmail: "owner@x.test" }),
    ).rejects.toThrow();
  });
});

describe("normalizeBlockEmail", () => {
  it("handles missing values", () => {
    expect(normalizeBlockEmail(null)).toBe("");
    expect(normalizeBlockEmail(" X@Y.z ")).toBe("x@y.z");
  });
});
