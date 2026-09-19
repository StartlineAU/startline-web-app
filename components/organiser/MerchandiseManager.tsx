"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import AddOnEditor, { uploadAddOnImages } from "@/components/organiser/AddOnEditor";
import MerchandiseShowcase from "@/components/MerchandiseShowcase";
import {
  type AddOnDraft,
  draftsFromMerchandise,
  draftToMerchandiseItem,
  emptyAddOnDraft,
  draftValidationError,
} from "@/lib/add-on-drafts";
import type { PublicMerchandiseView } from "@/lib/merchandise";

const buttonCls =
  "inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest rounded-lg px-3.5 h-9 transition-colors disabled:opacity-40";

/**
 * The Merchandise section of the organiser's own profile (#338): what the
 * public sees, plus an editor for it.
 *
 * Everything here is public. Stock and sales are per event, so they are set
 * where an item is added to an event's checkout, not here.
 */
export default function MerchandiseManager({ initial }: { initial: PublicMerchandiseView[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<AddOnDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startEditing = (addFirst = false) => {
    const current = draftsFromMerchandise(initial);
    // "Add your first item" should open on an empty form, not a blank list.
    setDrafts(addFirst && current.length === 0 ? [emptyAddOnDraft()] : current);
    setError("");
    setEditing(true);
  };

  const save = async () => {
    setError("");
    const invalid = draftValidationError(drafts, "profile");
    if (invalid) { setError(invalid); return; }

    setSaving(true);
    try {
      const withImages = await uploadAddOnImages(drafts);
      setDrafts(withImages);
      const res = await fetch("/api/organiser/merchandise", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchandise: withImages.map(draftToMerchandiseItem) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save your merchandise.");
      setEditing(false);
      // The showcase is server-rendered with the events selling each item, so
      // re-render the page rather than rebuilding that here.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your merchandise.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="merchandise-manager">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary">
          Merchandise ({initial.length})
        </h2>
        {!editing && initial.length > 0 && (
          <button type="button" onClick={() => startEditing()}
            className={`${buttonCls} border border-dark-lighter text-light hover:border-primary hover:text-primary`}>
            <Pencil className="w-3.5 h-3.5" /> Edit merchandise
          </button>
        )}
      </div>

      {editing ? (
        <div className="max-w-3xl">
          <p className="text-[13px] text-muted leading-relaxed mb-4">
            Everything here is public on your profile. To sell an item, add it to an event&apos;s
            checkout from the event&apos;s Merchandise section, where you set its stock for that event.
          </p>
          <AddOnEditor addOns={drafts} onChange={setDrafts} disabled={saving} mode="profile" />
          {error && (
            <div className="mt-4 rounded-xl px-4 py-3 text-[13px] bg-red-500/10 text-red-300">{error}</div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" disabled={saving} onClick={() => setEditing(false)}
              className={`${buttonCls} text-muted hover:text-light`}>
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={save}
              className={`${buttonCls} bg-machined text-dark machined-button-shadow`}>
              {saving ? "Saving..." : "Save merchandise"}
            </button>
          </div>
        </div>
      ) : initial.length > 0 ? (
        <MerchandiseShowcase items={initial} />
      ) : (
        <div className="bg-dark rounded-xl px-6 py-10 text-center">
          <p className="font-headline text-sm font-medium text-muted">
            Show athletes the merchandise you make, then add it to any event&apos;s checkout.
          </p>
          <button type="button" onClick={() => startEditing(true)}
            className="inline-flex items-center gap-1.5 mt-3 font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline">
            <Plus className="w-3.5 h-3.5" /> Add your first item
          </button>
        </div>
      )}
    </div>
  );
}
