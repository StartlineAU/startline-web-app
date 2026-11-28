import { beforeEach, describe, expect, it, vi } from "vitest";

// #492: approving a refund ticket raised from an entry issues the refund for
// the amount the organiser's reason set; declining gives the entry back.

const mocks = vi.hoisted(() => ({
  supportTicket: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  registration: { updateMany: vi.fn(), aggregate: vi.fn() },
  paymentAdjustment: { aggregate: vi.fn(async () => ({ _sum: { unallocatedCents: null as number | null } })) },
  userNotification: { create: vi.fn() },
  issueEntryRefund: vi.fn(),
  refundTeammates: vi.fn(),
  sendRefundDecisionEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    supportTicket: mocks.supportTicket,
    registration: mocks.registration,
    paymentAdjustment: mocks.paymentAdjustment,
    userNotification: mocks.userNotification,
  },
}));
vi.mock("@/lib/issue-entry-refund", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/issue-entry-refund")>()),
  issueEntryRefund: mocks.issueEntryRefund,
}));
vi.mock("@/lib/team-refund", () => ({ refundTeammates: mocks.refundTeammates }));
vi.mock("@/lib/email", () => ({ sendRefundDecisionEmail: mocks.sendRefundDecisionEmail }));

import { RefundError } from "@/lib/issue-entry-refund";
import {
  approvalBlocker,
  issueTicketRefund,
  restoreDeclinedEntry,
  ticketRefundCents,
} from "@/lib/refund-ticket-outcome";

const entry = (over: Record<string, unknown> = {}) => ({
  id: "reg-1",
  status: "REFUND_REQUESTED",
  // $50 ticket, $3 booking fee paid on top.
  amountCents: 5000,
  platformFeeCents: 300,
  feeStructure: "athlete",
  refundAmountCents: 2500,
  refundPercent: 50,
  stripePaymentIntentId: "pi_1",
  cancelRefundStatus: null,
  athleteName: "Harper Jones",
  userId: "user-1",
  eventId: "evt-1",
  teamId: null,
  event: { id: "evt-1", title: "Harbour 10K", organiser: { orgName: "Apex Endurance" } },
  ...over,
});

const ticket = (over: Record<string, unknown> = {}) => ({
  id: "ticket-1",
  status: "APPROVED",
  email: "harper@startline.test",
  name: "Harper",
  eventName: "Harbour 10K",
  registrationId: "reg-1",
  policyRefundPercent: 50,
  policyRefundCents: 2500,
  organiserReason: "WITHIN_POLICY",
  organiserNote: null,
  refundType: "POLICY",
  refundCents: null,
  registration: entry(),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supportTicket.updateMany.mockResolvedValue({ count: 1 });
  mocks.supportTicket.update.mockResolvedValue({});
  mocks.registration.updateMany.mockResolvedValue({ count: 1 });
  mocks.userNotification.create.mockResolvedValue({});
  mocks.sendRefundDecisionEmail.mockResolvedValue(undefined);
  mocks.issueEntryRefund.mockImplementation(async (e: { refundAmountCents: number }) => ({
    method: "stripe",
    refundId: "re_1",
    refundCents: e.refundAmountCents,
  }));
});

describe("ticketRefundCents", () => {
  const paid = { amountCents: 5000, platformFeeCents: 300, feeStructure: "athlete" };

  it("returns the policy quote on POLICY", () => {
    expect(ticketRefundCents({ policyRefundCents: 2500 }, paid, "POLICY")).toBe(2500);
  });

  it("returns everything paid, booking fee included, on FULL", () => {
    expect(ticketRefundCents({ policyRefundCents: 2500 }, paid, "FULL")).toBe(5300);
  });

  it("does not add a fee the athlete never paid", () => {
    expect(ticketRefundCents({ policyRefundCents: 0 }, { ...paid, feeStructure: "organiser" }, "FULL")).toBe(5000);
  });
});

describe("approvalBlocker", () => {
  it("refuses a POLICY approval the policy owes nothing on", () => {
    expect(approvalBlocker({ registrationId: "reg-1", policyRefundCents: 0 }, "POLICY")).toMatch(/goodwill/);
    expect(approvalBlocker({ registrationId: "reg-1", policyRefundCents: 0 }, "FULL")).toBeNull();
  });

  it("leaves a ticket with no entry to Startline", () => {
    expect(approvalBlocker({ registrationId: null, policyRefundCents: null }, "POLICY")).toBeNull();
  });
});

describe("issueTicketRefund", () => {
  it("refunds the policy amount, closes the ticket and emails the athlete", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    const result = await issueTicketRefund("ticket-1", { firstAttempt: true });

    expect(result).toEqual({ ok: true, refundCents: 2500 });
    expect(mocks.registration.updateMany).toHaveBeenCalledWith({
      where: { id: "reg-1", status: { in: ["CONFIRMED", "REFUND_REQUESTED"] } },
      data: { refundAmountCents: 2500, refundPercent: 50, refundOutsidePolicy: false },
    });
    expect(mocks.issueEntryRefund).toHaveBeenCalledWith(expect.objectContaining({ id: "reg-1", refundAmountCents: 2500 }));
    expect(mocks.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { id: "ticket-1", status: "APPROVED" },
      data: expect.objectContaining({ status: "REFUNDED", refundCents: 2500, refundError: null }),
    });
    expect(mocks.sendRefundDecisionEmail).toHaveBeenCalledWith(
      "harper@startline.test",
      expect.objectContaining({ outcome: "refunded", amountCents: 2500, full: false, organiserName: "Apex Endurance" }),
    );
  });

  it("refunds the ticket price only on TICKET (goodwill): the booking fee is kept", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ refundType: "TICKET", organiserReason: "GOODWILL" }));
    const result = await issueTicketRefund("ticket-1", { firstAttempt: true });

    expect(result).toEqual({ ok: true, refundCents: 5000 });
    expect(mocks.registration.updateMany.mock.calls[0][0].data).toEqual({
      refundAmountCents: 5000,
      refundPercent: 100,
      refundOutsidePolicy: true,
    });
    expect(mocks.sendRefundDecisionEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ outcome: "refunded", full: false }),
    );
  });

  it("refunds everything paid on FULL, marked as outside the policy", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ refundType: "FULL", organiserReason: "EVENT_CHANGED" }));
    const result = await issueTicketRefund("ticket-1", { firstAttempt: true });

    expect(result).toEqual({ ok: true, refundCents: 5300 });
    expect(mocks.registration.updateMany.mock.calls[0][0].data).toEqual({
      refundAmountCents: 5300,
      refundPercent: 100,
      refundOutsidePolicy: true,
    });
    expect(mocks.sendRefundDecisionEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ outcome: "refunded", full: true, reasonLabel: "We changed the event" }),
    );
  });

  it("refuses to refund again while a Stripe dashboard refund on the payment is unmatched", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    mocks.paymentAdjustment.aggregate.mockResolvedValueOnce({ _sum: { unallocatedCents: 2500 } });
    const result = await issueTicketRefund("ticket-1", { firstAttempt: false });
    expect(result.ok).toBe(false);
    expect(mocks.issueEntryRefund).not.toHaveBeenCalled();
    expect(mocks.supportTicket.update).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: { refundError: expect.stringMatching(/not matched/) },
    });
  });

  it("keeps the ticket approved with the error when Stripe fails, and tells the athlete once", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    mocks.issueEntryRefund.mockRejectedValue(new RefundError("Could not read the charge.", 502, "CHARGE_UNREADABLE"));

    const first = await issueTicketRefund("ticket-1", { firstAttempt: true });
    expect(first).toEqual({ ok: false, error: "Could not read the charge." });
    expect(mocks.supportTicket.update).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: { refundError: "Could not read the charge." },
    });
    expect(mocks.supportTicket.updateMany).not.toHaveBeenCalled();
    expect(mocks.sendRefundDecisionEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ outcome: "approved" }),
    );
    expect(mocks.userNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", type: "REFUND_APPROVED" }),
    });

    vi.clearAllMocks();
    mocks.supportTicket.findUnique.mockResolvedValue(ticket());
    mocks.registration.updateMany.mockResolvedValue({ count: 1 });
    mocks.supportTicket.update.mockResolvedValue({});
    mocks.issueEntryRefund.mockRejectedValue(new Error("network"));
    const retry = await issueTicketRefund("ticket-1", { firstAttempt: false });
    expect(retry.ok).toBe(false);
    expect(mocks.sendRefundDecisionEmail).not.toHaveBeenCalled();
  });

  it("closes the ticket on what went back when the entry was refunded some other way", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(
      ticket({ registration: entry({ status: "REFUNDED", refundAmountCents: 4000 }) }),
    );
    const result = await issueTicketRefund("ticket-1", { firstAttempt: false });
    expect(result).toEqual({ ok: true, refundCents: 4000 });
    expect(mocks.issueEntryRefund).not.toHaveBeenCalled();
    expect(mocks.supportTicket.updateMany.mock.calls[0][0].data).toMatchObject({ status: "REFUNDED", refundCents: 4000 });
  });

  it("refunds the team at the same terms, and counts teammates bought on the athlete's payment", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(
      ticket({ refundType: "FULL", registration: entry({ teamId: "team-1" }) }),
    );
    mocks.refundTeammates.mockResolvedValue({ refunded: [{ id: "reg-2", athleteName: "Sam", refundCents: 5300 }], failed: [] });
    // Sam's place was on Harper's payment, so it went back to Harper's card.
    mocks.registration.aggregate.mockResolvedValue({ _sum: { refundAmountCents: 5300 } });

    const result = await issueTicketRefund("ticket-1", { firstAttempt: true });
    expect(mocks.refundTeammates).toHaveBeenCalledWith("team-1", "reg-1", { kind: "full" });
    expect(mocks.registration.aggregate.mock.calls[0][0].where).toMatchObject({
      teamId: "team-1",
      id: { not: "reg-1" },
      status: "REFUNDED",
      stripePaymentIntentId: "pi_1",
    });
    expect(result).toEqual({ ok: true, refundCents: 10600 });
  });

  it("does not count a teammate who paid for their own place", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(
      ticket({ refundType: "FULL", registration: entry({ teamId: "team-1" }) }),
    );
    mocks.refundTeammates.mockResolvedValue({ refunded: [{ id: "reg-2", athleteName: "Sam", refundCents: 5300 }], failed: [] });
    mocks.registration.aggregate.mockResolvedValue({ _sum: { refundAmountCents: null } });

    const result = await issueTicketRefund("ticket-1", { firstAttempt: true });
    expect(result).toEqual({ ok: true, refundCents: 5300 });
    expect(mocks.sendRefundDecisionEmail.mock.calls[0][1]).toMatchObject({ outcome: "refunded", amountCents: 5300 });
  });

  it("leaves the ticket open to retry when a teammate fails", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ registration: entry({ teamId: "team-1" }) }));
    mocks.refundTeammates.mockResolvedValue({ refunded: [], failed: [{ id: "reg-2", athleteName: "Sam", error: "Declined." }] });
    mocks.registration.aggregate.mockResolvedValue({ _sum: { refundAmountCents: 2500 } });

    const result = await issueTicketRefund("ticket-1", { firstAttempt: true });
    expect(mocks.refundTeammates).toHaveBeenCalledWith("team-1", "reg-1", { kind: "percent", percent: 50 });
    expect(result.ok).toBe(false);
    expect(mocks.supportTicket.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing for a ticket that is not approved", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "OPEN" }));
    const result = await issueTicketRefund("ticket-1", { firstAttempt: true });
    expect(result.ok).toBe(false);
    expect(mocks.issueEntryRefund).not.toHaveBeenCalled();
  });
});

describe("restoreDeclinedEntry", () => {
  it("names Startline and its note, not the organiser's, when an admin declined", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(
      ticket({
        status: "DECLINED",
        organiserReason: "GOODWILL",
        organiserNote: "One-off favour.",
        adminDecisionKind: "OVERRIDE",
        adminNote: "Outside the policy window.",
        refundType: null,
      }),
    );
    await restoreDeclinedEntry("ticket-1");

    expect(mocks.sendRefundDecisionEmail.mock.calls[0][1]).toMatchObject({
      outcome: "declined",
      decidedBy: "startline",
      reasonLabel: null,
      note: "Outside the policy window.",
    });
    const body = mocks.userNotification.create.mock.calls[0][0].data.body as string;
    expect(body).toContain("Startline declined");
    expect(body).toContain("Outside the policy window.");
    expect(body).not.toContain("favour");
  });

  it("puts the entry back to CONFIRMED and tells the athlete why", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(
      ticket({ status: "DECLINED", organiserReason: "OUTSIDE_POLICY", organiserNote: "Inside 14 days.", refundType: null }),
    );
    await restoreDeclinedEntry("ticket-1");

    expect(mocks.registration.updateMany).toHaveBeenCalledWith({
      where: { id: "reg-1", status: "REFUND_REQUESTED" },
      data: {
        status: "CONFIRMED",
        refundRequestedAt: null,
        refundPercent: null,
        refundAmountCents: null,
        refundOutsidePolicy: false,
      },
    });
    expect(mocks.sendRefundDecisionEmail).toHaveBeenCalledWith(
      "harper@startline.test",
      expect.objectContaining({
        outcome: "declined",
        reasonLabel: "Outside our refund policy",
        note: "Inside 14 days.",
      }),
    );
    expect(mocks.userNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "REFUND_DECLINED" }),
    });
  });

  it("still emails when the ticket has no entry", async () => {
    mocks.supportTicket.findUnique.mockResolvedValue(ticket({ status: "DECLINED", registration: null, registrationId: null }));
    await restoreDeclinedEntry("ticket-1");
    expect(mocks.registration.updateMany).not.toHaveBeenCalled();
    expect(mocks.sendRefundDecisionEmail).toHaveBeenCalled();
  });
});
