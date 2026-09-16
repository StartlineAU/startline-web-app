import { describe, it, expect, vi, beforeEach } from "vitest";

// Merchandise money sits in the organiser's connected balance exactly like
// ticket money, so leaving it out of the payout means it never reaches their
// bank. These assert what the sweep actually adds up, and which add-on rows it
// is allowed to count.

const mocks = vi.hoisted(() => ({
  eventFindMany: vi.fn(),
  eventFindUnique: vi.fn(),
  eventUpdate: vi.fn(),
  createPayout: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    event: {
      findMany: mocks.eventFindMany,
      findUnique: mocks.eventFindUnique,
      update: mocks.eventUpdate,
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ payouts: { create: mocks.createPayout } }),
}));

import { getPayoutEligibleEvents, runPayoutForEvent } from "@/lib/payout";

const EVENT = {
  id: "event-1",
  title: "Apex Throwdown",
  eventDate: "2026-01-01",
  endDate: null,
  payoutTriggered: false,
  organiser: { id: "org-1", orgName: "Apex", stripeAccountId: "acct_1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventUpdate.mockResolvedValue({});
  mocks.createPayout.mockResolvedValue({ id: "po_1" });
});

describe("getPayoutEligibleEvents", () => {
  it("adds purchased add-on money to the confirmed entry money", async () => {
    mocks.eventFindMany.mockResolvedValue([
      {
        ...EVENT,
        registrations: [{ amountCents: 10000 }, { amountCents: 5500 }],
        addOnPurchases: [{ amountCents: 2500 }, { amountCents: 1200 }],
      },
    ]);
    const [event] = await getPayoutEligibleEvents();
    expect(event.netCents).toBe(19200);
  });

  // Undecided and refunded rows are filtered in the query, so what this asserts
  // is the filter the query is built with.
  it("asks the database for PURCHASED rows only", async () => {
    mocks.eventFindMany.mockResolvedValue([]);
    await getPayoutEligibleEvents();
    const { select } = mocks.eventFindMany.mock.calls[0][0];
    expect(select.addOnPurchases.where).toEqual({ status: { in: ["PURCHASED"] } });
  });

  it("pays out an event that sold merchandise and no entries", async () => {
    mocks.eventFindMany.mockResolvedValue([
      { ...EVENT, registrations: [], addOnPurchases: [{ amountCents: 2500 }] },
    ]);
    const [event] = await getPayoutEligibleEvents();
    expect(event.netCents).toBe(2500);
  });

  it("still filters out an event with nothing to sweep", async () => {
    mocks.eventFindMany.mockResolvedValue([
      { ...EVENT, registrations: [], addOnPurchases: [] },
    ]);
    await expect(getPayoutEligibleEvents()).resolves.toEqual([]);
  });

  it("does not leak the raw rows into the returned event", async () => {
    mocks.eventFindMany.mockResolvedValue([
      { ...EVENT, registrations: [{ amountCents: 100 }], addOnPurchases: [{ amountCents: 200 }] },
    ]);
    const [event] = await getPayoutEligibleEvents();
    const raw = event as unknown as { registrations?: unknown; addOnPurchases?: unknown };
    expect(raw.registrations).toBeUndefined();
    expect(raw.addOnPurchases).toBeUndefined();
  });
});

describe("runPayoutForEvent", () => {
  it("sweeps entries plus purchased add-ons to the connected account", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      ...EVENT,
      registrations: [{ amountCents: 10000 }],
      addOnPurchases: [{ amountCents: 2500 }],
    });

    await expect(runPayoutForEvent("event-1")).resolves.toEqual({ netCents: 12500 });
    expect(mocks.createPayout).toHaveBeenCalledWith(
      { amount: 12500, currency: "aud" },
      { stripeAccount: "acct_1" },
    );
    expect(mocks.eventUpdate.mock.calls[0][0].data).toMatchObject({
      payoutTriggered: true,
      payoutAmountCents: 12500,
    });
  });

  it("asks the database for PURCHASED rows only", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      ...EVENT,
      registrations: [{ amountCents: 100 }],
      addOnPurchases: [],
    });
    await runPayoutForEvent("event-1");
    const { select } = mocks.eventFindUnique.mock.calls[0][0];
    expect(select.addOnPurchases.where).toEqual({ status: { in: ["PURCHASED"] } });
  });

  it("refuses a second sweep of the same event", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      ...EVENT,
      payoutTriggered: true,
      registrations: [{ amountCents: 10000 }],
      addOnPurchases: [],
    });
    await expect(runPayoutForEvent("event-1")).rejects.toThrow(/already triggered/);
    expect(mocks.createPayout).not.toHaveBeenCalled();
  });

  it("refuses when there is nothing to pay out", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      ...EVENT,
      registrations: [],
      addOnPurchases: [],
    });
    await expect(runPayoutForEvent("event-1")).rejects.toThrow(/Nothing to pay out/);
    expect(mocks.createPayout).not.toHaveBeenCalled();
  });
});
