import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PayoutAttemptStatus, PayoutStatus } from "@prisma/client";

// The failure this covers is between two systems: Stripe has accepted a payout
// while the database still says it has not been sent. These tests pin the
// durable claim and the idempotent resume path, rather than mocking Stripe's
// own idempotency implementation.

const mocks = vi.hoisted(() => {
  const payoutOperation = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const payoutAttempt = {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  return {
    payoutOperation,
    payoutAttempt,
    event: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    transaction: vi.fn(),
    createPayout: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  default: {
    payoutOperation: mocks.payoutOperation,
    payoutAttempt: mocks.payoutAttempt,
    event: mocks.event,
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ payouts: { create: mocks.createPayout } }),
}));

import {
  PAYOUT_IDEMPOTENCY_WINDOW_MS,
  PayoutError,
  runPayoutForEvent,
} from "@/lib/payout";

function operation(overrides: Record<string, unknown> = {}) {
  return {
    id: "operation-1",
    eventId: "event-1",
    stripeAccountId: "acct_1",
    amountCents: 10000,
    currency: "aud",
    status: PayoutStatus.PENDING,
    stripePayoutId: null,
    ...overrides,
  };
}

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: "attempt-1",
    operationId: "operation-1",
    attemptNumber: 1,
    idempotencyKey: "payout-event-1",
    status: PayoutAttemptStatus.STARTED,
    stripePayoutId: null,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    ...overrides,
  };
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    payoutTriggered: false,
    payoutAmountCents: null,
    organiser: { id: "org-1", stripeAccountId: "acct_1" },
    registrations: [{ amountCents: 10000 }],
    payoutOperation: null,
    ...overrides,
  };
}

function transactionMock(failFirstArrayWrite = false) {
  let failed = false;
  mocks.transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return arg({
        payoutOperation: mocks.payoutOperation,
        payoutAttempt: mocks.payoutAttempt,
      });
    }
    if (failFirstArrayWrite && !failed) {
      failed = true;
      throw new Error("database write failed");
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  transactionMock();
  mocks.createPayout.mockResolvedValue({ id: "po_1" });
  mocks.payoutOperation.create.mockResolvedValue(operation());
  mocks.payoutOperation.findUnique.mockResolvedValue(operation());
  mocks.payoutOperation.update.mockResolvedValue({});
  mocks.payoutOperation.updateMany.mockResolvedValue({ count: 1 });
  mocks.payoutAttempt.count.mockResolvedValue(0);
  mocks.payoutAttempt.create.mockResolvedValue(attempt());
  mocks.payoutAttempt.findFirst.mockResolvedValue(attempt());
  mocks.payoutAttempt.update.mockResolvedValue({});
  mocks.event.findUnique.mockResolvedValue(event());
  mocks.event.update.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runPayoutForEvent", () => {
  it("claims a durable operation and sends an event-scoped idempotency key", async () => {
    const result = await runPayoutForEvent("event-1");

    expect(result).toEqual({
      netCents: 10000,
      alreadyProcessed: false,
      stripePayoutId: "po_1",
    });

    expect(mocks.payoutOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: "event-1",
          stripeAccountId: "acct_1",
          amountCents: 10000,
          currency: "aud",
        }),
      }),
    );
    expect(mocks.createPayout).toHaveBeenCalledWith(
      {
        amount: 10000,
        currency: "aud",
        metadata: { eventId: "event-1", payoutOperationId: "operation-1" },
      },
      { stripeAccount: "acct_1", idempotencyKey: "payout-event-1" },
    );
    expect(mocks.event.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: {
        payoutTriggered: true,
        payoutAmountCents: 10000,
        payoutAt: expect.any(Date),
      },
    });
  });

  it("does not send a second payout when another request already owns the claim", async () => {
    mocks.payoutOperation.updateMany.mockResolvedValue({ count: 0 });
    mocks.payoutOperation.findUnique
      .mockResolvedValueOnce(operation())
      .mockResolvedValueOnce(operation({ status: PayoutStatus.SUBMITTING }));
    mocks.payoutAttempt.findFirst.mockResolvedValue(
      attempt({ createdAt: new Date() }),
    );

    await expect(runPayoutForEvent("event-1")).rejects.toMatchObject({
      code: "IN_PROGRESS",
      status: 409,
    });
    expect(mocks.createPayout).not.toHaveBeenCalled();
  });

  it("resumes the same key when Stripe succeeded but recording the result failed", async () => {
    transactionMock(true);
    const submitting = operation({ status: PayoutStatus.SUBMITTING });
    mocks.event.findUnique.mockResolvedValue(event({ payoutOperation: submitting }));

    await expect(runPayoutForEvent("event-1")).rejects.toMatchObject({
      code: "RECORD_FAILED",
      status: 503,
    });
    expect(mocks.createPayout).toHaveBeenCalledTimes(1);

    const result = await runPayoutForEvent("event-1");

    expect(result).toEqual({
      netCents: 10000,
      alreadyProcessed: false,
      stripePayoutId: "po_1",
    });
    expect(mocks.createPayout).toHaveBeenCalledTimes(2);
    expect(mocks.createPayout.mock.calls[0][1]).toEqual(mocks.createPayout.mock.calls[1][1]);
    expect(mocks.createPayout.mock.calls[1][1]).toEqual({
      stripeAccount: "acct_1",
      idempotencyKey: "payout-event-1",
    });
  });

  it("blocks a retry instead of risking a second payout after an ambiguous Stripe error", async () => {
    const submitting = operation({ status: PayoutStatus.SUBMITTING });
    mocks.event.findUnique.mockResolvedValue(event({ payoutOperation: submitting }));
    mocks.createPayout.mockRejectedValue(
      Object.assign(new Error("connection reset"), { type: "StripeConnectionError" }),
    );

    await expect(runPayoutForEvent("event-1")).rejects.toMatchObject({
      code: "RECONCILIATION_REQUIRED",
      status: 409,
    });
    expect(mocks.payoutOperation.update).toHaveBeenCalledWith({
      where: { id: "operation-1" },
      data: expect.objectContaining({ status: PayoutStatus.NEEDS_RECONCILIATION }),
    });
    expect(mocks.payoutAttempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: expect.objectContaining({ status: PayoutAttemptStatus.UNKNOWN }),
    });
  });

  it("refuses to reuse an idempotency key after Stripe's retention window", async () => {
    const submitting = operation({ status: PayoutStatus.SUBMITTING });
    mocks.event.findUnique.mockResolvedValue(event({ payoutOperation: submitting }));
    mocks.payoutAttempt.findFirst.mockResolvedValue(
      attempt({ createdAt: new Date(Date.now() - PAYOUT_IDEMPOTENCY_WINDOW_MS - 1000) }),
    );

    await expect(runPayoutForEvent("event-1")).rejects.toBeInstanceOf(PayoutError);
    expect(mocks.createPayout).not.toHaveBeenCalled();
    expect(mocks.payoutOperation.update).toHaveBeenCalledWith({
      where: { id: "operation-1" },
      data: expect.objectContaining({ status: PayoutStatus.NEEDS_RECONCILIATION }),
    });
  });

  it("does not send anything for an operation already needing reconciliation", async () => {
    const needsReconciliation = operation({ status: PayoutStatus.NEEDS_RECONCILIATION });
    mocks.event.findUnique.mockResolvedValue(event({ payoutOperation: needsReconciliation }));

    await expect(runPayoutForEvent("event-1")).rejects.toMatchObject({
      code: "RECONCILIATION_REQUIRED",
    });
    expect(mocks.createPayout).not.toHaveBeenCalled();
  });

  it("returns the recorded payout for a completed retry", async () => {
    mocks.event.findUnique.mockResolvedValue(event({
      payoutTriggered: true,
      payoutAmountCents: 10000,
      payoutOperation: operation({
        status: PayoutStatus.SUBMITTED,
        stripePayoutId: "po_existing",
      }),
    }));

    await expect(runPayoutForEvent("event-1")).resolves.toEqual({
      netCents: 10000,
      alreadyProcessed: true,
      stripePayoutId: "po_existing",
    });
    expect(mocks.createPayout).not.toHaveBeenCalled();
  });
});
