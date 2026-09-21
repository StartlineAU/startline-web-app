/**
 * An organiser's profile merchandise (#338): the public showcase on their
 * profile, and the templates they copy into an event's checkout.
 *
 * Pure, no Prisma. The limits and rules are the add-on ones from lib/add-ons.ts
 * wherever the two overlap, so an item that is valid on the profile is valid
 * when copied into an event, and the other way round.
 *
 * What a profile item deliberately does NOT have is stock. Stock, purchases and
 * refunds belong to one event's sale (EventAddOn). The profile only says what
 * the organiser makes.
 */

import { MAX_ADDON_PRICE_CENTS, MAX_ADDON_VARIANTS } from "@/lib/add-ons";
import { isAllowedImageUrl } from "@/lib/image-urls";

/** Items one organiser can show on their profile. */
export const MAX_PROFILE_MERCHANDISE = 24;

export interface MerchandiseInput {
  /** Present when editing an existing item, absent when creating one. */
  id?: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  optionLabel: string;
  options: string[];
}

/** A profile item as the organiser's editor and the public profile read it. */
export interface MerchandiseView {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  optionLabel: string;
  options: string[];
}

/** A profile item on the public profile, with the live events selling it. */
export interface PublicMerchandiseView extends MerchandiseView {
  events: { id: string; title: string }[];
}

/**
 * Validate and normalise one raw item. Returns an error object rather than
 * throwing, so the route can answer 400 with the message the organiser should
 * see. Messages match sanitizeAddOnInput's for the same mistake.
 */
export function sanitizeMerchandiseItem(raw: unknown): MerchandiseInput | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Each item must be an object." };
  const a = raw as Record<string, unknown>;

  const name = String(a.name ?? "").trim();
  if (!name) return { error: "Every item needs a name." };
  if (name.length > 120) return { error: "An item name must be 120 characters or fewer." };

  const priceCents = Number(a.priceCents);
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > MAX_ADDON_PRICE_CENTS) {
    return { error: `"${name}" needs a price between $0 and $${MAX_ADDON_PRICE_CENTS / 100}.` };
  }

  const optionLabel = String(a.optionLabel ?? "").trim() || "Size";
  if (optionLabel.length > 40) return { error: "An option label must be 40 characters or fewer." };

  const description = String(a.description ?? "").trim();
  if (description.length > 2000) {
    return { error: "An item description must be 2000 characters or fewer." };
  }

  const imageUrl = String(a.imageUrl ?? "").trim();
  if (imageUrl.length > 2000) return { error: "An item image URL is too long." };
  // A photo from anywhere else would throw while the profile renders, so it is
  // refused here rather than breaking the page for everyone.
  if (imageUrl && !isAllowedImageUrl(imageUrl)) {
    return { error: `The photo for "${name}" must be one you uploaded.` };
  }

  if (!Array.isArray(a.options) || a.options.length === 0) {
    return { error: `"${name}" needs at least one ${optionLabel.toLowerCase()} option.` };
  }
  if (a.options.length > MAX_ADDON_VARIANTS) {
    return { error: `"${name}" can have at most ${MAX_ADDON_VARIANTS} options.` };
  }

  const options: string[] = [];
  const seen = new Set<string>();
  for (const rawOption of a.options) {
    const label = String(rawOption ?? "").trim();
    if (!label) return { error: `Every option on "${name}" needs a name.` };
    if (label.length > 60) return { error: "An option name must be 60 characters or fewer." };
    if (seen.has(label.toLowerCase())) {
      return { error: `"${name}" has two options called "${label}".` };
    }
    seen.add(label.toLowerCase());
    options.push(label);
  }

  const id = String(a.id ?? "").trim();
  return {
    ...(id ? { id } : {}),
    name,
    description: description || null,
    priceCents,
    imageUrl: imageUrl || null,
    optionLabel,
    options,
  };
}

/** Validate a whole profile catalogue, as the replace-all PUT receives it. */
export function sanitizeMerchandiseInput(input: unknown): MerchandiseInput[] | { error: string } {
  if (!Array.isArray(input)) return { error: "merchandise must be an array." };
  if (input.length > MAX_PROFILE_MERCHANDISE) {
    return { error: `Your profile can show at most ${MAX_PROFILE_MERCHANDISE} items.` };
  }

  const out: MerchandiseInput[] = [];
  const seenNames = new Set<string>();
  for (const raw of input) {
    const item = sanitizeMerchandiseItem(raw);
    if ("error" in item) return item;
    const key = item.name.toLowerCase();
    if (seenNames.has(key)) return { error: `Duplicate item name "${item.name}".` };
    seenNames.add(key);
    out.push(item);
  }
  return out;
}
