"use client";

import { useEffect, useState } from "react";
import { ErrorNote, SaveFooter, SectionShell } from "@/components/settings/primitives";
import {
  ACL_REFUND_NOTE,
  REFUND_PRESETS,
  describeTiers,
  matchRefundPreset,
  parseTiers,
  type RefundTier,
} from "@/lib/refund-policy";

const TITLE = "Refunds";
const DESCRIPTION =
  "One policy for every event this organisation runs. Athletes see it on each listing and at checkout.";

export default function OrganisationRefundsSection() {
  const [tiers, setTiers] = useState<RefundTier[] | null>(null);
  const [notes, setNotes] = useState("");
  const [storedKey, setStoredKey] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/organiser/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) { setLoadFailed(true); return; }
        const loaded = parseTiers(data.refundTiers);
        setTiers(loaded);
        setNotes(typeof data.refundPolicy === "string" ? data.refundPolicy : "");
        setStoredKey(JSON.stringify({ tiers: loaded, notes: data.refundPolicy ?? "" }));
        setIsOwner(data.role === "OWNER");
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const currentKey = tiers ? JSON.stringify({ tiers, notes }) : "";
  const changed = tiers !== null && currentKey !== storedKey;
  const active = tiers ? matchRefundPreset(tiers) : null;

  const save = async () => {
    if (!tiers || !changed) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/organiser/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundTiers: tiers, refundPolicy: notes.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save. Please try again.");
        return;
      }
      setStoredKey(JSON.stringify({ tiers, notes: notes.trim() }));
      setNotes(notes.trim());
      setSaved(true);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell title={TITLE} description={DESCRIPTION}>
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-[13px] text-muted-light leading-relaxed">
        {ACL_REFUND_NOTE}
      </div>

      {loadFailed && <ErrorNote>Could not load the refund policy.</ErrorNote>}

      {tiers && (
        <div className="mt-5 grid gap-3">
          {REFUND_PRESETS.map((preset) => {
            const selected = active?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={!isOwner || saving}
                onClick={() => { setTiers(preset.tiers); setSaved(false); }}
                className={`rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                  selected ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"
                }`}
              >
                <div className={`font-headline text-[12px] font-bold uppercase tracking-widest ${selected ? "text-primary" : "text-light"}`}>
                  {preset.label}
                </div>
                <p className="text-[12px] text-muted mt-1">{describeTiers(preset.tiers).join(" ")}</p>
              </button>
            );
          })}
          {tiers.length > 0 && !active && (
            <p className="text-[12px] text-muted">Current custom policy: {describeTiers(tiers).join(" ")}</p>
          )}
          <label className="block mt-2">
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">Notes</span>
            <textarea
              value={notes}
              disabled={!isOwner || saving}
              onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
              rows={3}
              placeholder="Transfers, deferrals, or other notes athletes should see."
              className="mt-1 w-full bg-dark-light border border-dark-lighter rounded-[10px] px-3 py-2 text-[13px] text-light outline-none focus:border-primary disabled:opacity-60"
            />
          </label>
          {!isOwner && (
            <p className="text-[12px] text-muted-dark">Only an owner can change this.</p>
          )}
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      {isOwner && (
        <SaveFooter saving={saving} saved={saved && !changed} disabled={!changed} onSave={save} />
      )}
    </SectionShell>
  );
}
