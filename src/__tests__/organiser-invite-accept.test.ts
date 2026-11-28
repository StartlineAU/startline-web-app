import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  findInvite: vi.fn(),
  claim: vi.fn(),
  findMember: vi.fn(),
  countMembers: vi.fn(),
  createMember: vi.fn(),
  handOver: vi.fn(),
  dropOtherInvites: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({ getUserSession: mocks.session }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));
vi.mock("@/lib/prisma", () => {
  const tx = {
    organiserInvite: { updateMany: mocks.claim, deleteMany: mocks.dropOtherInvites },
    organiserMember: { create: mocks.createMember },
    organiser: { updateMany: mocks.handOver },
  };
  return {
    default: {
      organiserInvite: { findUnique: mocks.findInvite },
      organiserMember: { findUnique: mocks.findMember, count: mocks.countMembers },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});

import { POST } from "@/app/api/organiser/invites/accept/route";
import { hashInviteToken } from "@/lib/organiser-invites";

const INVITE = {
  id: "inv-1",
  organiserId: "org-1",
  email: "jade@example.com",
  role: "MANAGER" as const,
  acceptedAt: null,
  expiresAt: new Date(Date.now() + 86_400_000),
};

function accept(token = "tok") {
  return POST(new NextRequest("http://localhost/api/organiser/invites/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.session.mockResolvedValue({ sub: "user-1", email: "Jade@Example.com", name: "Jade" });
  mocks.findInvite.mockResolvedValue(INVITE);
  mocks.findMember.mockResolvedValue(null);
  mocks.countMembers.mockResolvedValue(0);
  mocks.claim.mockResolvedValue({ count: 1 });
  mocks.createMember.mockResolvedValue({});
  mocks.handOver.mockResolvedValue({ count: 1 });
  mocks.dropOtherInvites.mockResolvedValue({ count: 0 });
});

describe("POST /api/organiser/invites/accept", () => {
  it("makes the invited account a manager, looked up by the token's hash", async () => {
    const res = await accept("tok");
    expect(res.status).toBe(200);
    expect(mocks.findInvite).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashInviteToken("tok") } }));
    expect(mocks.createMember).toHaveBeenCalledWith({ data: { organiserId: "org-1", userId: "user-1", role: "MANAGER" } });
  });

  it("refuses another account holding the link", async () => {
    mocks.session.mockResolvedValue({ sub: "user-2", email: "someone@else.com", name: null });
    const res = await accept();
    expect(res.status).toBe(403);
    expect(mocks.createMember).not.toHaveBeenCalled();
  });

  it("needs a signed-in account", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await accept()).status).toBe(401);
  });

  it("refuses an expired or already accepted invitation", async () => {
    mocks.findInvite.mockResolvedValue({ ...INVITE, expiresAt: new Date(Date.now() - 1000) });
    expect((await accept()).status).toBe(410);
    mocks.findInvite.mockResolvedValue({ ...INVITE, acceptedAt: new Date() });
    expect((await accept()).status).toBe(410);
    expect(mocks.createMember).not.toHaveBeenCalled();
  });

  it("makes one membership when two acceptances race", async () => {
    mocks.claim.mockResolvedValue({ count: 0 });
    expect((await accept()).status).toBe(410);
    expect(mocks.createMember).not.toHaveBeenCalled();
  });

  it("respects the organisation limit per person", async () => {
    mocks.countMembers.mockResolvedValue(5);
    expect((await accept()).status).toBe(409);
  });

  it("leaves the organisation's claim alone for a manager invitation", async () => {
    await accept();
    expect(mocks.handOver).not.toHaveBeenCalled();
  });

  describe("an admin's invitation to claim an organisation", () => {
    beforeEach(() => {
      mocks.findInvite.mockResolvedValue({ ...INVITE, role: "OWNER" });
    });

    it("makes the invited account the Owner and clears the pending claim", async () => {
      const res = await accept();
      expect(res.status).toBe(200);
      expect(mocks.handOver).toHaveBeenCalledWith({
        where: { id: "org-1", pendingClaim: true, members: { none: { role: "OWNER" } } },
        data: { pendingClaim: false },
      });
      expect(mocks.createMember).toHaveBeenCalledWith({ data: { organiserId: "org-1", userId: "user-1", role: "OWNER" } });
      expect(mocks.dropOtherInvites).toHaveBeenCalledWith({
        where: { organiserId: "org-1", role: "OWNER", acceptedAt: null, id: { not: "inv-1" } },
      });
    });

    it("refuses once the organisation has been claimed", async () => {
      mocks.handOver.mockResolvedValue({ count: 0 });
      const res = await accept();
      expect(res.status).toBe(409);
      expect(mocks.createMember).not.toHaveBeenCalled();
    });

    it("still needs the invited address", async () => {
      mocks.session.mockResolvedValue({ sub: "user-2", email: "someone@else.com", name: null });
      expect((await accept()).status).toBe(403);
      expect(mocks.handOver).not.toHaveBeenCalled();
    });
  });

  it("does not exist for an unknown token", async () => {
    mocks.findInvite.mockResolvedValue(null);
    expect((await accept()).status).toBe(404);
  });
});
