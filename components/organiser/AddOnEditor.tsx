"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import Image from "next/image";
import { Plus, Trash2, ImagePlus, ShoppingBag, Lock, ChevronUp, ChevronDown, Globe, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AddOnDraft,
  emptyAddOnDraft,
  emptyVariantDraft,
  parsePriceToCents,
  hasPurchaseHistory,
  draftFromMerchandise,
  draftToMerchandiseItem,
} from "@/lib/add-on-drafts";
import { MAX_ADD_ONS, MAX_ADDON_VARIANTS } from "@/lib/add-ons";
import { MAX_PROFILE_MERCHANDISE, type MerchandiseView } from "@/lib/merchandise";
import { PLATFORM_FEE_PERCENT, calculateAddOnTotalWithFee } from "@/lib/platform-fee";
import { TYPE_MIMES, UPLOAD_LIMITS, uploadSizeError } from "@/lib/upload-limits";
import { uploadFile, UploadError } from "@/lib/upload-client";

const inputCls =
  "w-full h-11 px-3.5 rounded-lg bg-dark border border-dark-lighter text-light text-[14px] placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors";

const labelCls =
  "font-headline text-[10px] uppercase tracking-widest text-light mb-1.5 block";

/** What an organiser may upload for a product, stated once. */
const MERCH_PHOTO_RULE =
  `JPG, PNG or WebP, up to ${UPLOAD_LIMITS.merch.bytes / (1024 * 1024)} MB.`;

const moveBtnCls =
  "w-7 h-7 grid place-items-center rounded-md text-muted hover:text-primary transition-colors disabled:opacity-25 disabled:pointer-events-none";

/** Array with the item at `from` moved to `to`. Out-of-range moves are no-ops. */
function moved<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * One product's photo: the chooser, the preview and the size rejection.
 *
 * Its own component so the preview URL is created and revoked by the same
 * effect, keyed on the File itself. Deriving it during render (a useMemo over
 * the drafts) was wrong twice over: the cleanup revoked the URL the committed
 * <Image> was still using, and on a remount StrictMode's double-invoked cleanup
 * revoked it with no re-render left to replace it, so the photo came back
 * broken whenever the organiser left this step and returned. Same shape as the
 * cover image in EventFormWizard.
 */
function AddOnPhoto({
  file,
  imageUrl,
  label,
  disabled,
  onPick,
}: {
  file: File | null;
  imageUrl: string;
  label: string;
  disabled: boolean;
  onPick: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : imageUrl || null;
    startTransition(() => setSrc(url));
    return () => {
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [file, imageUrl]);

  const pick = (chosen: File | null) => {
    if (!chosen) return;
    // The file dialog filters on `accept`, but a drag or a "show all files"
    // dialog does not, so the type is checked here too. The upload routes
    // check it again, and verify the bytes really are an image.
    if (!TYPE_MIMES.merch.includes(chosen.type)) {
      setError(MERCH_PHOTO_RULE);
      return;
    }
    // Uploads are deferred to save, so an oversized photo has to be refused
    // here rather than five steps later (issue #300).
    const tooBig = uploadSizeError("merch", chosen.size);
    if (tooBig) {
      setError(tooBig);
      return;
    }
    setError("");
    onPick(chosen);
  };

  return (
    <div>
      <span className={labelCls}>Photo</span>
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        onClick={() => input.current?.click()}
        className="relative w-[92px] h-[92px] rounded-lg border border-dashed border-dark-lighter grid place-items-center overflow-hidden hover:border-primary/50 transition-colors disabled:opacity-40"
      >
        {src ? (
          <Image src={src} alt="" fill sizes="92px" className="object-cover" unoptimized />
        ) : (
          <ImagePlus className="w-5 h-5 text-muted-dark" />
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={TYPE_MIMES.merch.join(",")}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <p className={`font-headline text-[10px] uppercase tracking-widest mt-1.5 w-[92px] leading-relaxed ${error ? "text-red-400" : "text-muted-dark"}`}>
        {error || MERCH_PHOTO_RULE}
      </p>
    </div>
  );
}

/**
 * The organiser's profile merchandise, for the event editor's "Add from your
 * profile" picker. Loaded by the editor itself because both of its event
 * callers (the wizard and the race management panel) need it and neither
 * otherwise has any reason to know the profile exists.
 */
function useProfileMerchandise(enabled: boolean): MerchandiseView[] {
  const [items, setItems] = useState<MerchandiseView[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/organiser/merchandise")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.merchandise)) setItems(data.merchandise);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);
  return items;
}

/**
 * The add-on catalogue editor, shared by the event wizard and the race
 * management panel so an organiser sees the same thing before and after their
 * event goes live.
 *
 * Products that have sold cannot be deleted, only retired: purchase history has
 * to survive, and the database enforces the same rule with onDelete: Restrict.
 *
 * `mode="profile"` edits the organiser's public profile merchandise instead
 * (#338). Same product fields, but no stock, sales or fee: those belong to an
 * event's sale, not to the profile.
 */
export default function AddOnEditor({
  addOns,
  onChange,
  feeStructure = "athlete",
  disabled = false,
  mode = "event",
}: {
  addOns: AddOnDraft[];
  onChange: (next: AddOnDraft[]) => void;
  feeStructure?: "athlete" | "organiser";
  disabled?: boolean;
  mode?: "event" | "profile";
}) {
  const isEvent = mode === "event";
  const maxItems = isEvent ? MAX_ADD_ONS : MAX_PROFILE_MERCHANDISE;
  const itemNoun = isEvent ? "add-on" : "item";
  const profileItems = useProfileMerchandise(isEvent);
  // Profile items already in this event, whether imported or published from it.
  const linked = new Set(addOns.map((a) => a.merchandiseId).filter(Boolean));
  const importable = profileItems.filter((item) => !linked.has(item.id));

  const updateAddOn = (index: number, patch: Partial<AddOnDraft>) => {
    onChange(addOns.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  const reorderVariant = (addOnIndex: number, from: number, to: number) => {
    onChange(
      addOns.map((a, i) =>
        i === addOnIndex ? { ...a, variants: moved(a.variants, from, to) } : a,
      ),
    );
  };

  const updateVariant = (
    addOnIndex: number,
    variantIndex: number,
    patch: Partial<AddOnDraft["variants"][number]>,
  ) => {
    onChange(
      addOns.map((a, i) =>
        i === addOnIndex
          ? { ...a, variants: a.variants.map((v, j) => (j === variantIndex ? { ...v, ...patch } : v)) }
          : a,
      ),
    );
  };

  return (
    <div className="space-y-3">
      {isEvent && (
        <div className="flex gap-2.5 rounded-lg border border-dark-lighter bg-dark-light px-4 py-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[13px] text-muted leading-relaxed">
            Merchandise you add here is exclusive to this event&apos;s checkout. Tick{" "}
            <span className="text-light">Also show on my public profile</span> on an item to publish a
            copy to your organiser profile, where anyone can see it.
          </p>
        </div>
      )}

      {isEvent && importable.length > 0 && addOns.length < maxItems && (
        <div data-testid="addon-profile-picker">
          <span className={labelCls}>Add from your profile</span>
          <div className="flex flex-wrap gap-2">
            {importable.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange([...addOns, draftFromMerchandise(item)])}
                className="inline-flex items-center gap-1.5 rounded-full border border-dark-lighter px-3 py-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-light hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-40"
              >
                <Plus className="w-3 h-3" /> {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {addOns.map((addOn, index) => {
        const locked = hasPurchaseHistory(addOn);
        const priceCents = parsePriceToCents(addOn.price);
        // The same function checkout and the webhook price with, so the number the
        // organiser is shown here cannot drift from the one they are charged.
        const fee = priceCents == null ? null : calculateAddOnTotalWithFee(priceCents, feeStructure);

        return (
          <div key={addOn.uid} className="border border-dark-lighter rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-dark-light">
              <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-light flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                {addOn.name.trim() || `${isEvent ? "Add-on" : "Item"} ${index + 1}`}
              </div>
              <div className="flex items-center gap-1">
                {/* The order here is the order athletes see; the route writes it
                    to sortOrder from the array position. */}
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  aria-label={`Move ${addOn.name.trim() || `${itemNoun} ${index + 1}`} up`}
                  onClick={() => onChange(moved(addOns, index, index - 1))}
                  className={moveBtnCls}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === addOns.length - 1}
                  aria-label={`Move ${addOn.name.trim() || `${itemNoun} ${index + 1}`} down`}
                  onClick={() => onChange(moved(addOns, index, index + 1))}
                  className={moveBtnCls}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(addOns.filter((_, i) => i !== index))}
                  className={cn(
                    "ml-1 inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40",
                    locked ? "text-amber-400 hover:text-amber-300" : "text-muted hover:text-red-400",
                  )}
                  title={
                    locked
                      ? "This has been bought, so removing it retires it. Existing orders are kept."
                      : `Remove this ${itemNoun}`
                  }
                >
                  {locked ? <Lock className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                  {locked ? "Retire" : "Remove"}
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-4">
                <AddOnPhoto
                  file={addOn.image}
                  imageUrl={addOn.imageUrl}
                  label={`Photo for ${itemNoun} ${index + 1}`}
                  disabled={disabled}
                  onPick={(file) => updateAddOn(index, { image: file })}
                />

                <div className="flex-1 space-y-3">
                  <div>
                    <label className={labelCls} htmlFor={`addon-name-${index}`}>
                      Name <span className="text-primary">*</span>
                    </label>
                    <input
                      id={`addon-name-${index}`}
                      className={inputCls}
                      value={addOn.name}
                      disabled={disabled}
                      maxLength={120}
                      placeholder="Event tee"
                      onChange={(e) => updateAddOn(index, { name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} htmlFor={`addon-price-${index}`}>
                        Price <span className="text-primary">*</span>
                      </label>
                      <input
                        id={`addon-price-${index}`}
                        className={inputCls}
                        value={addOn.price}
                        disabled={disabled}
                        inputMode="decimal"
                        placeholder="25.00"
                        onChange={(e) => updateAddOn(index, { price: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor={`addon-option-${index}`}>
                        Option group <span className="text-primary">*</span>
                      </label>
                      <input
                        id={`addon-option-${index}`}
                        className={inputCls}
                        value={addOn.optionLabel}
                        disabled={disabled}
                        maxLength={40}
                        placeholder="Size"
                        onChange={(e) => updateAddOn(index, { optionLabel: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls} htmlFor={`addon-desc-${index}`}>
                  Description <span className="text-light">(optional)</span>
                </label>
                <textarea
                  id={`addon-desc-${index}`}
                  className={cn(inputCls, "h-auto py-2.5 min-h-[64px] resize-y")}
                  value={addOn.description}
                  disabled={disabled}
                  maxLength={2000}
                  placeholder="Unisex fit, 100% cotton. Collect at the event."
                  onChange={(e) => updateAddOn(index, { description: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(labelCls, "mb-0")}>
                    {addOn.optionLabel.trim() || "Options"}{isEvent ? " and stock" : ""}
                  </span>
                  {isEvent && (
                    <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">
                      Units available
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {addOn.variants.map((variant, variantIndex) => {
                    const variantLocked = variant.purchased > 0;
                    return (
                      <div key={variant.uid} className="flex items-center gap-2">
                        <input
                          aria-label={`Option name ${variantIndex + 1}`}
                          className={cn(inputCls, "flex-1")}
                          value={variant.label}
                          disabled={disabled}
                          maxLength={60}
                          placeholder="M"
                          onChange={(e) => updateVariant(index, variantIndex, { label: e.target.value })}
                        />
                        {isEvent && (
                          <>
                            <input
                              aria-label={`Units available for option ${variantIndex + 1}`}
                              className={cn(inputCls, "w-[110px]")}
                              value={variant.stock}
                              disabled={disabled}
                              inputMode="numeric"
                              placeholder="0"
                              onChange={(e) => updateVariant(index, variantIndex, { stock: e.target.value })}
                            />
                            <div className="w-[74px] shrink-0 text-right">
                              {variant.sold > 0 && (
                                <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">
                                  {variant.sold} sold
                                </span>
                              )}
                            </div>
                          </>
                        )}
                        <button
                          type="button"
                          disabled={disabled || variantIndex === 0}
                          aria-label={`Move option ${variantIndex + 1} up`}
                          onClick={() => reorderVariant(index, variantIndex, variantIndex - 1)}
                          className={moveBtnCls}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={disabled || variantIndex === addOn.variants.length - 1}
                          aria-label={`Move option ${variantIndex + 1} down`}
                          onClick={() => reorderVariant(index, variantIndex, variantIndex + 1)}
                          className={moveBtnCls}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={disabled || variantLocked}
                          onClick={() =>
                            onChange(
                              addOns.map((a, i) =>
                                i === index
                                  ? { ...a, variants: a.variants.filter((_, j) => j !== variantIndex) }
                                  : a,
                              ),
                            )
                          }
                          title={
                            variantLocked
                              ? "This option has been bought, so it cannot be removed."
                              : "Remove this option"
                          }
                          className="w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-red-400 transition-colors disabled:opacity-25 disabled:pointer-events-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {addOn.variants.length < MAX_ADDON_VARIANTS && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChange(
                        addOns.map((a, i) =>
                          i === index ? { ...a, variants: [...a.variants, emptyVariantDraft()] } : a,
                        ),
                      )
                    }
                    className="mt-2 inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" /> Add {addOn.optionLabel.trim().toLowerCase() || "option"}
                  </button>
                )}
              </div>

              {isEvent && fee != null && priceCents != null && priceCents > 0 && (
                <div className="rounded-lg bg-dark-light px-4 py-3">
                  <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-1">
                    Startline fee on this item
                  </div>
                  <div className="text-[13px] text-muted">
                    {(PLATFORM_FEE_PERCENT * 100).toFixed(2)}% of ${(priceCents / 100).toFixed(2)} is $
                    {(fee.platformFeeCents / 100).toFixed(2)}. No fixed charge applies to add-ons.{" "}
                    {feeStructure === "athlete"
                      ? `The athlete pays $${(fee.totalCents / 100).toFixed(2)} and you receive $${(priceCents / 100).toFixed(2)}.`
                      : `The athlete pays $${(fee.totalCents / 100).toFixed(2)} and you receive $${((priceCents - fee.platformFeeCents) / 100).toFixed(2)}.`}
                  </div>
                </div>
              )}

              {isEvent && (addOn.merchandiseId ? (
                <p className="flex items-start gap-2 text-[12px] text-muted leading-relaxed">
                  <Globe className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    <span className="text-light">On your public profile.</span> Edits here change this
                    event&apos;s checkout only, not the profile item.
                  </span>
                </p>
              ) : (
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[#B3E153]"
                    checked={!!addOn.publishToProfile}
                    disabled={disabled}
                    onChange={(e) => updateAddOn(index, { publishToProfile: e.target.checked })}
                  />
                  <span className="text-[12px] text-muted leading-relaxed">
                    <span className="text-light">Also show on my public profile.</span> A copy is
                    published when you save, and anyone can see it. Stock stays with this event.
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {addOns.length < maxItems && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...addOns, emptyAddOnDraft()])}
          className="w-full border border-dashed border-dark-lighter rounded-md py-3 font-headline text-[12px] uppercase tracking-widest text-light hover:text-primary hover:border-primary/40 flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
        >
          <Plus className="w-4 h-4" /> {isEvent ? "Add merchandise" : "Add item"}
        </button>
      )}
    </div>
  );
}

/** Thrown by publishAddOnsToProfile, carrying the links made before it failed. */
export class PublishToProfileError extends Error {
  constructor(message: string, readonly drafts: AddOnDraft[]) {
    super(message);
  }
}

/**
 * Publish a copy of every add-on ticked "Also show on my public profile", and
 * link each one to the profile item it created. Both event callers run this
 * after uploadAddOnImages (the profile needs the photo URL) and before saving
 * the catalogue, so the link is saved along with it.
 *
 * On failure the error carries the drafts with the links already made, so the
 * caller can keep them and a retry does not publish the same item twice.
 */
export async function publishAddOnsToProfile(drafts: AddOnDraft[]): Promise<AddOnDraft[]> {
  const out = [...drafts];
  for (let i = 0; i < out.length; i++) {
    const draft = out[i];
    if (!draft.publishToProfile || draft.merchandiseId) continue;
    // The draft's id is the event add-on's, which means nothing to the profile.
    const { name, description, priceCents, imageUrl, optionLabel, options } = draftToMerchandiseItem(draft);
    const res = await fetch("/api/organiser/merchandise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: { name, description, priceCents, imageUrl, optionLabel, options } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.id !== "string") {
      throw new PublishToProfileError(
        data.error ?? `"${name}" could not be added to your profile.`,
        out,
      );
    }
    out[i] = { ...draft, merchandiseId: data.id, publishToProfile: false };
  }
  return out;
}

/**
 * Upload any newly chosen photos and fold the resulting URLs back into the
 * drafts. Both callers run this immediately before saving, so the payload only
 * ever carries URLs.
 *
 * Goes through uploadFile, which presigns and sends the bytes straight to S3.
 * Posting to /api/upload instead would put the file back through Amplify's
 * WEB_COMPUTE runtime, whose payload ceiling rejects anything over about 4.5 MB
 * with an empty-bodied 413 (#305).
 */
export async function uploadAddOnImages(drafts: AddOnDraft[]): Promise<AddOnDraft[]> {
  return Promise.all(
    drafts.map(async (draft) => {
      if (!draft.image) return draft;
      try {
        return { ...draft, image: null, imageUrl: await uploadFile(draft.image, "merch") };
      } catch (err) {
        // Name the product: an organiser with six of them cannot act on "a photo
        // failed". The status is carried through so the caller can still tell an
        // expired session from a rejected file.
        const reason = err instanceof Error ? err.message : "";
        throw new UploadError(
          `The photo for "${draft.name.trim() || "your merchandise"}" could not be uploaded.` +
            (reason ? ` ${reason}` : ""),
          err instanceof UploadError ? err.status : 0,
        );
      }
    }),
  );
}
