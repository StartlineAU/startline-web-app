import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// #570: the organiser decides, Startline issues. These cover the two PATCH
// routes; the rules themselves are in refund-ticket-rules.test.ts.

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  requireOrganiser: vi.fn(),
  supportTicket: { findUnique: vi.fn(), updateMany: vi.fn() },
  organiser: { findUnique: vi.fn() },
  notification: { create: vi.fn() },
  writeAuditLog: vi.fn(),
  sendRefundOverrideEmails: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({ getAdminSession: mocks.getAdminSession }));
vi.mock("@/lib/organiser-api-auth", () => ({ requireOrganiser: mocks.requireOrganiser }));
vi.mock("@/lib/prisma", () => ({
  default: {
    supportTicket: mocks.supportTicket,
    organiser: mocks.organiser,
    notification: mocks.notification,
  },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/email", () => ({ sendRefundOverrideEmails: mocks.sendRefundOverrideEmails }));

import { PATCH as adminPatch } from "@/app/api/admin/refund-requests/[id]/route";
import { PATCH as organiserPatch } from "@/app/api/organiser/refund-requests/[id]/route";

const ID = "6f1d2c1e-8a8b-4c3e-9d1e-1a2b3c4d5e6f";
// Long enough ago that the organiser's three business days have passed.
const OLD = new Date("2026-01-05T00:00:00.000Z");

const ticket = (over: Record<string, unknown> = {}) => ({
  id: ID,
  status: "OPEN",
  organiserDecision: null,
  createdAt: OLD,
  eventName: "Harbour 10K",
  name: "Harper Jones",
  organiserId: "org-1",
  eventId: "evt-1",
  ...over,
});

type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

const call = (handler: Handler, body: unknown) =>
  handler(
    new NextRequest(`http://localhost/api/x/refund-requests/${ID}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: ID }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminSession.mockResolvedValue({ sub: "admin-1" });
  mocks.requireOrganiser.mockResolvedValue({ session: { sub: "org-1", role: "OWNER" } });
  mocks.supportTicket.updateMany.mockResolvedValue({ count: 1 });
  mocks.organiser.findUnique.mockResolvedValue({
    id: "org-1",
    email: "owner@apex.test",
    contactEmail: null,
    notifyManagers: false,
    members: [],
  });
  mocks.notification.create.mockResolvedValue({});
  mocks.sendRefundOverrideEmails.mockResolvedValue(1);
});

describe("organiser PATCH", () => {
  it("records the organiser's decision in its own fields", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    const res = await call(organiserPatch, { action: "approve", note: " fine " });
    expect(res.status).toBe(200);
    expect(mocks.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { id: ID, status: "OPEN" },
      data: expect.objectContaining({
        status: "APPROVED",
        organiserDecision: "APPROVED",
        organiserDecidedById: "org-1",
        organiserNote: "fine",
      }),
    });
  });

  it("refuses a ticket that is no longer open", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "APPROVED" }));
    const res = await call(organiserPatch, { action: "decline" });
    expect(res.status).toBe(409);
    expect(mocks.supportTicket.updateMany).not.toHaveBeenCalled();
  });

  it("loses a race with an admin decision cleanly", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    mocks.supportTicket.updateMany.mockResolvedValue({ count: 0 });
    const res = await call(organiserPatch, { action: "decline" });
    expect(res.status).toBe(409);
  });

  it("hides another organisation's ticket", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ organiserId: "org-2" }));
    const res = await call(organiserPatch, { action: "approve" });
    expect(res.status).toBe(404);
  });

  it("passes through an auth failure", async () => {
    mocks.requireOrganiser.mockResolvedValue({ error: NextResponse.json({}, { status: 401 }) });
    const res = await call(organiserPatch, { action: "approve" });
    expect(res.status).toBe(401);
  });
});

describe("admin PATCH", () => {
  it("refuses to overwrite an organiser's decision without an override", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "DECLINED", organiserDecision: "DECLINED" }));
    const res = await call(adminPatch, { action: "approve" });
    expect(res.status).toBe(409);
    expect(mocks.supportTicket.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("refuses an override with no note", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "DECLINED", organiserDecision: "DECLINED" }));
    const res = await call(adminPatch, { action: "approve", override: true });
    expect(res.status).toBe(400);
  });

  it("overrides with a note: keeps the organiser's decision, audits, and notifies", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "DECLINED", organiserDecision: "DECLINED" }));
    const res = await call(adminPatch, { action: "approve", override: true, note: "Date moved a week." });
    expect(res.status).toBe(200);

    const write = mocks.supportTicket.updateMany.mock.calls[0][0];
    expect(write.where).toEqual({ id: ID, status: "DECLINED" });
    expect(write.data).toMatchObject({
      status: "APPROVED",
      adminDecisionKind: "OVERRIDE",
      adminDecidedById: "admin-1",
      adminNote: "Date moved a week.",
    });
    // The organiser's own decision is never touched.
    expect(write.data).not.toHaveProperty("organiserDecision");

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "REFUND_TICKET_OVERRIDE",
      targetType: "support_ticket",
      targetId: ID,
      meta: expect.objectContaining({ previousStatus: "DECLINED", organiserDecision: "DECLINED", note: "Date moved a week." }),
    }));
    expect(mocks.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organiserId: "org-1", type: "REFUND_TICKET_OVERRIDE" }),
    });
    expect(mocks.sendRefundOverrideEmails).toHaveBeenCalledWith(
      ["owner@apex.test"],
      expect.objectContaining({ organiserDecision: "declined", decision: "approved", note: "Date moved a week." }),
    );
  });

  it("decides an open ticket once the organiser's window has passed, without notifying", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    const res = await call(adminPatch, { action: "decline" });
    expect(res.status).toBe(200);
    expect(mocks.supportTicket.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "DECLINED",
      adminDecisionKind: "NO_RESPONSE",
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "REFUND_TICKET_NO_RESPONSE_DECLINED",
    }));
    expect(mocks.sendRefundOverrideEmails).not.toHaveBeenCalled();
  });

  it("refuses a plain decision while the organiser still has time", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ createdAt: new Date() }));
    const res = await call(adminPatch, { action: "approve" });
    expect(res.status).toBe(409);
  });

  it("marks an approved ticket refunded without touching the decision fields", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "APPROVED", organiserDecision: "APPROVED" }));
    const res = await call(adminPatch, { action: "refunded" });
    expect(res.status).toBe(200);
    expect(mocks.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { id: ID, status: "APPROVED" },
      data: { status: "REFUNDED" },
    });
  });

  it("reports a decision that landed in between", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    mocks.supportTicket.updateMany.mockResolvedValue({ count: 0 });
    const res = await call(adminPatch, { action: "approve" });
    expect(res.status).toBe(409);
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("requires an admin", async () => {
    mocks.getAdminSession.mockResolvedValue(null);
    const res = await call(adminPatch, { action: "approve" });
    expect(res.status).toBe(401);
  });
});
