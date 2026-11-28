import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  adminSession: vi.fn(),
  findOrganiser: vi.fn(),
  findOrganiserById: vi.fn(),
  createOrganiser: vi.fn(),
  dropInvites: vi.fn(),
  createInvite: vi.fn(),
  sendClaimEmail: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({ getAdminSession: mocks.adminSession }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.audit }));
vi.mock("@/lib/email", () => ({ sendOrganiserClaimEmail: mocks.sendClaimEmail }));
vi.mock("@/lib/prisma", () => {
  const tx = {
    organiserInvite: { deleteMany: mocks.dropInvites, create: mocks.createInvite },
  };
  return {
    default: {
      organiser: {
        findFirst: mocks.findOrganiser,
        findUnique: mocks.findOrganiserById,
        create: mocks.createOrganiser,
      },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});

import {
  CLAIM_INVITE_TTL_DAYS,
  claimInviteExpiry,
  issueClaimInvite,
  setupEmailConflict,
} from "@/lib/organiser-claim";
import { POST as createOrganiser } from "@/app/api/admin/organisers/route";
import { POST as sendClaimInvite } from "@/app/api/admin/organisers/[id]/claim-invite/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.adminSession.mockResolvedValue({ sub: "admin-1", email: "admin@startline.test" });
  mocks.findOrganiser.mockResolvedValue(null);
  mocks.createOrganiser.mockImplementation(async ({ data }) => ({ id: "org-1", orgName: data.orgName, email: data.email }));
  mocks.dropInvites.mockResolvedValue({ count: 0 });
  mocks.createInvite.mockImplementation(async ({ data }) => ({
    id: "inv-1", email: data.email, createdAt: new Date(), expiresAt: data.expiresAt,
  }));
  mocks.sendClaimEmail.mockResolvedValue(undefined);
});

describe("claim rules", () => {
  it("lasts two weeks", () => {
    const now = new Date("2026-11-28T00:00:00Z");
    expect(claimInviteExpiry(now).getTime() - now.getTime()).toBe(CLAIM_INVITE_TTL_DAYS * 86_400_000);
  });

  it("offers the claim only for an organisation nobody owns yet", () => {
    expect(setupEmailConflict(null)).toBe("none");
    expect(setupEmailConflict({ pendingClaim: true })).toBe("claim");
    expect(setupEmailConflict({ pendingClaim: false })).toBe("taken");
  });
});

describe("issueClaimInvite", () => {
  it("replaces earlier claim links with one OWNER invitation and emails it", async () => {
    const { invite, inviteUrl } = await issueClaimInvite({
      organiserId: "org-1", organisationName: "River Runners", email: " Owner@Example.com ",
    });
    expect(mocks.dropInvites).toHaveBeenCalledWith({ where: { organiserId: "org-1", role: "OWNER", acceptedAt: null } });
    expect(mocks.createInvite).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organiserId: "org-1", email: "owner@example.com", role: "OWNER", invitedById: null }),
    }));
    expect(invite.email).toBe("owner@example.com");
    expect(inviteUrl).toContain("/organiser/invite?token=");
    expect(mocks.sendClaimEmail).toHaveBeenCalledWith("owner@example.com", expect.objectContaining({
      organisationName: "River Runners", inviteUrl,
    }));
  });

  it("still returns the link when the email fails", async () => {
    mocks.sendClaimEmail.mockRejectedValue(new Error("down"));
    const { inviteUrl } = await issueClaimInvite({ organiserId: "org-1", organisationName: null, email: "a@b.com" });
    expect(inviteUrl).toContain("token=");
  });
});

function post(url: string, body: unknown) {
  return new NextRequest(url, { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/admin/organisers", () => {
  const create = (body: unknown) => createOrganiser(post("http://localhost/api/admin/organisers", body));

  it("is admin only", async () => {
    mocks.adminSession.mockResolvedValue(null);
    expect((await create({ orgName: "X", email: "x@example.com" })).status).toBe(401);
  });

  it("creates an unowned, verified organisation waiting to be claimed", async () => {
    const res = await create({ orgName: "River Runners", email: "Owner@Example.com" });
    expect(res.status).toBe(201);
    expect(mocks.createOrganiser).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orgName: "River Runners", email: "owner@example.com", contactEmail: "owner@example.com",
        verified: true, pendingClaim: true,
      }),
    }));
    expect(mocks.createInvite).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATE_ORGANISER" }));
  });

  it("sends the claim invitation when asked", async () => {
    const res = await create({ orgName: "River Runners", email: "owner@example.com", sendInvite: true });
    expect(res.status).toBe(201);
    expect((await res.json()).inviteUrl).toContain("token=");
    expect(mocks.createInvite).toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "SEND_CLAIM_INVITE" }));
  });

  it("refuses an email another organisation already uses", async () => {
    mocks.findOrganiser.mockResolvedValue({ id: "org-0" });
    expect((await create({ orgName: "River Runners", email: "owner@example.com" })).status).toBe(409);
    expect(mocks.createOrganiser).not.toHaveBeenCalled();
  });

  it("refuses a malformed ABN or email", async () => {
    expect((await create({ orgName: "River Runners", email: "owner@example.com", abn: "123" })).status).toBe(400);
    expect((await create({ orgName: "River Runners", email: "nope" })).status).toBe(400);
    expect(mocks.createOrganiser).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/organisers/[id]/claim-invite", () => {
  const send = (body: unknown = {}) =>
    sendClaimInvite(post("http://localhost/api/admin/organisers/org-1/claim-invite", body), {
      params: Promise.resolve({ id: "org-1" }),
    });

  it("sends to the organisation's email by default", async () => {
    mocks.findOrganiserById.mockResolvedValue({ id: "org-1", orgName: "River Runners", email: "owner@example.com", pendingClaim: true });
    const res = await send();
    expect(res.status).toBe(201);
    expect(mocks.sendClaimEmail).toHaveBeenCalledWith("owner@example.com", expect.anything());
  });

  it("can send to another address", async () => {
    mocks.findOrganiserById.mockResolvedValue({ id: "org-1", orgName: "River Runners", email: "owner@example.com", pendingClaim: true });
    await send({ email: "director@example.com" });
    expect(mocks.sendClaimEmail).toHaveBeenCalledWith("director@example.com", expect.anything());
  });

  it("refuses once the organisation has an Owner", async () => {
    mocks.findOrganiserById.mockResolvedValue({ id: "org-1", orgName: "River Runners", email: "owner@example.com", pendingClaim: false });
    expect((await send()).status).toBe(409);
    expect(mocks.createInvite).not.toHaveBeenCalled();
  });
});
