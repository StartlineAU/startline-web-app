import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  addOnFindMany: vi.fn(),
  variantFindMany: vi.fn(),
  purchaseGroupBy: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    eventAddOn: { findMany: mocks.addOnFindMany },
    eventAddOnVariant: { findMany: mocks.variantFindMany },
    registrationAddOn: { groupBy: mocks.purchaseGroupBy },
  },
}));

import {
  catalogueVariantsForEvent,
  catalogueForEvent,
  heldByVariant,
  stockByVariant,
  purchaseCountByVariant,
  hasBuyableAddOns,
  type CatalogueAddOnView,
} from "@/lib/add-on-catalogue";
import { STOCK_HOLDING_STATUSES } from "@/lib/add-on-stock";

/** A product row shaped the way catalogueForEvent's include returns it. */
function addOnRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "a1",
    name: "Event tee",
    description: "Cotton",
    priceCents: 2500,
    imageUrl: "/u/tee.png",
    optionLabel: "Size",
    sortOrder: 0,
    active: true,
    variants: [
      { id: "v1", label: "M", code: "aaa111", stock: 10, sortOrder: 0, active: true },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.addOnFindMany.mockResolvedValue([]);
  mocks.variantFindMany.mockResolvedValue([]);
  mocks.purchaseGroupBy.mockResolvedValue([]);
});

describe("catalogueVariantsForEvent", () => {
  beforeEach(() => {
    mocks.variantFindMany.mockResolvedValue([
      {
        id: "v1",
        addOnId: "a1",
        code: "aaa111",
        label: "M",
        addOn: { name: "Event tee", optionLabel: "Size", priceCents: 2500, imageUrl: "/u/tee.png" },
      },
    ]);
  });

  it("flattens the product onto each variant, ready to price", async () => {
    expect(await catalogueVariantsForEvent("e1")).toEqual([
      {
        variantId: "v1",
        addOnId: "a1",
        code: "aaa111",
        name: "Event tee",
        optionLabel: "Size",
        variantLabel: "M",
        imageUrl: "/u/tee.png",
        unitPriceCents: 2500,
      },
    ]);
  });

  // The invariant lib/add-on-pricing.ts documents on priceAddOnSelection: "The
  // catalogue passed in must NOT be filtered by active." A product retired
  // between the athlete paying and the webhook arriving still has to price the
  // purchase in flight, or the webhook fails its total check and cancels a paid
  // order. Filtering to what is buyable is the point-of-sale's job.
  it("does not filter by active, so a retired product still prices a payment in flight", async () => {
    await catalogueVariantsForEvent("e1");
    const where = mocks.variantFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ eventId: "e1" });
    expect(where).not.toHaveProperty("active");
    expect(JSON.stringify(where)).not.toContain("active");
  });

  it("runs inside a caller's transaction when given one", async () => {
    const tx = { eventAddOnVariant: { findMany: vi.fn().mockResolvedValue([]) } };
    await catalogueVariantsForEvent(
      "e1",
      tx as unknown as Parameters<typeof catalogueVariantsForEvent>[1],
    );
    expect(tx.eventAddOnVariant.findMany).toHaveBeenCalled();
    expect(mocks.variantFindMany).not.toHaveBeenCalled();
  });
});

describe("heldByVariant", () => {
  it("counts only the statuses that hold stock", async () => {
    mocks.purchaseGroupBy.mockResolvedValue([{ variantId: "v1", _sum: { quantity: 3 } }]);
    expect(await heldByVariant("e1")).toEqual({ v1: 3 });
    expect(mocks.purchaseGroupBy.mock.calls[0][0].where).toEqual({
      eventId: "e1",
      status: { in: [...STOCK_HOLDING_STATUSES] },
    });
  });

  it("reads a null sum as zero rather than NaN", async () => {
    mocks.purchaseGroupBy.mockResolvedValue([{ variantId: "v1", _sum: { quantity: null } }]);
    expect(await heldByVariant("e1")).toEqual({ v1: 0 });
  });
});

describe("stockByVariant", () => {
  it("maps each variant to its declared total", async () => {
    mocks.variantFindMany.mockResolvedValue([
      { id: "v1", stock: 10 },
      { id: "v2", stock: 0 },
    ]);
    expect(await stockByVariant("e1")).toEqual({ v1: 10, v2: 0 });
  });
});

describe("purchaseCountByVariant", () => {
  // Distinct from heldByVariant on purpose: a refunded item frees its stock but
  // its purchase history must still survive, so it blocks deletion while no
  // longer blocking a sale.
  it("counts rows in every status, refunded and cancelled included", async () => {
    mocks.purchaseGroupBy.mockResolvedValue([{ variantId: "v1", _count: { _all: 2 } }]);
    expect(await purchaseCountByVariant("e1")).toEqual({ v1: 2 });
    expect(mocks.purchaseGroupBy.mock.calls[0][0].where).toEqual({ eventId: "e1" });
  });
});

describe("catalogueForEvent", () => {
  it("derives remaining stock from what is held, not a counter", async () => {
    mocks.addOnFindMany.mockResolvedValue([addOnRow()]);
    mocks.purchaseGroupBy
      .mockResolvedValueOnce([{ variantId: "v1", _sum: { quantity: 4 } }]) // held
      .mockResolvedValueOnce([{ variantId: "v1", _count: { _all: 6 } }]); // ever purchased

    const [addOn] = await catalogueForEvent("e1");
    expect(addOn.variants[0]).toMatchObject({ stock: 10, sold: 4, purchased: 6, remaining: 6 });
  });

  it("never reports negative remaining stock when a variant is oversold", async () => {
    mocks.addOnFindMany.mockResolvedValue([
      addOnRow({ variants: [{ id: "v1", label: "M", code: "aaa111", stock: 2, sortOrder: 0, active: true }] }),
    ]);
    mocks.purchaseGroupBy
      .mockResolvedValueOnce([{ variantId: "v1", _sum: { quantity: 5 } }])
      .mockResolvedValueOnce([{ variantId: "v1", _count: { _all: 5 } }]);

    const [addOn] = await catalogueForEvent("e1");
    expect(addOn.variants[0].remaining).toBe(0);
  });

  it("treats a variant nobody has touched as fully available", async () => {
    mocks.addOnFindMany.mockResolvedValue([addOnRow()]);
    const [addOn] = await catalogueForEvent("e1");
    expect(addOn.variants[0]).toMatchObject({ sold: 0, purchased: 0, remaining: 10 });
  });

  // The organiser editor needs retired rows to render them as retired; only the
  // athlete's picker asks for activeOnly.
  it("returns retired products by default", async () => {
    await catalogueForEvent("e1");
    const args = mocks.addOnFindMany.mock.calls[0][0];
    expect(args.where).toEqual({ eventId: "e1" });
    expect(args.include.variants.where).toBeUndefined();
  });

  it("filters both products and variants to active when asked", async () => {
    await catalogueForEvent("e1", { activeOnly: true });
    const args = mocks.addOnFindMany.mock.calls[0][0];
    expect(args.where).toEqual({ eventId: "e1", active: true });
    expect(args.include.variants.where).toEqual({ active: true });
  });

  it("orders products and variants by sortOrder, then by age", async () => {
    await catalogueForEvent("e1");
    const args = mocks.addOnFindMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ sortOrder: "asc" }, { createdAt: "asc" }]);
    expect(args.include.variants.orderBy).toEqual([{ sortOrder: "asc" }, { createdAt: "asc" }]);
  });
});

describe("hasBuyableAddOns", () => {
  const view = (over: Partial<CatalogueAddOnView> = {}): CatalogueAddOnView => ({
    id: "a1",
    name: "Event tee",
    description: null,
    priceCents: 2500,
    imageUrl: null,
    optionLabel: "Size",
    merchandiseId: null,
    sortOrder: 0,
    active: true,
    variants: [
      { id: "v1", label: "M", code: "aaa111", stock: 10, sold: 0, purchased: 0, remaining: 10, sortOrder: 0, active: true },
    ],
    ...over,
  });

  it("is true when something is active and in stock", () => {
    expect(hasBuyableAddOns([view()])).toBe(true);
  });

  it("is false for an empty catalogue", () => {
    expect(hasBuyableAddOns([])).toBe(false);
  });

  it("is false when the only product is retired", () => {
    expect(hasBuyableAddOns([view({ active: false })])).toBe(false);
  });

  it("is false when every variant is sold out", () => {
    const sold = view();
    sold.variants[0] = { ...sold.variants[0], sold: 10, remaining: 0 };
    expect(hasBuyableAddOns([sold])).toBe(false);
  });

  it("is false when every variant is retired", () => {
    const retired = view();
    retired.variants[0] = { ...retired.variants[0], active: false };
    expect(hasBuyableAddOns([retired])).toBe(false);
  });
});
