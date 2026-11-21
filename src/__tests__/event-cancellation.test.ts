import { beforeEach, describe, expect, it, vi } from "vitest";

// Cancelling an event refunds every athlete everything they paid at checkout,
// booking fee included, with no path that leaves a paid entry unrefunded.

const mocks = vi.hoisted(() => ({
  event: { findUnique: vi.fn(), updateMany: vi.fn() },
  registration: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  supportTicket: { updateMany: vi.fn() },
  userNotification: { createMany: vi.fn() },
  notification: { create: vi.fn() },
  retrievePaymentIntent: vi.fn(),
  createRefund: vi.fn(),
  listRefunds: vi.fn(),
  cancelEventSchedules: vi.fn(),
  sendEventCancelledEmails: vi.fn(),
  lockEventEntries: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    event: mocks.event,
    registration: mocks.registration,
    supportTicket: mocks.supportTicket,
    userNotification: mocks.userNotification,
    notification: mocks.notification,
    $transaction: (fn: (tx: unknown) => unknown) => fn(client),
  };
  return { default: client };
});
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: { retrieve: mocks.retrievePaymentIntent },
    refunds: { create: mocks.createRefund, list: mocks.listRefunds },
  }),
}));
vi.mock("@/lib/event-scheduler", () => ({ cancelEventSchedules: mocks.cancelEventSchedules }));
vi.mock("@/lib/event-entry-lock", () => ({ lockEventEntries: mocks.lockEventEntries }));
vi.mock("@/lib/email", () => ({ sendEventCancelledEmails: mocks.sendEventCancelledEmails }));

import {
  CancelError,
  cancelEvent,
  cancellationPreview,
  processCancellationRefunds,
} from "@/lib/event-cancellation";

const EVENT = { id: "evt-1", status: "APPROVED", title: "Harbour 10K", eventDate: "2027-03-21", organiserId: "org-1" };

// A group booking of two on one PaymentIntent: $100 + $5.40 fee each, so the
// charge is $210.80. Plus a third athlete on their own charge.
const paid = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  status: "CONFIRMED",
  amountCents: 10000,
  platformFeeCents: 540,
  feeStructure: "athlete",
  refundAmountCents: null,
  stripePaymentIntentId: "pi_group",
  athleteEmail: `${id}@x.test`,
  userId: `user-${id}`,
  cancelRefundStatus: "PENDING",
  ...over,
});

/**
 * registration.findMany is called with different filters: the paid scan and
 * the free scan inside the transaction, then the refund worklist. Route each
 * call by what it asks for.
 */
function registrations(opts: { paid?: unknown[]; free?: unknown[]; worklist?: unknown[] }) {
  mocks.registration.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    const w = args.where;
    // The worklist asks for PENDING or FAILED rows through an OR.
    if (Array.isArray(w.OR)) return opts.worklist ?? [];
    if (w.stripePaymentIntentId === null) return opts.free ?? [];
    return opts.paid ?? [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.event.findUnique.mockResolvedValue(EVENT);
  mocks.event.updateMany.mockResolvedValue({ count: 1 });
  mocks.registration.updateMany.mockResolvedValue({ count: 1 });
  mocks.registration.count.mockResolvedValue(0);
  mocks.supportTicket.updateMany.mockResolvedValue({ count: 0 });
  mocks.userNotification.createMany.mockResolvedValue({ count: 0 });
  mocks.notification.create.mockResolvedValue({});
  mocks.cancelEventSchedules.mockResolvedValue(undefined);
  mocks.sendEventCancelledEmails.mockResolvedValue(0);
  mocks.lockEventEntries.mockResolvedValue(undefined);
  mocks.listRefunds.mockResolvedValue({ data: [] });
  mocks.retrievePaymentIntent.mockResolvedValue({
    latest_charge: { id: "ch_1", transfer: "tr_1", application_fee: "fee_1" },
  });
  let n = 0;
  mocks.createRefund.mockImplementation(async () => ({ id: `re_${++n}` }));
});

describe("processCancellationRefunds", () => {
  it("refunds each entry of a group booking its price plus booking fee, returning Startline's fee", async () => {
    registrations({ worklist: [paid("a"), paid("b")] });

    const summary = await processCancellationRefunds("evt-1");

    expect(summary).toEqual({ refunded: 2, failed: 0, released: 0, refundedCents: 21080, outstanding: 0 });
    expect(mocks.createRefund).toHaveBeenCalledTimes(2);
    for (const [i, id] of ["a", "b"].entries()) {
      const [params, options] = mocks.createRefund.mock.calls[i];
      expect(params).toEqual({
        charge: "ch_1",
        amount: 10540,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: { registrationId: id, reason: "event_cancelled" },
      });
      expect(options).toEqual({ idempotencyKey: `event-cancel-refund-${id}` });
    }
    expect(mocks.registration.updateMany).toHaveBeenCalledWith({
      where: { id: "a", cancelRefundStatus: { in: ["PENDING", "FAILED"] } },
      data: {
        status: "REFUNDED",
        refundAmountCents: 10540,
        cancelRefundStatus: "DONE",
        cancelRefundId: "re_1",
        cancelRefundError: null,
        cancelRefundAttemptAt: expect.any(Date),
      },
    });
  });

  it("refunds only the ticket price when the organiser absorbed the fee", async () => {
    registrations({ worklist: [paid("a", { feeStructure: "organiser" })] });
    await processCancellationRefunds("evt-1");
    expect(mocks.createRefund.mock.calls[0][0].amount).toBe(10000);
  });

  it("tops up an entry already partly refunded under the change-of-mind policy", async () => {
    registrations({ worklist: [paid("a", { status: "REFUNDED", refundAmountCents: 5270 })] });
    const summary = await processCancellationRefunds("evt-1");
    expect(mocks.createRefund.mock.calls[0][0].amount).toBe(5270);
    expect(summary.refundedCents).toBe(5270);
    // The row then records the whole amount as returned.
    expect(mocks.registration.updateMany.mock.calls[0][0].data.refundAmountCents).toBe(10540);
  });

  it("ignores a policy quote that was never paid out", async () => {
    // REFUND_REQUESTED with a 50% quote: nothing has gone back yet.
    registrations({ worklist: [paid("a", { status: "REFUND_REQUESTED", refundAmountCents: 5270 })] });
    await processCancellationRefunds("evt-1");
    expect(mocks.createRefund.mock.calls[0][0].amount).toBe(10540);
  });

  it("records a failure and carries on with the next entry", async () => {
    registrations({ worklist: [paid("a"), paid("b")] });
    mocks.createRefund
      .mockRejectedValueOnce(new Error("Insufficient funds in the connected account"))
      .mockResolvedValueOnce({ id: "re_b" });

    const summary = await processCancellationRefunds("evt-1");

    expect(summary).toMatchObject({ refunded: 1, failed: 1 });
    expect(mocks.registration.updateMany).toHaveBeenCalledWith({
      where: { id: "a", cancelRefundStatus: { in: ["PENDING", "FAILED"] } },
      data: {
        cancelRefundStatus: "FAILED",
        cancelRefundError: "Insufficient funds in the connected account",
        cancelRefundAttemptAt: expect.any(Date),
      },
    });
    expect(mocks.registration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "b", cancelRefundStatus: { in: ["PENDING", "FAILED"] } },
      data: expect.objectContaining({ cancelRefundStatus: "DONE", cancelRefundId: "re_b" }),
    }));
  });

  it("retries a failed entry, and does not refund twice if Stripe already did", async () => {
    registrations({ worklist: [paid("a", { cancelRefundStatus: "FAILED" })] });
    mocks.listRefunds.mockResolvedValue({
      data: [{ id: "re_earlier", status: "succeeded", metadata: { registrationId: "a", reason: "event_cancelled" } }],
    });

    const summary = await processCancellationRefunds("evt-1");

    expect(mocks.createRefund).not.toHaveBeenCalled();
    expect(summary.refunded).toBe(1);
    expect(mocks.registration.updateMany.mock.calls[0][0].data.cancelRefundId).toBe("re_earlier");
  });

  it("does not reuse a refund Stripe reports as failed", async () => {
    registrations({ worklist: [paid("a", { cancelRefundStatus: "FAILED" })] });
    mocks.listRefunds.mockResolvedValue({
      data: [{ id: "re_dead", status: "failed", metadata: { registrationId: "a", reason: "event_cancelled" } }],
    });
    await processCancellationRefunds("evt-1");
    expect(mocks.createRefund).toHaveBeenCalledTimes(1);
  });

  it("waits out the retry gap on a sweep, but not when a person asks", async () => {
    registrations({ worklist: [] });
    const now = new Date("2026-11-21T10:00:00.000Z");

    await processCancellationRefunds("evt-1", { now });
    const sweepWhere = mocks.registration.findMany.mock.calls[0][0].where;
    expect(sweepWhere.OR).toEqual([
      { cancelRefundStatus: "PENDING" },
      {
        cancelRefundStatus: "FAILED",
        OR: [
          { cancelRefundAttemptAt: null },
          { cancelRefundAttemptAt: { lt: new Date("2026-11-21T09:45:00.000Z") } },
        ],
      },
    ]);

    await processCancellationRefunds("evt-1", { now, includeRecentFailures: true });
    expect(mocks.registration.findMany.mock.calls[1][0].where.OR).toEqual([
      { cancelRefundStatus: "PENDING" },
      { cancelRefundStatus: "FAILED" },
    ]);
  });

  it("caps the refunds in one run and reports what is left", async () => {
    registrations({ worklist: [paid("a")] });
    mocks.registration.count.mockResolvedValue(7);

    const summary = await processCancellationRefunds("evt-1");

    expect(mocks.registration.findMany.mock.calls[0][0].take).toBe(10);
    expect(summary.outstanding).toBe(7);
  });

  it("leaves out the fee flags on a direct charge", async () => {
    registrations({ worklist: [paid("a")] });
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: { id: "ch_direct", transfer: null, application_fee: null } });
    await processCancellationRefunds("evt-1");
    const [params] = mocks.createRefund.mock.calls[0];
    expect(params).not.toHaveProperty("reverse_transfer");
    expect(params).not.toHaveProperty("refund_application_fee");
    expect(params.amount).toBe(10540);
  });
});

describe("cancelEvent", () => {
  it("flips the event under the entry lock and flags every paid entry still owed", async () => {
    const owed = [paid("a", { cancelRefundStatus: null }), paid("b", { cancelRefundStatus: null })];
    const settled = paid("c", { status: "REFUNDED", refundAmountCents: 10540, cancelRefundStatus: null });
    registrations({ paid: [...owed, settled], worklist: [paid("a"), paid("b")] });

    const result = await cancelEvent({ eventId: "evt-1", actor: { role: "organiser", id: "org-1" }, reason: " Permit withdrawn " });

    expect(mocks.lockEventEntries).toHaveBeenCalledWith(expect.anything(), "evt-1");
    expect(mocks.event.updateMany).toHaveBeenCalledWith({
      where: { id: "evt-1", status: "APPROVED" },
      data: expect.objectContaining({
        status: "CANCELLED",
        cancelledById: "org-1",
        cancelledByRole: "organiser",
        cancellationReason: "Permit withdrawn",
      }),
    });
    // The fully refunded entry is owed nothing and is not flagged.
    expect(mocks.registration.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] } },
      data: { cancelRefundStatus: "PENDING", cancelRefundError: null },
    });
    expect(mocks.cancelEventSchedules).toHaveBeenCalledWith("evt-1");
    expect(result).toMatchObject({ refunded: 2, failed: 0, refundedCents: 21080, alreadyCancelled: false });
  });

  it("releases free entries and settles the event's open refund tickets", async () => {
    registrations({ free: [{ id: "f1", athleteEmail: "f1@x.test", userId: null }] });

    const result = await cancelEvent({ eventId: "evt-1", actor: { role: "admin", id: "admin-1" }, reason: null });

    expect(mocks.registration.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["f1"] } },
      data: { status: "CANCELLED" },
    });
    expect(mocks.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt-1", requestType: "refund", status: { in: ["OPEN", "APPROVED"] } },
      data: expect.objectContaining({ status: "REFUNDED" }),
    });
    expect(result.released).toBe(1);
  });

  it("tells the organisation a free event's entries are released, not refunded", async () => {
    registrations({ free: [{ id: "f1", athleteEmail: "f1@x.test", userId: "user-f1" }] });

    await cancelEvent({ eventId: "evt-1", actor: { role: "organiser", id: "org-1" }, reason: null });

    const body = mocks.notification.create.mock.calls[0][0].data.body as string;
    expect(body).toContain("released");
    expect(body).not.toContain("refunded in full");
    expect(mocks.userNotification.createMany.mock.calls[0][0].data[0].body).not.toMatch(/refund/i);
  });

  it("emails each address once with the total coming back to it", async () => {
    const shared = { athleteEmail: "Buyer@x.test", userId: "user-buyer", cancelRefundStatus: null };
    registrations({
      paid: [paid("a", shared), paid("b", { ...shared, athleteEmail: "buyer@x.test" })],
      worklist: [],
    });

    await cancelEvent({ eventId: "evt-1", actor: { role: "organiser", id: "org-1" }, reason: null });

    expect(mocks.sendEventCancelledEmails).toHaveBeenCalledWith([
      { to: "Buyer@x.test", data: expect.objectContaining({ refundCents: 21080, eventTitle: "Harbour 10K" }) },
    ]);
    expect(mocks.userNotification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: "user-buyer", type: "EVENT_CANCELLED" })],
    });
    expect(mocks.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organiserId: "org-1", type: "EVENT_CANCELLED" }),
    });
  });

  it("on an already cancelled event only retries what is outstanding", async () => {
    mocks.event.findUnique.mockResolvedValue({ ...EVENT, status: "CANCELLED" });
    registrations({ worklist: [paid("a", { cancelRefundStatus: "FAILED" })] });

    const result = await cancelEvent({ eventId: "evt-1", actor: { role: "admin", id: "admin-1" }, reason: null });

    expect(mocks.event.updateMany).not.toHaveBeenCalled();
    expect(mocks.sendEventCancelledEmails).not.toHaveBeenCalled();
    expect(result).toMatchObject({ refunded: 1, alreadyCancelled: true });
  });

  it("refuses a finished event", async () => {
    mocks.event.findUnique.mockResolvedValue({ ...EVENT, status: "ARCHIVED" });
    await expect(cancelEvent({ eventId: "evt-1", actor: { role: "admin", id: "a" }, reason: null }))
      .rejects.toMatchObject({ status: 409, code: "NOT_CANCELLABLE" });
  });

  it("refuses when the event changed underneath it", async () => {
    mocks.event.updateMany.mockResolvedValue({ count: 0 });
    registrations({});
    await expect(cancelEvent({ eventId: "evt-1", actor: { role: "admin", id: "a" }, reason: null }))
      .rejects.toBeInstanceOf(CancelError);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("still succeeds when notifications fail", async () => {
    registrations({ paid: [paid("a", { cancelRefundStatus: null })], worklist: [paid("a")] });
    mocks.sendEventCancelledEmails.mockRejectedValue(new Error("Resend down"));
    const result = await cancelEvent({ eventId: "evt-1", actor: { role: "organiser", id: "org-1" }, reason: null });
    expect(result.refunded).toBe(1);
  });
});

describe("cancellationPreview", () => {
  it("totals what is still owed across paid entries", async () => {
    mocks.registration.findMany.mockResolvedValue([
      paid("a"),
      paid("b", { status: "REFUNDED", refundAmountCents: 5270 }),
      { ...paid("free"), stripePaymentIntentId: null, amountCents: 0, platformFeeCents: 0 },
    ]);
    expect(await cancellationPreview("evt-1")).toEqual({ entries: 2, paidEntries: 2, refundCents: 15810 });
  });
});
