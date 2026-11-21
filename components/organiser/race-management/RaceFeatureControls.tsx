"use client";

import { useState } from "react";
import { Eye, EyeOff, Hash, Layers, Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import type { RaceFeatureMode, RaceFeatures } from "@/lib/race-features";

type Feature = "waves" | "bibs";

const FEATURE = {
  waves: {
    key: "waveMode",
    title: "Start waves",
    icon: Layers,
    pitch: "Split the field into timed starts by pace, gender or age.",
    shareCopy: "Each athlete will see their start wave on their ticket.",
  },
  bibs: {
    key: "bibMode",
    title: "Bib numbers",
    icon: Hash,
    pitch: "Number every athlete, in one go or one at a time.",
    shareCopy: "Each athlete will see their bib number on their ticket and when they check in.",
  },
} as const satisfies Record<Feature, { key: keyof RaceFeatures } & Record<string, unknown>>;

const PRIVATE_NOTE = "Athletes won't see anything until you share it.";

type Confirm = { feature: Feature; to: RaceFeatureMode } | null;

/**
 * Start waves and bib numbers are opt-in (#566). With both off this is two quiet
 * "set up" cards above a plain registrations list; once either is on it becomes
 * a status strip saying who can see it, with the action that changes that.
 */
export default function RaceFeatureControls({
  modes,
  onChange,
}: {
  modes: RaceFeatures;
  onChange: (next: Partial<RaceFeatures>) => Promise<string | null>;
}) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState<Feature | null>(null);
  const [error, setError] = useState("");

  const modeOf = (f: Feature) => modes[FEATURE[f].key];

  const apply = async (feature: Feature, to: RaceFeatureMode) => {
    setBusy(feature);
    setError("");
    const err = await onChange({ [FEATURE[feature].key]: to });
    setBusy(null);
    if (err) setError(err);
    else setConfirm(null);
  };

  const bothOff = modes.waveMode === "OFF" && modes.bibMode === "OFF";

  const dialog = confirm && (
    <Dialog open onOpenChange={(open) => { if (!open) { setConfirm(null); setError(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {confirm.to === "SHARED"
              ? `Share ${FEATURE[confirm.feature].title.toLowerCase()} with athletes?`
              : `Turn off ${FEATURE[confirm.feature].title.toLowerCase()}?`}
          </DialogTitle>
          <DialogDescription>
            {confirm.to === "SHARED"
              ? `${FEATURE[confirm.feature].shareCopy} They aren't emailed. You can hide it again later.`
              : "It disappears for you and for athletes. Nothing is deleted: turn it back on and every assignment returns."}
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-[13px] text-red-300">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button
            variant={confirm.to === "SHARED" ? "default" : "destructive"}
            disabled={busy !== null}
            onClick={() => apply(confirm.feature, confirm.to)}
          >
            {busy ? "Saving…" : confirm.to === "SHARED" ? "Share" : "Turn off"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (bothOff) {
    return (
      <section aria-label="Optional race-day setup" className="mb-6">
        <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-muted-dark mb-2">
          Optional race-day setup
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["waves", "bibs"] as const).map((f) => {
            const { title, icon: Icon, pitch } = FEATURE[f];
            return (
              <div
                key={f}
                data-testid={`race-feature-card-${f}`}
                className="flex items-start gap-3 rounded-xl border border-dashed border-dark-lighter bg-dark px-4 py-4"
              >
                <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">{title}</p>
                  <p className="text-[13px] text-muted mt-1">{pitch}</p>
                  <p className="text-[12px] text-muted-dark mt-1">{PRIVATE_NOTE}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => apply(f, "PRIVATE")}
                  aria-label={`Set up ${title.toLowerCase()}`}
                >
                  <Plus className="w-3.5 h-3.5" /> Set up
                </Button>
              </div>
            );
          })}
        </div>
        {error && <p className="text-[13px] text-red-300 mt-2">{error}</p>}
      </section>
    );
  }

  return (
    <section aria-label="Race-day setup" className="mb-4 space-y-2">
      {(["waves", "bibs"] as const).map((f) => {
        const mode = modeOf(f);
        const { title, icon: Icon } = FEATURE[f];
        if (mode === "OFF") {
          return (
            <button
              key={f}
              type="button"
              disabled={busy !== null}
              onClick={() => apply(f, "PRIVATE")}
              className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add {title.toLowerCase()}
            </button>
          );
        }
        const shared = mode === "SHARED";
        return (
          <div
            key={f}
            data-testid={`race-feature-${f}`}
            data-mode={mode}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dark-lighter bg-dark px-3 py-2"
          >
            <Icon className="w-4 h-4 text-primary shrink-0" />
            <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-light">{title}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-headline text-[10px] font-bold uppercase tracking-widest ${
                shared ? "border-primary/30 bg-primary/10 text-primary" : "border-dark-lighter text-muted-light"
              }`}
            >
              {shared ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {shared ? "Athletes can see this" : "Setting up · only you can see this"}
            </span>
            <span className="flex-1" />
            {shared ? (
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => apply(f, "PRIVATE")}>
                <EyeOff className="w-3.5 h-3.5" /> Hide from athletes
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => setConfirm({ feature: f, to: "SHARED" })}>
                <Eye className="w-3.5 h-3.5" /> Share with athletes
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => setConfirm({ feature: f, to: "OFF" })}
              aria-label={`Turn off ${title.toLowerCase()}`}
            >
              <Power className="w-3.5 h-3.5" /> Turn off
            </Button>
          </div>
        );
      })}
      {error && !confirm && <p className="text-[13px] text-red-300">{error}</p>}
      {dialog}
    </section>
  );
}
