import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireOrganiser: vi.fn(),
  eventFindUnique: vi.fn(),
  transaction: vi.fn(),
  catalogueForEvent: vi.fn(),
  heldByVariant: vi.fn(),
  purchaseCountByVariant: vi.fn(),
  addOnFindMany: vi.fn(),
  addOnCreate: vi.fn(),
  addOnUpdate: vi.fn(),
  addOnDelete: vi.fn(),
  variantFindMany: vi.fn(),
  variantCreate: vi.fn(),
  variantUpdate: vi.fn(),
  variantUpdateMany: vi.fn(),
  variantDelete: vi.fn(),
  merchandiseFindMany: vi.fn(),
}));

vi.mock("@/lib/organiser-api-auth", () => ({ requireOrganiser: mocks.requireOrganiser }));

vi.mock("@/lib/prisma", () => ({
  default: {
    event: { findUnique: mocks.eventFindUnique },
    organiserMerchandise: { findMany: mocks.merchandiseFindMany },
    $transaction: mocks.transaction,
  },
}));

// The read layer has its own tests; here it is a dial so each case can state
// exactly what has been sold without building purchase rows.
vi.mock("@/lib/add-on-catalogue", () => ({
  catalogueForEvent: mocks.catalogueForEvent,
  heldByVariant: mocks.heldByVariant,
  purchaseCountByVariant: mocks.purchaseCountByVariant,
}));

import { GET, PUT } from "@/app/api/organiser/events/[id]/add-ons/route";

const ORGANISER = "org-1";
const EVENT = "e1";

const tx = {
  eventAddOn: {
    findMany: mocks.addOnFindMany,
    create: mocks.addOnCreate,
    update: mocks.addOnUpdate,
    delete: mocks.addOnDelete,
  },
  eventAddOnVariant: {
    findMany: mocks.variantFindMany,
    create: mocks.variantCreate,
    update: mocks.variantUpdate,
    updateMany: mocks.variantUpdateMany,
    delete: mocks.variantDelete,
  },
};

const tee = (over: Record<string, unknown> = {}) => ({
  name: "Event tee",
  description: null,
  priceCents: 2500,
  imageUrl: null,
  optionLabel: "Size",
  variants: [{ label: "M", stock: 10 }],
  ...over,
});

const put = (addOns: unknown) =>
  PUT(
    new NextRequest(`http://localhost/api/organiser/events/${EVENT}/add-ons`, {
      method: "PUT",
      body: JSON.stringify({ addOns }),
    }),
    { params: Promise.resolve({ id: EVENT }) },
  );

const get = () =>
  GET(new NextRequest(`http://localhost/api/organiser/events/${EVENT}/add-ons`), {
    params: Promise.resolve({ id: EVENT }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOrganiser.mockResolvedValue({ error: null, session: { sub: ORGANISER } });
  mocks.eventFindUnique.mockResolvedValue({
    id: EVENT,
    organiserId: ORGANISER,
    feeStructure: "athlete",
  });
  mocks.catalogueForEvent.mockResolvedValue([]);
  mocks.heldByVariant.mockResolvedValue({});
  mocks.purchaseCountByVariant.mockResolvedValue({});
  mocks.addOnFindMany.mockResolvedValue([]);
  mocks.variantFindMany.mockResolvedValue([]);
  mocks.addOnCreate.mockResolvedValue({ id: "new-addon" });
  mocks.addOnUpdate.mockImplementation(({ where }: { where: { id: string } }) => ({ id: where.id }));
  mocks.transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  mocks.merchandiseFindMany.mockResolvedValue([]);
});

describe("GET /api/organiser/events/[id]/add-ons", () => {
  it("returns the catalogue and the event's fee structure", async () => {
    mocks.catalogueForEvent.mockResolvedValue([{ id: "a1" }]);
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ addOns: [{ id: "a1" }], feeStructure: "athlete" });
  });

  it("passes an auth failure straight through", async () => {
    mocks.requireOrganiser.mockResolvedValue({
      error: NextResponse.json({ error: "nope" }, { status: 403 }),
      session: null,
    });
    expect((await get()).status).toBe(403);
  });

  it("404s an event that does not exist", async () => {
    mocks.eventFindUnique.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it("403s an event belonging to another organiser", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      id: EVENT,
      organiserId: "someone-else",
      feeStructure: "athlete",
    });
    expect((await get()).status).toBe(403);
  });
});

describe("PUT /api/organiser/events/[id]/add-ons", () => {
  it("400s on input the sanitizer rejects, with the organiser's message", async () => {
    const res = await put([tee({ name: "" })]);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Every add-on needs a name.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  // Remaining stock is derived, so letting stock drop below what is held would
  // make it go negative and the picking list would lie to the organiser.
  it("409s when stock is set below what the variant has already sold", async () => {
    mocks.heldByVariant.mockResolvedValue({ v1: 5 });
    const res = await put([tee({ id: "a1", variants: [{ id: "v1", label: "M", stock: 2 }] })]);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      '"Event tee - M" has already sold 5. Set its stock to 5 or more.',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows stock set exactly to what has sold", async () => {
    mocks.heldByVariant.mockResolvedValue({ v1: 5 });
    mocks.addOnFindMany.mockResolvedValue([{ id: "a1", variants: [{ id: "v1", code: "aaa111" }] }]);
    mocks.variantFindMany.mockResolvedValue([{ id: "v1" }]);
    const res = await put([tee({ id: "a1", variants: [{ id: "v1", label: "M", stock: 5 }] })]);
    expect(res.status).toBe(200);
  });

  it("deletes a removed product nobody has ever bought", async () => {
    mocks.addOnFindMany.mockResolvedValue([{ id: "a1", variants: [{ id: "v1", code: "aaa111" }] }]);
    await put([]);
    expect(mocks.addOnDelete).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(mocks.addOnUpdate).not.toHaveBeenCalled();
  });

  // The rule the schema also enforces with onDelete: Restrict. A refunded row
  // frees its stock but still has to keep its receipt, so it blocks deletion.
  it("retires a removed product with purchase history instead of deleting it", async () => {
    mocks.addOnFindMany.mockResolvedValue([{ id: "a1", variants: [{ id: "v1", code: "aaa111" }] }]);
    mocks.purchaseCountByVariant.mockResolvedValue({ v1: 1 });

    await put([]);

    expect(mocks.addOnDelete).not.toHaveBeenCalled();
    expect(mocks.addOnUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { active: false },
    });
    expect(mocks.variantUpdateMany).toHaveBeenCalledWith({
      where: { addOnId: "a1" },
      data: { active: false },
    });
  });

  it("retires a removed option with purchase history and deletes one without", async () => {
    mocks.addOnFindMany.mockResolvedValue([
      { id: "a1", variants: [{ id: "v1", code: "aaa111" }, { id: "v2", code: "bbb222" }] },
    ]);
    mocks.variantFindMany.mockResolvedValue([{ id: "v1" }, { id: "v2" }]);
    mocks.purchaseCountByVariant.mockResolvedValue({ v1: 2 });

    // Both options dropped, the product kept.
    await put([tee({ id: "a1", variants: [{ label: "L", stock: 4 }] })]);

    expect(mocks.variantUpdate).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { active: false },
    });
    expect(mocks.variantDelete).toHaveBeenCalledWith({ where: { id: "v2" } });
    expect(mocks.variantDelete).not.toHaveBeenCalledWith({ where: { id: "v1" } });
  });

  it("never reissues a code an in-flight payment could still refer to", async () => {
    mocks.addOnFindMany.mockResolvedValue([{ id: "a1", variants: [{ id: "v1", code: "aaa111" }] }]);
    mocks.variantFindMany.mockResolvedValue([{ id: "v1" }]);

    await put([
      tee({ id: "a1", variants: [{ id: "v1", label: "M", stock: 10 }, { label: "L", stock: 4 }] }),
    ]);

    const created = mocks.variantCreate.mock.calls.map((c) => c[0].data);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ addOnId: "a1", eventId: EVENT, label: "L", stock: 4 });
    expect(created[0].code).toMatch(/^[a-z0-9]{6}$/);
    expect(created[0].code).not.toBe("aaa111");
  });

  // An id the client sent that belongs to another event must never become a
  // cross-event write.
  it("treats an unknown product id as a create, not an update", async () => {
    await put([tee({ id: "someone-elses-addon" })]);
    expect(mocks.addOnUpdate).not.toHaveBeenCalled();
    expect(mocks.addOnCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventId: EVENT }) }),
    );
  });

  it("does not reuse a variant row that belongs to a different product", async () => {
    mocks.addOnFindMany.mockResolvedValue([
      { id: "a1", variants: [{ id: "v1", code: "aaa111" }] },
      { id: "a2", variants: [] },
    ]);
    // v1 is a variant of a1, but the client sent it under a2.
    mocks.variantFindMany.mockResolvedValue([]);

    await put([tee({ id: "a2", variants: [{ id: "v1", label: "M", stock: 3 }] })]);

    expect(mocks.variantUpdate).not.toHaveBeenCalled();
    expect(mocks.variantCreate).toHaveBeenCalled();
  });

  it("writes sortOrder from the order the organiser arranged them in", async () => {
    await put([tee({ name: "Cap" }), tee({ name: "Event tee" })]);
    const orders = mocks.addOnCreate.mock.calls.map((c) => [c[0].data.name, c[0].data.sortOrder]);
    expect(orders).toEqual([
      ["Cap", 0],
      ["Event tee", 1],
    ]);
  });

  it("reactivates a retired product the organiser puts back", async () => {
    mocks.addOnFindMany.mockResolvedValue([{ id: "a1", variants: [] }]);
    await put([tee({ id: "a1" })]);
    expect(mocks.addOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "a1" },
        data: expect.objectContaining({ active: true }),
      }),
    );
  });

  it("explains a duplicate option name rather than leaking a Prisma code", async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" }),
    );
    const res = await put([tee()]);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Two options can't share a name.");
  });

  it("tells the organiser to reload when a sale lands mid-save", async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "7" }),
    );
    const res = await put([tee()]);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/bought one of these while you were editing/i);
  });

  it("returns the saved catalogue with live stock", async () => {
    mocks.catalogueForEvent.mockResolvedValue([{ id: "a1", name: "Event tee" }]);
    const res = await put([tee()]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ addOns: [{ id: "a1", name: "Event tee" }] });
  });

  it("accepts an empty catalogue as a clear-everything", async () => {
    expect((await put([])).status).toBe(200);
  });

  it("403s an event belonging to another organiser before touching anything", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      id: EVENT,
      organiserId: "someone-else",
      feeStructure: "athlete",
    });
    expect((await put([tee()])).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

// The link from an event's product to the organiser's profile item it came
// from (#338). Provenance only, so an unusable link is dropped, never refused.
describe("PUT add-ons: profile merchandise links", () => {
  it("keeps a link to the organiser's own profile item", async () => {
    mocks.merchandiseFindMany.mockResolvedValue([{ id: "m1" }]);
    expect((await put([tee({ merchandiseId: "m1" })])).status).toBe(200);
    expect(mocks.merchandiseFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["m1"] }, organiserId: ORGANISER },
      select: { id: true },
    });
    expect(mocks.addOnCreate.mock.calls[0][0].data.merchandiseId).toBe("m1");
  });

  it("drops a link to another organiser's item instead of saving it", async () => {
    mocks.merchandiseFindMany.mockResolvedValue([]);
    expect((await put([tee({ merchandiseId: "not-mine" })])).status).toBe(200);
    expect(mocks.addOnCreate.mock.calls[0][0].data.merchandiseId).toBeNull();
  });

  it("clears the link when the client no longer sends one", async () => {
    mocks.addOnFindMany.mockResolvedValue([{ id: "a1", variants: [] }]);
    await put([tee({ id: "a1" })]);
    expect(mocks.addOnUpdate.mock.calls[0][0].data.merchandiseId).toBeNull();
  });

  it("skips the lookup when nothing is linked", async () => {
    await put([tee()]);
    expect(mocks.merchandiseFindMany).not.toHaveBeenCalled();
  });
});
