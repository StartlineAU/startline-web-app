import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PayoutAttemptStatus, PayoutStatus } from "@prisma/client";

// Stripe and the database cannot commit together, so these tests pin the
// durable claim and idempotent resume path rather than mocking Stripe's own
// idempotency implementation. They also pin the per-entry fee snapshot: an
// organiser-paid entry leaves less in the connected account than its ticket
// price (issue #251).

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
  getPayoutEligibleEvents,
  PAYOUT_IDEMPOTENCY_WINDOW_MS,
  PayoutError,
  registrationPayoutCents,
  registrationsPayoutCents,
  runPayoutForEvent,
} from "@/lib/payout";

const entry = (
  amountCents: number,
  platformFeeCents: number,
  feeStructure: string,
) => ({ amountCents, platformFeeCents, feeStructure });

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
    registrations: [entry(10000, 540, "athlete")],
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

describe("registrationPayoutCents", () => {
  it("leaves the athlete-paid ticket price untouched", () => {
    expect(registrationPayoutCents(entry(10000, 540, "athlete"))).toBe(10000);
  });

  it("deducts the fee the organiser absorbed", () => {
    expect(registrationPayoutCents(entry(10000, 540, "organiser"))).toBe(9460);
  });

  // Checkout treats anything that is not "athlete" as organiser-absorbed, so
  // the payout follows the same rule rather than overpaying on a bad snapshot.
  it("treats an unrecognised structure as organiser-absorbed", () => {
    expect(registrationPayoutCents(entry(10000, 540, ""))).toBe(9460);
  });

  it("never returns a negative share", () => {
    expect(registrationPayoutCents(entry(100, 540, "organiser"))).toBe(0);
  });

  it("uses each entry's own snapshot in a mixed event", () => {
    expect(registrationsPayoutCents([
      entry(10000, 540, "athlete"),
      entry(10000, 540, "organiser"),
    ])).toBe(19460);
  });
});

describe("getPayoutEligibleEvents", () => {
  it("previews the net the organiser will actually receive", async () => {
    mocks.event.findMany.mockResolvedValue([
      {
        id: "event-1",
        title: "Apex Throwdown",
        eventDate: "2026-08-15",
        endDate: null,
        organiser: { id: "org-1", orgName: "Apex", stripeAccountId: "acct_1" },
        payoutOperation: null,
        registrations: [
          entry(10000, 540, "athlete"),
          entry(10000, 540, "organiser"),
        ],
      },
    ]);

    const events = await getPayoutEligibleEvents();

    expect(events).toHaveLength(1);
    expect(events[0].netCents).toBe(19460);
    expect(mocks.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        registrations: {
          where: { status: "CONFIRMED" },
          select: { amountCents: true, platformFeeCents: true, feeStructure: true },
        },
      }),
    }));
  });
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

  it("creates the operation for the net, not the sum of ticket prices", async () => {
    const mixed = [
      entry(10000, 540, "athlete"),
      entry(10000, 540, "organiser"),
    ];
    mocks.event.findUnique.mockResolvedValue(event({ registrations: mixed }));
    mocks.payoutOperation.create.mockResolvedValue(operation({ amountCents: 19460 }));
    mocks.payoutOperation.findUnique.mockResolvedValue(operation({ amountCents: 19460 }));

    await expect(runPayoutForEvent("event-1")).resolves.toEqual({
      netCents: 19460,
      alreadyProcessed: false,
      stripePayoutId: "po_1",
    });

    expect(mocks.payoutOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 19460 }),
      }),
    );
    expect(mocks.createPayout).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 19460 }),
      expect.objectContaining({ stripeAccount: "acct_1" }),
    );
    expect(mocks.event.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({ payoutAmountCents: 19460 }),
    });
  });

  it("corrects an unstarted operation recorded with the old gross amount", async () => {
    mocks.event.findUnique.mockResolvedValue(event({
      payoutOperation: operation(),
      registrations: [entry(10000, 540, "organiser")],
    }));
    mocks.payoutOperation.findUnique.mockResolvedValue(operation({ amountCents: 9460 }));

    await expect(runPayoutForEvent("event-1")).resolves.toEqual({
      netCents: 9460,
      alreadyProcessed: false,
      stripePayoutId: "po_1",
    });

    expect(mocks.payoutOperation.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "operation-1",
        status: { in: [PayoutStatus.PENDING, PayoutStatus.FAILED] },
      },
      data: { amountCents: 9460 },
    });
    expect(mocks.createPayout).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 9460 }),
      expect.objectContaining({ stripeAccount: "acct_1" }),
    );
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
