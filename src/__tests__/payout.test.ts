import { describe, it, expect, vi, beforeEach } from "vitest";

// Issue #251: the organiser-pays fee structure leaves the connected account
// with the ticket price MINUS the platform fee. Paying out the ticket price
// alone asks Stripe for money the event never earned.
const mocks = vi.hoisted(() => ({
  event: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  createPayout: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: { event: mocks.event } }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ payouts: { create: mocks.createPayout } }),
}));

import {
  getPayoutEligibleEvents,
  registrationPayoutCents,
  registrationsPayoutCents,
  runPayoutForEvent,
} from "@/lib/payout";

const entry = (
  amountCents: number,
  platformFeeCents: number,
  feeStructure: string,
) => ({ amountCents, platformFeeCents, feeStructure });

describe("registrationPayoutCents", () => {
  it("leaves the athlete-paid ticket price untouched", () => {
    expect(registrationPayoutCents(entry(10000, 540, "athlete"))).toBe(10000);
  });

  it("deducts the fee the organiser absorbed", () => {
    expect(registrationPayoutCents(entry(10000, 540, "organiser"))).toBe(9460);
  });

  // Checkout treats anything that is not "athlete" as organiser-absorbed, so
  // the payout must follow the same rule rather than silently overpaying on a
  // malformed snapshot.
  it("treats an unrecognised structure as organiser-absorbed", () => {
    expect(registrationPayoutCents(entry(10000, 540, ""))).toBe(9460);
  });

  it("never returns a negative share", () => {
    expect(registrationPayoutCents(entry(100, 540, "organiser"))).toBe(0);
  });
});

describe("registrationsPayoutCents", () => {
  it("uses each entry's own fee snapshot", () => {
    expect(registrationsPayoutCents([
      entry(10000, 540, "athlete"),
      entry(10000, 540, "organiser"),
    ])).toBe(19460);
  });
});

describe("getPayoutEligibleEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("previews the net the organiser will actually receive", async () => {
    mocks.event.findMany.mockResolvedValue([
      {
        id: "event-1",
        title: "Apex Throwdown",
        eventDate: "2026-08-15",
        endDate: null,
        organiser: { id: "org-1", orgName: "Apex", stripeAccountId: "acct_1" },
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPayout.mockResolvedValue({ id: "po_1" });
    mocks.event.update.mockResolvedValue({});
  });

  it("pays the net held by Stripe and records the same amount", async () => {
    mocks.event.findUnique.mockResolvedValue({
      id: "event-1",
      title: "Apex Throwdown",
      payoutTriggered: false,
      organiser: { id: "org-1", stripeAccountId: "acct_1" },
      registrations: [
        entry(10000, 540, "athlete"),
        entry(10000, 540, "organiser"),
      ],
    });

    const result = await runPayoutForEvent("event-1");

    expect(result).toEqual({ netCents: 19460 });
    expect(mocks.createPayout).toHaveBeenCalledWith(
      { amount: 19460, currency: "aud" },
      { stripeAccount: "acct_1" },
    );
    expect(mocks.event.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({ payoutAmountCents: 19460 }),
    });
  });

  it("refuses a payout whose fees consume every confirmed entry", async () => {
    mocks.event.findUnique.mockResolvedValue({
      id: "event-1",
      title: "Apex Throwdown",
      payoutTriggered: false,
      organiser: { id: "org-1", stripeAccountId: "acct_1" },
      registrations: [entry(100, 540, "organiser")],
    });

    await expect(runPayoutForEvent("event-1")).rejects.toThrow(
      "No confirmed registrations to pay out.",
    );
    expect(mocks.createPayout).not.toHaveBeenCalled();
  });
});
