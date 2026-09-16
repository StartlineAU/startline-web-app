"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Plus, Trash2, ImagePlus, ShoppingBag, Lock, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AddOnDraft,
  emptyAddOnDraft,
  emptyVariantDraft,
  parsePriceToCents,
  hasPurchaseHistory,
} from "@/lib/add-on-drafts";
import { MAX_ADD_ONS, MAX_ADDON_VARIANTS } from "@/lib/add-ons";
import { PLATFORM_FEE_PERCENT, calculateAddOnTotalWithFee } from "@/lib/platform-fee";
import { TYPE_MIMES, uploadSizeError } from "@/lib/upload-limits";
import { uploadFile, UploadError } from "@/lib/upload-client";

const inputCls =
  "w-full h-11 px-3.5 rounded-lg bg-dark border border-dark-lighter text-light text-[14px] placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors";

const labelCls =
  "font-headline text-[10px] uppercase tracking-widest text-light mb-1.5 block";

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
 * The add-on catalogue editor, shared by the event wizard and the race
 * management panel so an organiser sees the same thing before and after their
 * event goes live.
 *
 * Products that have sold cannot be deleted, only retired: purchase history has
 * to survive, and the database enforces the same rule with onDelete: Restrict.
 */
export default function AddOnEditor({
  addOns,
  onChange,
  feeStructure,
  disabled = false,
}: {
  addOns: AddOnDraft[];
  onChange: (next: AddOnDraft[]) => void;
  feeStructure: "athlete" | "organiser";
  disabled?: boolean;
}) {
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});
  // Keyed by product index, cleared as soon as an acceptable file replaces the
  // rejected one. Uploads are deferred to save, so without a check at pick time
  // an oversized photo is accepted silently and only fails on submit (issue #300).
  const [imageErrors, setImageErrors] = useState<Record<number, string>>({});

  // Object URLs for photos chosen but not yet uploaded. Created once per File and
  // revoked when it goes away: minting one inline on every render would leak a
  // blob URL on each keystroke in the form.
  const previews = useMemo(() => {
    const map = new Map<File, string>();
    for (const addOn of addOns) {
      if (addOn.image && !map.has(addOn.image)) {
        map.set(addOn.image, URL.createObjectURL(addOn.image));
      }
    }
    return map;
  }, [addOns]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const updateAddOn = (index: number, patch: Partial<AddOnDraft>) => {
    onChange(addOns.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  const pickImage = (index: number, file: File | null) => {
    if (!file) return;
    const tooBig = uploadSizeError("photo", file.size);
    if (tooBig) {
      setImageErrors((prev) => ({ ...prev, [index]: tooBig }));
      return;
    }
    setImageErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    updateAddOn(index, { image: file });
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
      {addOns.map((addOn, index) => {
        const locked = hasPurchaseHistory(addOn);
        const priceCents = parsePriceToCents(addOn.price);
        // The same function checkout and the webhook price with, so the number the
        // organiser is shown here cannot drift from the one they are charged.
        const fee = priceCents == null ? null : calculateAddOnTotalWithFee(priceCents, feeStructure);
        const preview = addOn.image ? previews.get(addOn.image) : addOn.imageUrl;

        return (
          <div key={addOn.id ?? `new-${index}`} className="border border-dark-lighter rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-dark-light">
              <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-light flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                {addOn.name.trim() || `Add-on ${index + 1}`}
              </div>
              <div className="flex items-center gap-1">
                {/* The order here is the order athletes see; the route writes it
                    to sortOrder from the array position. */}
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  aria-label={`Move ${addOn.name.trim() || `add-on ${index + 1}`} up`}
                  onClick={() => onChange(moved(addOns, index, index - 1))}
                  className={moveBtnCls}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === addOns.length - 1}
                  aria-label={`Move ${addOn.name.trim() || `add-on ${index + 1}`} down`}
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
                      : "Remove this add-on"
                  }
                >
                  {locked ? <Lock className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                  {locked ? "Retire" : "Remove"}
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-4">
                <div>
                  <span className={labelCls}>Photo</span>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Photo for add-on ${index + 1}`}
                    onClick={() => fileInputs.current[index]?.click()}
                    className="relative w-[92px] h-[92px] rounded-lg border border-dashed border-dark-lighter grid place-items-center overflow-hidden hover:border-primary/50 transition-colors disabled:opacity-40"
                  >
                    {preview ? (
                      <Image src={preview} alt="" fill sizes="92px" className="object-cover" unoptimized />
                    ) : (
                      <ImagePlus className="w-5 h-5 text-muted-dark" />
                    )}
                  </button>
                  <input
                    ref={(el) => {
                      fileInputs.current[index] = el;
                    }}
                    type="file"
                    accept={TYPE_MIMES.photo.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      pickImage(index, e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                  {imageErrors[index] && (
                    <p className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1.5 w-[92px]">
                      {imageErrors[index]}
                    </p>
                  )}
                </div>

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
                    {addOn.optionLabel.trim() || "Options"} and stock
                  </span>
                  <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">
                    Units available
                  </span>
                </div>
                <div className="space-y-2">
                  {addOn.variants.map((variant, variantIndex) => {
                    const variantLocked = variant.purchased > 0;
                    return (
                      <div key={variant.id ?? `new-${variantIndex}`} className="flex items-center gap-2">
                        <input
                          aria-label={`Option name ${variantIndex + 1}`}
                          className={cn(inputCls, "flex-1")}
                          value={variant.label}
                          disabled={disabled}
                          maxLength={60}
                          placeholder="M"
                          onChange={(e) => updateVariant(index, variantIndex, { label: e.target.value })}
                        />
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

              {fee != null && priceCents != null && priceCents > 0 && (
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
            </div>
          </div>
        );
      })}

      {addOns.length < MAX_ADD_ONS && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...addOns, emptyAddOnDraft()])}
          className="w-full border border-dashed border-dark-lighter rounded-md py-3 font-headline text-[12px] uppercase tracking-widest text-light hover:text-primary hover:border-primary/40 flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
        >
          <Plus className="w-4 h-4" /> Add merchandise
        </button>
      )}
    </div>
  );
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
        return { ...draft, image: null, imageUrl: await uploadFile(draft.image, "photo") };
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
