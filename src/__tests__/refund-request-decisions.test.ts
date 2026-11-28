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
  issueTicketRefund: vi.fn(),
  restoreDeclinedEntry: vi.fn(),
  notifyApprovedWithoutEntry: vi.fn(),
}));

// What a decision does to the entry and the money is tested in
// refund-ticket-outcome.test.ts. Here: that the routes call it correctly.
vi.mock("@/lib/refund-ticket-outcome", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/refund-ticket-outcome")>()),
  issueTicketRefund: mocks.issueTicketRefund,
  restoreDeclinedEntry: mocks.restoreDeclinedEntry,
  notifyApprovedWithoutEntry: mocks.notifyApprovedWithoutEntry,
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
  registrationId: "reg-1",
  policyRefundCents: 2500,
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
  mocks.issueTicketRefund.mockResolvedValue({ ok: true, refundCents: 2500 });
  mocks.restoreDeclinedEntry.mockResolvedValue(undefined);
  mocks.notifyApprovedWithoutEntry.mockResolvedValue(undefined);
});

const APPROVE_POLICY = { action: "approve", reason: "WITHIN_POLICY" };
const DECLINE = { action: "decline", reason: "OUTSIDE_POLICY", note: "Inside 14 days." };

describe("organiser PATCH", () => {
  it("records the decision and reason in the organiser's own fields, then issues the refund", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    const res = await call(organiserPatch, { ...APPROVE_POLICY, note: " fine " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: ID, status: "REFUNDED", refundCents: 2500 });
    expect(mocks.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { id: ID, status: "OPEN" },
      data: expect.objectContaining({
        status: "APPROVED",
        organiserDecision: "APPROVED",
        organiserDecidedById: "org-1",
        organiserNote: "fine",
        organiserReason: "WITHIN_POLICY",
        refundType: "POLICY",
      }),
    });
    expect(mocks.issueTicketRefund).toHaveBeenCalledWith(ID, { firstAttempt: true });
  });

  it.each(["EVENT_CHANGED", "NOT_DELIVERED"])("%s approves a full refund", async (reason) => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    const res = await call(organiserPatch, { action: "approve", reason });
    expect(res.status).toBe(200);
    expect(mocks.supportTicket.updateMany.mock.calls[0][0].data).toMatchObject({ refundType: "FULL" });
  });

  it("needs a note on goodwill, then refunds in full", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    const bare = await call(organiserPatch, { action: "approve", reason: "GOODWILL" });
    expect(bare.status).toBe(400);
    expect(mocks.supportTicket.updateMany).not.toHaveBeenCalled();

    const res = await call(organiserPatch, { action: "approve", reason: "GOODWILL", note: "Injured, with a certificate." });
    expect(res.status).toBe(200);
    expect(mocks.supportTicket.updateMany.mock.calls[0][0].data).toMatchObject({
      organiserReason: "GOODWILL",
      refundType: "FULL",
    });
  });

  it("refuses a policy approval when the policy owes nothing", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ policyRefundCents: 0 }));
    const res = await call(organiserPatch, APPROVE_POLICY);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/goodwill/i);
    expect(mocks.supportTicket.updateMany).not.toHaveBeenCalled();
    expect(mocks.issueTicketRefund).not.toHaveBeenCalled();
  });

  it("needs a reason", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    expect((await call(organiserPatch, { action: "approve" })).status).toBe(400);
    // A decline reason cannot approve, and the other way round.
    expect((await call(organiserPatch, { action: "approve", reason: "OUTSIDE_POLICY" })).status).toBe(400);
    expect((await call(organiserPatch, { action: "decline", reason: "GOODWILL", note: "x" })).status).toBe(400);
    expect(mocks.supportTicket.updateMany).not.toHaveBeenCalled();
  });

  it("needs a note to decline, then gives the athlete their entry back", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    expect((await call(organiserPatch, { action: "decline", reason: "OUTSIDE_POLICY" })).status).toBe(400);

    const res = await call(organiserPatch, DECLINE);
    expect(res.status).toBe(200);
    expect(mocks.supportTicket.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "DECLINED",
      organiserReason: "OUTSIDE_POLICY",
      organiserNote: "Inside 14 days.",
      refundType: null,
    });
    expect(mocks.restoreDeclinedEntry).toHaveBeenCalledWith(ID);
    expect(mocks.issueTicketRefund).not.toHaveBeenCalled();
  });

  it("approves a ticket with no entry without issuing anything", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ registrationId: null, policyRefundCents: null }));
    const res = await call(organiserPatch, APPROVE_POLICY);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "APPROVED", issued: false });
    expect(mocks.issueTicketRefund).not.toHaveBeenCalled();
    expect(mocks.notifyApprovedWithoutEntry).toHaveBeenCalledWith(ID);
  });

  it("keeps the approval when Stripe fails, and says why", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    mocks.issueTicketRefund.mockResolvedValue({ ok: false, error: "Card network down." });
    const res = await call(organiserPatch, APPROVE_POLICY);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: ID, status: "APPROVED", issued: false, refundError: "Card network down." });
  });

  it("refuses a ticket that is no longer open", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "APPROVED" }));
    const res = await call(organiserPatch, DECLINE);
    expect(res.status).toBe(409);
    expect(mocks.supportTicket.updateMany).not.toHaveBeenCalled();
  });

  it("loses a race with an admin decision cleanly", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    mocks.supportTicket.updateMany.mockResolvedValue({ count: 0 });
    const res = await call(organiserPatch, DECLINE);
    expect(res.status).toBe(409);
    expect(mocks.restoreDeclinedEntry).not.toHaveBeenCalled();
  });

  it("hides another organisation's ticket", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ organiserId: "org-2" }));
    const res = await call(organiserPatch, APPROVE_POLICY);
    expect(res.status).toBe(404);
  });

  it("passes through an auth failure", async () => {
    mocks.requireOrganiser.mockResolvedValue({ error: NextResponse.json({}, { status: 401 }) });
    const res = await call(organiserPatch, APPROVE_POLICY);
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

  it("issues the refund when an override approves, in full when asked", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "DECLINED", organiserDecision: "DECLINED" }));
    const res = await call(adminPatch, { action: "approve", override: true, note: "Date moved.", refundType: "FULL" });
    expect(res.status).toBe(200);
    expect(mocks.supportTicket.updateMany.mock.calls[0][0].data).toMatchObject({ refundType: "FULL" });
    expect(mocks.issueTicketRefund).toHaveBeenCalledWith(ID, { firstAttempt: true });
  });

  it("refuses a policy approval the policy owes nothing on", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ policyRefundCents: 0 }));
    const res = await call(adminPatch, { action: "approve" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/full refund/);
    expect(mocks.supportTicket.updateMany).not.toHaveBeenCalled();
  });

  it("gives the entry back when Startline declines", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    await call(adminPatch, { action: "decline" });
    expect(mocks.restoreDeclinedEntry).toHaveBeenCalledWith(ID);
  });

  it("retries a failed refund on an approved ticket, audited", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "APPROVED", organiserDecision: "APPROVED" }));
    const res = await call(adminPatch, { action: "issue" });
    expect(res.status).toBe(200);
    expect(mocks.issueTicketRefund).toHaveBeenCalledWith(ID, { firstAttempt: false });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "REFUND_TICKET_ISSUE_RETRY",
      meta: { refundCents: 2500 },
    }));
    expect(mocks.supportTicket.updateMany).not.toHaveBeenCalled();
  });

  it("reports a retry that fails again", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "APPROVED", organiserDecision: "APPROVED" }));
    mocks.issueTicketRefund.mockResolvedValue({ ok: false, error: "Still down." });
    const res = await call(adminPatch, { action: "issue" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Still down.");
  });

  it("only retries an approved ticket with an entry", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "OPEN" }));
    expect((await call(adminPatch, { action: "issue" })).status).toBe(409);
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "APPROVED", registrationId: null }));
    expect((await call(adminPatch, { action: "issue" })).status).toBe(409);
    expect(mocks.issueTicketRefund).not.toHaveBeenCalled();
  });

  it("requires an admin", async () => {
    mocks.getAdminSession.mockResolvedValue(null);
    const res = await call(adminPatch, { action: "approve" });
    expect(res.status).toBe(401);
  });
});
