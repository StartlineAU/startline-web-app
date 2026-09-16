import { describe, it, expect } from "vitest";
import {
  emptyAddOnDraft,
  emptyVariantDraft,
  draftsFromCatalogue,
  draftsToPayload,
  draftValidationError,
  parsePriceToCents,
  parseStock,
  hasPurchaseHistory,
  draftKey,
  type AddOnDraft,
  type AddOnVariantDraft,
} from "@/lib/add-on-drafts";
import { sanitizeAddOnInput, MAX_ADD_ONS, MAX_ADDON_VARIANTS } from "@/lib/add-ons";

function variant(overrides: Partial<AddOnVariantDraft> = {}): AddOnVariantDraft {
  return { uid: draftKey(), label: "M", stock: "10", sold: 0, purchased: 0, ...overrides };
}

function draft(overrides: Partial<AddOnDraft> = {}): AddOnDraft {
  return {
    uid: draftKey(),
    name: "Event tee",
    description: "",
    price: "25.00",
    image: null,
    imageUrl: "",
    optionLabel: "Size",
    variants: [variant()],
    ...overrides,
  };
}

describe("parsePriceToCents", () => {
  it.each([
    ["25", 2500],
    ["25.00", 2500],
    ["25.5", 2550],
    ["0", 0],
    ["$25.00", 2500],
    ["  25.00  ", 2500],
    ["1.70", 170],
  ])("parses %s to %i cents", (input, expected) => {
    expect(parsePriceToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "25.005", "-5", "1e3", "25,00"])("rejects %s", (input) => {
    expect(parsePriceToCents(input)).toBeNull();
  });
});

describe("parseStock", () => {
  it.each([["0", 0], ["10", 10], ["  7 ", 7]])("parses %s to %i", (input, expected) => {
    expect(parseStock(input)).toBe(expected);
  });

  it.each(["", "-1", "1.5", "ten"])("rejects %s", (input) => {
    expect(parseStock(input)).toBeNull();
  });
});

describe("emptyAddOnDraft", () => {
  it("starts with sizes, because most merchandise is sized", () => {
    expect(emptyAddOnDraft().variants.map((v) => v.label)).toEqual(["S", "M", "L"]);
  });

  it("starts a new option with nothing sold against it", () => {
    expect(emptyVariantDraft()).toMatchObject({ sold: 0, purchased: 0 });
  });
});

describe("draftKey", () => {
  // React keys unsaved rows on this. If two rows shared one, reordering would
  // hand one row's component state to another.
  it("is unique per call", () => {
    const keys = Array.from({ length: 50 }, () => draftKey());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every new product and option its own key", () => {
    const a = emptyAddOnDraft();
    const b = emptyAddOnDraft();
    const keys = [a.uid, b.uid, ...a.variants.map((v) => v.uid), ...b.variants.map((v) => v.uid)];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("draftsFromCatalogue", () => {
  it("round trips a saved catalogue back into editable drafts", () => {
    const drafts = draftsFromCatalogue([
      {
        id: "a1",
        name: "Event tee",
        description: "Cotton",
        priceCents: 2500,
        imageUrl: "/u/tee.png",
        optionLabel: "Size",
        sortOrder: 0,
        active: true,
        variants: [
          { id: "v1", label: "M", code: "aaa111", stock: 10, sold: 3, purchased: 4, remaining: 7, sortOrder: 0, active: true },
        ],
      },
    ]);
    expect(drafts[0]).toMatchObject({ id: "a1", name: "Event tee", price: "25.00", imageUrl: "/u/tee.png" });
    expect(drafts[0].variants[0]).toMatchObject({ id: "v1", label: "M", stock: "10", sold: 3, purchased: 4 });
  });

  // A saved row already has a unique server id, so it is the editing key too
  // rather than a second identifier meaning the same thing.
  it("keys a saved row on its server id", () => {
    const drafts = draftsFromCatalogue([
      {
        id: "a1",
        name: "Event tee",
        description: null,
        priceCents: 2500,
        imageUrl: null,
        optionLabel: "Size",
        sortOrder: 0,
        active: true,
        variants: [
          { id: "v1", label: "M", code: "aaa111", stock: 10, sold: 0, purchased: 0, remaining: 10, sortOrder: 0, active: true },
        ],
      },
    ]);
    expect(drafts[0].uid).toBe("a1");
    expect(drafts[0].variants[0].uid).toBe("v1");
  });
});

describe("hasPurchaseHistory", () => {
  it("is true once anything has ever been bought, refunds included", () => {
    // Refunded rows free their stock but must still block deletion.
    expect(hasPurchaseHistory(draft({ variants: [variant({ stock: "5", purchased: 2 })] }))).toBe(true);
  });

  it("is false for a product nobody has touched", () => {
    expect(hasPurchaseHistory(draft())).toBe(false);
  });
});

describe("draftValidationError", () => {
  it("accepts a well-formed catalogue", () => {
    expect(draftValidationError([draft()])).toBeNull();
  });

  it("accepts an empty catalogue", () => {
    expect(draftValidationError([])).toBeNull();
  });

  it("requires a name", () => {
    expect(draftValidationError([draft({ name: "  " })])).toBe("Every add-on needs a name.");
  });

  it("rejects two products with the same name", () => {
    expect(draftValidationError([draft(), draft()])).toMatch(/Duplicate add-on name/);
  });

  it("requires a parseable price", () => {
    expect(draftValidationError([draft({ price: "free" })])).toMatch(/needs a price/);
  });

  it("requires at least one option", () => {
    expect(draftValidationError([draft({ variants: [] })])).toMatch(/needs at least one size option/);
  });

  it("rejects two options with the same name", () => {
    const d = draft({
      variants: [
        variant({ label: "M", stock: "1" }),
        variant({ label: "m", stock: "1" }),
      ],
    });
    expect(draftValidationError([d])).toMatch(/two options called/);
  });

  it("requires a stock number on every option", () => {
    expect(
      draftValidationError([draft({ variants: [variant({ stock: "" })] })]),
    ).toMatch(/needs a number of units/);
  });

  // The organiser must not be able to make remaining stock go negative.
  it("refuses stock below what has already sold, and says what to set it to", () => {
    const d = draft({ variants: [variant({ stock: "2", sold: 5, purchased: 5 })] });
    expect(draftValidationError([d])).toBe(
      '"Event tee - M" has already sold 5. Set its stock to 5 or more.',
    );
  });

  it("allows stock set exactly to what has sold", () => {
    expect(
      draftValidationError([draft({ variants: [variant({ stock: "5", sold: 5, purchased: 5 })] })]),
    ).toBeNull();
  });

  it("caps the number of products", () => {
    const many = Array.from({ length: MAX_ADD_ONS + 1 }, (_, i) => draft({ name: `Item ${i}` }));
    expect(draftValidationError(many)).toMatch(/at most/);
  });

  it("caps the number of options", () => {
    const d = draft({
      variants: Array.from({ length: MAX_ADDON_VARIANTS + 1 }, (_, i) =>
        variant({ label: `Size ${i}`, stock: "1" }),
      ),
    });
    expect(draftValidationError([d])).toMatch(/at most/);
  });
});

describe("draftsToPayload", () => {
  // uid is an editing concern. Sending it would put an unknown field in front of
  // the route's sanitizer for no reason.
  it("never sends the editing key to the API", () => {
    const payload = draftsToPayload([draft({ id: "a1" })]);
    expect(payload[0]).not.toHaveProperty("uid");
    expect(payload[0].variants[0]).not.toHaveProperty("uid");
  });

  it("converts dollars to whole cents and trims text", () => {
    const payload = draftsToPayload([
      draft({ name: "  Event tee  ", price: "25.5", description: "  Cotton  " }),
    ]);
    expect(payload[0]).toMatchObject({
      name: "Event tee",
      description: "Cotton",
      priceCents: 2550,
      imageUrl: null,
      optionLabel: "Size",
    });
    expect(payload[0].variants[0]).toEqual({ label: "M", stock: 10 });
  });

  it("omits ids for new rows and keeps them for existing ones", () => {
    const payload = draftsToPayload([
      draft({ id: "a1", variants: [variant({ id: "v1", stock: "3" })] }),
      draft({ name: "Cap" }),
    ]);
    expect(payload[0].id).toBe("a1");
    expect(payload[0].variants[0].id).toBe("v1");
    expect(payload[1]).not.toHaveProperty("id");
    expect(payload[1].variants[0]).not.toHaveProperty("id");
  });

  // The editor blocks a bad save, but the server is the real gate.
  it("produces payloads the server accepts", () => {
    const payload = draftsToPayload([draft(), draft({ name: "Cap", price: "15" })]);
    const sanitized = sanitizeAddOnInput(payload);
    expect(Array.isArray(sanitized)).toBe(true);
  });
});

describe("sanitizeAddOnInput", () => {
  const valid = [
    {
      name: "Event tee",
      description: null,
      priceCents: 2500,
      imageUrl: null,
      optionLabel: "Size",
      variants: [{ label: "M", stock: 10 }],
    },
  ];

  it("accepts a well-formed catalogue", () => {
    expect(sanitizeAddOnInput(valid)).toHaveLength(1);
  });

  it("accepts an empty catalogue", () => {
    expect(sanitizeAddOnInput([])).toEqual([]);
  });

  it("rejects a non-array", () => {
    expect(sanitizeAddOnInput("nope")).toEqual({ error: "addOns must be an array." });
  });

  it("rejects a fractional or negative price", () => {
    expect(sanitizeAddOnInput([{ ...valid[0], priceCents: 25.5 }])).toHaveProperty("error");
    expect(sanitizeAddOnInput([{ ...valid[0], priceCents: -1 }])).toHaveProperty("error");
  });

  it("rejects a fractional or negative stock", () => {
    expect(sanitizeAddOnInput([{ ...valid[0], variants: [{ label: "M", stock: 1.5 }] }])).toHaveProperty("error");
    expect(sanitizeAddOnInput([{ ...valid[0], variants: [{ label: "M", stock: -1 }] }])).toHaveProperty("error");
  });

  it("defaults a missing option label rather than failing", () => {
    const result = sanitizeAddOnInput([{ ...valid[0], optionLabel: "" }]);
    expect(Array.isArray(result) && result[0].optionLabel).toBe("Size");
  });

  it("trims and normalises text", () => {
    const result = sanitizeAddOnInput([{ ...valid[0], name: "  Tee  ", description: "   " }]);
    expect(Array.isArray(result) && result[0].name).toBe("Tee");
    expect(Array.isArray(result) && result[0].description).toBeNull();
  });
});
