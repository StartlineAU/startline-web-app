import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  MAX_PROFILE_MERCHANDISE,
  sanitizeMerchandiseInput,
  sanitizeMerchandiseItem,
  type MerchandiseView,
} from "@/lib/merchandise";
import {
  draftFromMerchandise,
  draftsFromMerchandise,
  draftToMerchandiseItem,
  draftValidationError,
  draftsToPayload,
  emptyAddOnDraft,
} from "@/lib/add-on-drafts";
import { sanitizeAddOnInput } from "@/lib/add-ons";

const mocks = vi.hoisted(() => ({
  requireOrganiser: vi.fn(),
  merchandiseForOrganiser: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/organiser-api-auth", () => ({ requireOrganiser: mocks.requireOrganiser }));
vi.mock("@/lib/merchandise-catalogue", () => ({ merchandiseForOrganiser: mocks.merchandiseForOrganiser }));

const merchandiseTable = {
  findMany: mocks.findMany,
  create: mocks.create,
  update: mocks.update,
  deleteMany: mocks.deleteMany,
};
vi.mock("@/lib/prisma", () => ({
  default: {
    organiserMerchandise: {
      findMany: (...a: unknown[]) => mocks.findMany(...a),
      create: (...a: unknown[]) => mocks.create(...a),
    },
    $transaction: mocks.transaction,
  },
}));

import { POST, PUT } from "@/app/api/organiser/merchandise/route";

const ORGANISER = "org-1";

const tee = (over: Record<string, unknown> = {}) => ({
  name: "Club tee",
  description: null,
  priceCents: 3500,
  imageUrl: null,
  optionLabel: "Size",
  options: ["S", "M", "L"],
  ...over,
});

const view = (over: Partial<MerchandiseView> = {}): MerchandiseView => ({
  id: "m1",
  name: "Club tee",
  description: "Cotton",
  priceCents: 3500,
  imageUrl: "/u/tee.png",
  optionLabel: "Size",
  options: ["S", "M"],
  ...over,
});

describe("sanitizeMerchandiseItem", () => {
  it("normalises a valid item", () => {
    expect(sanitizeMerchandiseItem(tee({ name: "  Club tee ", options: [" S ", "M"] }))).toEqual({
      name: "Club tee",
      description: null,
      priceCents: 3500,
      imageUrl: null,
      optionLabel: "Size",
      options: ["S", "M"],
    });
  });

  it("rejects an item with no options", () => {
    expect(sanitizeMerchandiseItem(tee({ options: [] }))).toEqual({
      error: '"Club tee" needs at least one size option.',
    });
  });

  it("rejects duplicate options regardless of case", () => {
    expect(sanitizeMerchandiseItem(tee({ options: ["M", "m"] }))).toEqual({
      error: '"Club tee" has two options called "m".',
    });
  });

  it("rejects a fractional or negative price", () => {
    expect("error" in sanitizeMerchandiseItem(tee({ priceCents: 12.5 }))).toBe(true);
    expect("error" in sanitizeMerchandiseItem(tee({ priceCents: -1 }))).toBe(true);
  });
});

describe("sanitizeMerchandiseInput", () => {
  it("rejects two items with the same name", () => {
    expect(sanitizeMerchandiseInput([tee(), tee({ name: "club TEE" })])).toEqual({
      error: 'Duplicate item name "club TEE".',
    });
  });

  it("caps the list", () => {
    const many = Array.from({ length: MAX_PROFILE_MERCHANDISE + 1 }, (_, i) => tee({ name: `Item ${i}` }));
    expect(sanitizeMerchandiseInput(many)).toEqual({
      error: `Your profile can show at most ${MAX_PROFILE_MERCHANDISE} items.`,
    });
  });
});

describe("profile drafts", () => {
  it("copies a profile item into an event with blank stock and the link kept", () => {
    const draft = draftFromMerchandise(view());
    expect(draft).toMatchObject({ name: "Club tee", price: "35.00", merchandiseId: "m1" });
    expect(draft.id).toBeUndefined();
    expect(draft.variants.map((v) => [v.label, v.stock])).toEqual([["S", ""], ["M", ""]]);
  });

  // A copy with blank stock must not slip through: the organiser has to say
  // how many this event has.
  it("makes the organiser set stock before an imported item saves to an event", () => {
    expect(draftValidationError([draftFromMerchandise(view())])).toMatch(/needs a number of units/);
  });

  it("carries the link through to the event payload the server accepts", () => {
    const draft = draftFromMerchandise(view());
    draft.variants.forEach((v) => { v.stock = "5"; });
    const payload = draftsToPayload([draft]);
    expect(payload[0].merchandiseId).toBe("m1");
    const sanitized = sanitizeAddOnInput(payload);
    expect(Array.isArray(sanitized) && sanitized[0].merchandiseId).toBe("m1");
  });

  it("edits the profile list without stock", () => {
    const drafts = draftsFromMerchandise([view()]);
    expect(drafts[0]).toMatchObject({ id: "m1", uid: "m1" });
    expect(drafts[0].merchandiseId).toBeUndefined();
    expect(draftValidationError(drafts, "profile")).toBeNull();
  });

  it("round trips a profile draft into something the server accepts", () => {
    const draft = { ...emptyAddOnDraft(), name: "Cap", price: "20" };
    expect(draftValidationError([draft], "profile")).toBeNull();
    expect(sanitizeMerchandiseItem(draftToMerchandiseItem(draft))).toEqual({
      name: "Cap",
      description: null,
      priceCents: 2000,
      imageUrl: null,
      optionLabel: "Size",
      options: ["S", "M", "L"],
    });
  });
});

const put = (merchandise: unknown) =>
  PUT(new NextRequest("http://localhost/api/organiser/merchandise", {
    method: "PUT",
    body: JSON.stringify({ merchandise }),
  }));

const post = (item: unknown) =>
  POST(new NextRequest("http://localhost/api/organiser/merchandise", {
    method: "POST",
    body: JSON.stringify({ item }),
  }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOrganiser.mockResolvedValue({ error: null, session: { sub: ORGANISER } });
  mocks.merchandiseForOrganiser.mockResolvedValue([]);
  mocks.findMany.mockResolvedValue([]);
  mocks.create.mockResolvedValue({ id: "new" });
  mocks.transaction.mockImplementation((fn: (t: unknown) => unknown) =>
    fn({ organiserMerchandise: merchandiseTable }));
});

describe("PUT /api/organiser/merchandise", () => {
  it("updates kept items, creates new ones and deletes the rest", async () => {
    mocks.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
    const res = await put([tee({ id: "m1" }), tee({ name: "Cap" })]);
    expect(res.status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { organiserId: ORGANISER, id: { notIn: ["m1"] } },
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" }, data: expect.objectContaining({ sortOrder: 0 }) }),
    );
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Cap", organiserId: ORGANISER, sortOrder: 1 }),
    });
  });

  // Only this organiser's ids are updated. Any other id becomes a create
  // owned by this organiser, never a write to someone else's item.
  it("treats another organiser's id as a create", async () => {
    mocks.findMany.mockResolvedValue([]);
    await put([tee({ id: "someone-elses" })]);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create.mock.calls[0][0].data.organiserId).toBe(ORGANISER);
  });

  it("400s an invalid list before touching the database", async () => {
    expect((await put([tee({ options: [] })])).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("POST /api/organiser/merchandise", () => {
  it("adds an item to the end of the list and returns its id", async () => {
    mocks.findMany.mockResolvedValue([{ name: "Cap", sortOrder: 0 }, { name: "Bottle", sortOrder: 3 }]);
    const res = await post(tee());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "new" });
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ organiserId: ORGANISER, sortOrder: 4 });
  });

  it("refuses a name the profile already uses", async () => {
    mocks.findMany.mockResolvedValue([{ name: "club tee", sortOrder: 0 }]);
    expect((await post(tee())).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("refuses once the profile is full", async () => {
    mocks.findMany.mockResolvedValue(
      Array.from({ length: MAX_PROFILE_MERCHANDISE }, (_, i) => ({ name: `Item ${i}`, sortOrder: i })),
    );
    expect((await post(tee())).status).toBe(409);
  });

  it("ignores an id in the body", async () => {
    await post(tee({ id: "m9" }));
    expect(mocks.create.mock.calls[0][0].data.id).toBeUndefined();
  });
});
