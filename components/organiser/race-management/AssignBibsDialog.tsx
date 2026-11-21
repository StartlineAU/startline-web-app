"use client";

import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface Preview {
  count: number;
  first: string | null;
  last: string | null;
  skippedNoWave: number;
}

/**
 * Bulk bib numbering (#566). The server does the numbering inside a locked
 * transaction; this dialog only asks for a start number, shows the dry-run
 * range, and confirms. The parent remounts it (key) on every open, so the
 * inputs start fresh from defaultStart.
 */
export default function AssignBibsDialog({
  eventId,
  open,
  onOpenChange,
  defaultStart,
  wavesOn,
  onAssigned,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStart: number;
  wavesOn: boolean;
  onAssigned: (count: number) => void;
}) {
  const [start, setStart] = useState(String(defaultStart));
  const [includeUnassigned, setIncludeUnassigned] = useState(false);
  // The last dry run, tagged with the inputs it answered. One for older
  // inputs is simply not current, so a late reply never shows a stale range.
  const [result, setResult] = useState<{ key: string; preview?: Preview; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const startNum = Number(start);
  const validStart = Number.isInteger(startNum) && startNum >= 1;
  const inputKey = `${startNum}|${includeUnassigned}`;
  const current = result?.key === inputKey ? result : null;
  const preview = current?.preview ?? null;
  const loading = validStart && !current;
  const error = saveError || current?.error || "";

  const call = (dryRun: boolean) =>
    fetch(`/api/organiser/events/${eventId}/bibs/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: startNum, includeUnassigned, dryRun }),
    });

  // Refresh the preview as the inputs change, debounced while typing.
  useEffect(() => {
    if (!open || !validStart) return;
    const key = inputKey;
    const t = window.setTimeout(async () => {
      try {
        const res = await call(true);
        const json = await res.json().catch(() => null);
        setResult(res.ok
          ? { key, preview: json as Preview }
          : { key, error: json?.error ?? "Could not work out the bib range." });
      } catch {
        setResult({ key, error: "Could not work out the bib range. Check your connection." });
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, inputKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const assign = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await call(false);
      const json = await res.json().catch(() => null);
      if (!res.ok) { setSaveError(json?.error ?? "Could not assign bibs."); return; }
      onAssigned(json.count);
      onOpenChange(false);
    } catch {
      setSaveError("Could not assign bibs. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const summary = !validStart
    ? "Enter a start number of 1 or more."
    : loading && !preview
      ? "Working it out…"
      : preview
        ? preview.count === 0
          ? "Everyone already has a bib."
          : preview.count === 1
            ? `1 athlete will get bib #${preview.first}.`
            : `${preview.count} athletes will get bibs #${preview.first}–#${preview.last}.`
        : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Hash className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle>Assign bibs</DialogTitle>
          </div>
          <DialogDescription>
            Numbers every confirmed athlete who has no bib yet
            {wavesOn ? ", wave by wave in board order, then by name" : ", by name"}.
            Existing bibs stay as they are, and numbers already taken are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="bib-start" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">
              Start from
            </label>
            <input
              id="bib-start"
              type="number"
              inputMode="numeric"
              min={1}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-32 bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light focus:border-primary focus:outline-none"
            />
          </div>

          {wavesOn && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUnassigned}
                onChange={(e) => setIncludeUnassigned(e.target.checked)}
                className="accent-primary w-4 h-4 mt-0.5 shrink-0"
              />
              <span className="text-[13px] text-light">
                Include athletes without a wave
                <span className="block text-[12px] text-muted-dark">They are numbered after the last wave.</span>
              </span>
            </label>
          )}

          <p data-testid="assign-bibs-preview" className="font-headline text-[14px] font-bold text-light" aria-live="polite">
            {summary}
          </p>
          {preview && preview.skippedNoWave > 0 && !includeUnassigned && (
            <p className="text-[12px] text-muted-dark -mt-2">
              {preview.skippedNoWave} without a wave {preview.skippedNoWave === 1 ? "is" : "are"} skipped for now.
            </p>
          )}
          {error && <p className="text-[13px] text-red-300">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={assign} disabled={saving || !validStart || !preview || preview.count === 0}>
            {saving ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
