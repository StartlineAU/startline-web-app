/**
 * The organiser's in-progress add-on catalogue: the shape the editor binds to,
 * and the conversions between it and the API.
 *
 * Pure, so the money conversion and the validation the organiser sees can be
 * tested without a browser. Prices live as dollar strings while being typed (an
 * input cannot hold a half-typed integer sensibly) and become whole cents only
 * at the boundary.
 */

import {
  MAX_ADD_ONS,
  MAX_ADDON_VARIANTS,
  MAX_ADDON_PRICE_CENTS,
  addOnStockLabel,
} from "@/lib/add-ons";
import type { CatalogueAddOnView } from "@/lib/add-on-catalogue";
import { MAX_PROFILE_MERCHANDISE, type MerchandiseInput, type MerchandiseView } from "@/lib/merchandise";

/**
 * A key that identifies a row for as long as it is being edited, including
 * before it has ever been saved.
 *
 * Distinct from `id`, which only exists once the server has seen the row, and
 * never sent to the API. React needs it: keying an unsaved row on its array
 * index means reordering hands one row's component state to another, so an
 * error shown against one product follows the slot rather than the product.
 */
export function draftKey(): string {
  return crypto.randomUUID();
}

export interface AddOnVariantDraft {
  /** Stable while editing. See draftKey. */
  uid: string;
  /** Present once saved. Absent means "create me". */
  id?: string;
  label: string;
  /** Total units made available, as typed. */
  stock: string;
  /** Units held by live purchases. Read-only, from the server. */
  sold: number;
  /** Rows in any status. Non-zero means this can only be retired, not deleted. */
  purchased: number;
}

export interface AddOnDraft {
  /** Stable while editing. See draftKey. */
  uid: string;
  id?: string;
  name: string;
  description: string;
  /** Dollars, as typed, e.g. "25" or "25.00". */
  price: string;
  /** Chosen but not yet uploaded. */
  image: File | null;
  /** Uploaded, or loaded from the server. */
  imageUrl: string;
  optionLabel: string;
  variants: AddOnVariantDraft[];
  /**
   * Event add-ons only: the profile item this was copied from or published
   * to. Set means it is already on the organiser's public profile.
   */
  merchandiseId?: string;
  /**
   * Event add-ons only: publish a copy to the organiser's public profile on
   * the next save. Cleared once merchandiseId is set.
   */
  publishToProfile?: boolean;
}

export function emptyVariantDraft(label = ""): AddOnVariantDraft {
  return { uid: draftKey(), label, stock: "", sold: 0, purchased: 0 };
}

export function emptyAddOnDraft(): AddOnDraft {
  return {
    uid: draftKey(),
    name: "",
    description: "",
    price: "",
    image: null,
    imageUrl: "",
    optionLabel: "Size",
    // Most merchandise is sized, so start where the organiser probably is.
    variants: [emptyVariantDraft("S"), emptyVariantDraft("M"), emptyVariantDraft("L")],
  };
}

/** Server catalogue → editable drafts. */
export function draftsFromCatalogue(catalogue: CatalogueAddOnView[]): AddOnDraft[] {
  return catalogue.map((addOn) => ({
    // Saved rows already have a unique server id, so reuse it rather than
    // minting a second identifier that means the same thing.
    uid: addOn.id,
    id: addOn.id,
    name: addOn.name,
    description: addOn.description ?? "",
    price: (addOn.priceCents / 100).toFixed(2),
    image: null,
    imageUrl: addOn.imageUrl ?? "",
    optionLabel: addOn.optionLabel,
    ...(addOn.merchandiseId ? { merchandiseId: addOn.merchandiseId } : {}),
    variants: addOn.variants.map((variant) => ({
      uid: variant.id,
      id: variant.id,
      label: variant.label,
      stock: String(variant.stock),
      sold: variant.sold,
      purchased: variant.purchased,
    })),
  }));
}

/**
 * A profile item → a new event add-on. Stock starts blank because the profile
 * holds none: how many shirts this event has is the organiser's call. Keeps the
 * link, so the editor shows it as already on the profile.
 */
export function draftFromMerchandise(item: MerchandiseView): AddOnDraft {
  return {
    uid: draftKey(),
    name: item.name,
    description: item.description ?? "",
    price: (item.priceCents / 100).toFixed(2),
    image: null,
    imageUrl: item.imageUrl ?? "",
    optionLabel: item.optionLabel,
    variants: item.options.map((label) => emptyVariantDraft(label)),
    merchandiseId: item.id,
  };
}

/**
 * The organiser's profile list → editable drafts. Same shape as an event's
 * add-ons so the one editor serves both; stock is unused here.
 */
export function draftsFromMerchandise(items: MerchandiseView[]): AddOnDraft[] {
  return items.map((item) => ({
    ...draftFromMerchandise(item),
    uid: item.id,
    id: item.id,
    merchandiseId: undefined,
  }));
}

/** One draft → a profile item, for the merchandise routes. */
export function draftToMerchandiseItem(draft: AddOnDraft): MerchandiseInput {
  return {
    ...(draft.id ? { id: draft.id } : {}),
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    priceCents: parsePriceToCents(draft.price) ?? 0,
    imageUrl: draft.imageUrl.trim() || null,
    optionLabel: draft.optionLabel.trim() || "Size",
    options: draft.variants.map((variant) => variant.label.trim()),
  };
}

/** Dollars as typed → whole cents. Returns null for anything not a real amount. */
export function parsePriceToCents(price: string): number | null {
  const trimmed = price.trim().replace(/^\$/, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(parseFloat(trimmed) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/** Stock as typed → whole units. Returns null for anything not a count. */
export function parseStock(stock: string): number | null {
  const trimmed = stock.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const units = parseInt(trimmed, 10);
  return Number.isFinite(units) ? units : null;
}

/** Units currently held across a product, which is the floor for its stock. */
export function soldForVariant(variant: AddOnVariantDraft): number {
  return variant.sold;
}

/** True once anything has ever been bought, so the row must be retired, not deleted. */
export function hasPurchaseHistory(draft: AddOnDraft): boolean {
  return draft.variants.some((v) => v.purchased > 0);
}

/**
 * The first problem an organiser needs to fix, phrased the way they should see
 * it, or null when the catalogue is ready to save. Mirrors the server's
 * sanitizeAddOnInput so the editor can block a save that would 400 anyway.
 */
export function draftValidationError(
  drafts: AddOnDraft[],
  /**
   * "profile" validates the organiser's profile list instead of an event's
   * add-ons: a different item limit, and no stock, which the profile has none of.
   */
  mode: "event" | "profile" = "event",
): string | null {
  if (mode === "event" && drafts.length > MAX_ADD_ONS) {
    return `An event can offer at most ${MAX_ADD_ONS} add-ons.`;
  }
  if (mode === "profile" && drafts.length > MAX_PROFILE_MERCHANDISE) {
    return `Your profile can show at most ${MAX_PROFILE_MERCHANDISE} items.`;
  }

  const seenNames = new Set<string>();
  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) return "Every add-on needs a name.";
    if (name.length > 120) return "An add-on name must be 120 characters or fewer.";
    if (seenNames.has(name.toLowerCase())) return `Duplicate add-on name "${name}".`;
    seenNames.add(name.toLowerCase());

    const cents = parsePriceToCents(draft.price);
    if (cents == null) return `"${name}" needs a price, like 25.00.`;
    if (cents > MAX_ADDON_PRICE_CENTS) {
      return `"${name}" cannot cost more than $${MAX_ADDON_PRICE_CENTS / 100}.`;
    }

    if (!draft.optionLabel.trim()) return `"${name}" needs a name for its option group.`;

    if (draft.variants.length === 0) {
      return `"${name}" needs at least one ${draft.optionLabel.trim().toLowerCase()} option.`;
    }
    if (draft.variants.length > MAX_ADDON_VARIANTS) {
      return `"${name}" can have at most ${MAX_ADDON_VARIANTS} options.`;
    }

    const seenLabels = new Set<string>();
    for (const variant of draft.variants) {
      const label = variant.label.trim();
      if (!label) return `Every option on "${name}" needs a name.`;
      if (label.length > 60) return "An option name must be 60 characters or fewer.";
      if (seenLabels.has(label.toLowerCase())) {
        return `"${name}" has two options called "${label}".`;
      }
      seenLabels.add(label.toLowerCase());
      if (mode === "profile") continue;

      const stock = parseStock(variant.stock);
      if (stock == null) {
        return `"${addOnStockLabel(name, label)}" needs a number of units, 0 or more.`;
      }
      if (stock < variant.sold) {
        return (
          `"${addOnStockLabel(name, label)}" has already sold ${variant.sold}. ` +
          `Set its stock to ${variant.sold} or more.`
        );
      }
    }
  }

  return null;
}

export interface AddOnPayloadItem {
  id?: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  optionLabel: string;
  variants: { id?: string; label: string; stock: number }[];
  merchandiseId?: string;
}

/**
 * Drafts → the API body. Call only after draftValidationError returns null;
 * anything unparseable here becomes 0 rather than throwing, and the server
 * validates again regardless.
 */
export function draftsToPayload(drafts: AddOnDraft[]): AddOnPayloadItem[] {
  return drafts.map((draft) => ({
    ...(draft.id ? { id: draft.id } : {}),
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    priceCents: parsePriceToCents(draft.price) ?? 0,
    imageUrl: draft.imageUrl.trim() || null,
    optionLabel: draft.optionLabel.trim() || "Size",
    variants: draft.variants.map((variant) => ({
      ...(variant.id ? { id: variant.id } : {}),
      label: variant.label.trim(),
      stock: parseStock(variant.stock) ?? 0,
    })),
    ...(draft.merchandiseId ? { merchandiseId: draft.merchandiseId } : {}),
  }));
}
