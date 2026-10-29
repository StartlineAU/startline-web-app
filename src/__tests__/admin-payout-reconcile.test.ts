import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { PayoutStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  payoutOperation: { findUnique: vi.fn(), update: vi.fn() },
  payoutAttempt: { updateMany: vi.fn() },
  event: { update: vi.fn() },
  transaction: vi.fn(),
  retrievePayout: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({ getAdminSession: mocks.getAdminSession }));
vi.mock("@/lib/prisma", () => ({
  default: {
    payoutOperation: mocks.payoutOperation,
    payoutAttempt: mocks.payoutAttempt,
    event: mocks.event,
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ payouts: { retrieve: mocks.retrievePayout } }),
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { POST } from "@/app/api/admin/payouts/reconcile/route";

function operation(overrides: Record<string, unknown> = {}) {
  return {
    id: "operation-1",
    eventId: "event-1",
    stripeAccountId: "acct_1",
    amountCents: 10000,
    currency: "aud",
    status: PayoutStatus.NEEDS_RECONCILIATION,
    stripePayoutId: null,
    updatedAt: new Date(Date.now() - 5 * 60 * 1000),
    ...overrides,
  };
}

function reconcile(body: unknown): Promise<Response> {
  return POST(new NextRequest("http://localhost/api/admin/payouts/reconcile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminSession.mockResolvedValue({ sub: "admin-1" });
  mocks.payoutOperation.findUnique.mockResolvedValue(operation());
  mocks.payoutOperation.update.mockResolvedValue({});
  mocks.payoutAttempt.updateMany.mockResolvedValue({ count: 1 });
  mocks.event.update.mockResolvedValue({});
  mocks.transaction.mockImplementation((arg: Promise<unknown>[]) => Promise.all(arg));
  mocks.retrievePayout.mockResolvedValue({
    id: "po_1",
    amount: 10000,
    currency: "aud",
    status: "paid",
  });
  mocks.writeAuditLog.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/admin/payouts/reconcile", () => {
  it("links a matching Stripe payout and records the event as paid", async () => {
    const res = await reconcile({
      eventId: "event-1",
      resolution: "link",
      stripePayoutId: "po_1",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      eventId: "event-1",
      netCents: 10000,
      stripePayoutId: "po_1",
    });
    expect(mocks.retrievePayout).toHaveBeenCalledWith("po_1", {}, { stripeAccount: "acct_1" });
    expect(mocks.payoutOperation.update).toHaveBeenCalledWith({
      where: { id: "operation-1" },
      data: expect.objectContaining({
        status: PayoutStatus.SUBMITTED,
        stripePayoutId: "po_1",
      }),
    });
    expect(mocks.event.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({ payoutTriggered: true, payoutAmountCents: 10000 }),
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "PAYOUT_RECONCILED",
      targetId: "event-1",
      meta: expect.objectContaining({ resolution: "link", stripePayoutId: "po_1" }),
    }));
  });

  it("refuses a payout with the wrong amount or currency", async () => {
    mocks.retrievePayout.mockResolvedValue({
      id: "po_1",
      amount: 999,
      currency: "aud",
      status: "paid",
    });

    const res = await reconcile({
      eventId: "event-1",
      resolution: "link",
      stripePayoutId: "po_1",
    });

    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.event.update).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before allowing a retry with no payout", async () => {
    const res = await reconcile({
      eventId: "event-1",
      resolution: "no_payout",
    });

    expect(res.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses to clear a payout request that is still inside its lease", async () => {
    mocks.payoutOperation.findUnique.mockResolvedValue(operation({
      status: PayoutStatus.SUBMITTING,
      updatedAt: new Date(),
    }));

    const res = await reconcile({
      eventId: "event-1",
      resolution: "no_payout",
      confirm: true,
    });

    expect(res.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("marks the operation failed only after no payout is confirmed", async () => {
    const res = await reconcile({
      eventId: "event-1",
      resolution: "no_payout",
      confirm: true,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, retryAvailable: true });
    expect(mocks.payoutOperation.update).toHaveBeenCalledWith({
      where: { id: "operation-1" },
      data: expect.objectContaining({ status: PayoutStatus.FAILED }),
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "PAYOUT_RECONCILED",
      meta: expect.objectContaining({ resolution: "no_payout" }),
    }));
  });

  it("returns the existing payout when the same link is submitted again", async () => {
    mocks.payoutOperation.findUnique.mockResolvedValue(operation({
      status: PayoutStatus.SUBMITTED,
      stripePayoutId: "po_1",
    }));

    const res = await reconcile({
      eventId: "event-1",
      resolution: "link",
      stripePayoutId: "po_1",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ alreadyProcessed: true, stripePayoutId: "po_1" });
    expect(mocks.retrievePayout).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
