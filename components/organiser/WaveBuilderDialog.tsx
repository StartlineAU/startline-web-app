"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import TimePicker from "@/components/ui/TimePicker";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { describeWaveRules, hasRules, type WaveDef } from "@/lib/wave-assignment";
import { cn } from "@/lib/utils";

const GENDER_CHOICES = ["Male", "Female", "Non-binary", "Other"];

const INPUT =
  "bg-dark-light border border-dark-lighter rounded-lg text-light placeholder:text-placeholder focus:border-primary focus:outline-none";

export interface WavePreview {
  perWave: Record<string, number>;
  unassigned: number;
  total: number;
}

interface WaveBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waves: WaveDef[];
  onWavesChange: (update: (waves: WaveDef[]) => WaveDef[]) => void;
  preview: WavePreview | null;
  message: string;
  saving: boolean;
  onSave: () => void;
}

const numberOrNull = (value: string) => (value === "" ? null : Number(value));

/**
 * Start-wave builder. Each wave shows only its name, start time and size; the
 * optional rules for who goes in it sit behind "Add rules" so a first-time
 * organiser is not faced with every condition at once (#554).
 */
export default function WaveBuilderDialog({
  open, onOpenChange, waves, onWavesChange, preview, message, saving, onSave,
}: WaveBuilderDialogProps) {
  const addWave = () => {
    onWavesChange((current) => {
      const n = current.length + 1;
      return [...current, {
        id: `wave-${Date.now()}-${n}`,
        label: `Wave ${String.fromCharCode(64 + n)}`, // Wave A, B, C…
        startTime: "",
        capacity: null,
        finishMin: null, finishMax: null, genders: [], ageMin: null, ageMax: null,
      }];
    });
  };

  const updateWave = (waveId: string, patch: Partial<WaveDef>) => {
    onWavesChange((current) => current.map((w) => (w.id === waveId ? { ...w, ...patch } : w)));
  };

  const removeWave = (waveId: string) => {
    onWavesChange((current) => current.filter((w) => w.id !== waveId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Build start waves</DialogTitle>
          <DialogDescription>
            Split your start into groups. Each athlete goes into the first wave they fit, top to bottom.
          </DialogDescription>
          <p className="text-[11.5px] text-muted-dark">Waves are separate from ticket types.</p>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-3">
          {waves.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-xl border border-dashed border-dark-lighter">
              <p className="font-headline text-[13px] font-bold text-light mb-1">No start waves yet</p>
              <p className="text-[12.5px] text-muted-dark mb-4">
                Add one, give it a time, and we&apos;ll sort your athletes in.
              </p>
              <Button variant="outline" size="sm" onClick={addWave}>
                <Plus className="w-4 h-4" /> Add your first wave
              </Button>
            </div>
          ) : waves.map((w) => (
            <WaveCard
              key={w.id}
              wave={w}
              count={preview?.perWave[w.label] ?? 0}
              onChange={(patch) => updateWave(w.id, patch)}
              onRemove={() => removeWave(w.id)}
            />
          ))}

          {waves.length > 0 && (
            <button
              type="button"
              onClick={addWave}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-dark-lighter py-2.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary hover:border-primary/40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add another wave
            </button>
          )}
        </div>

        {preview && waves.length > 0 && preview.unassigned > 0 && (
          <p className="flex items-center gap-2 text-[12.5px] text-muted-light bg-dark border border-dark-lighter rounded-lg px-3 py-2 mt-1">
            <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
            {preview.unassigned} athlete{preview.unassigned === 1 ? "" : "s"} match no wave and will stay unassigned.
          </p>
        )}
        {message && <p className="text-[13px] text-muted-light mt-1">{message}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={onSave} disabled={saving || waves.length === 0} className="shadow-machined">
            {saving ? "Saving…" : "Save & sort athletes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WaveCard({
  wave: w, count, onChange, onRemove,
}: {
  wave: WaveDef;
  count: number;
  onChange: (patch: Partial<WaveDef>) => void;
  onRemove: () => void;
}) {
  // Waves that already carry a rule open expanded so nothing set is hidden.
  const [rulesOpen, setRulesOpen] = useState(() => hasRules(w));
  const name = w.label || "this wave";
  const rulesId = `${w.id}-rules`;

  const toggleGender = (gender: string) => {
    const set = new Set(w.genders ?? []);
    if (set.has(gender)) set.delete(gender);
    else set.add(gender);
    onChange({ genders: [...set] });
  };

  return (
    <div className="rounded-xl border border-dark-lighter bg-dark p-3.5">
      {/* The essentials: name, start time, size. */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={w.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Wave name"
          aria-label={`Wave name for ${w.label || "new wave"}`}
          className={cn(INPUT, "flex-1 min-w-[8rem] px-2.5 py-2 text-[14px] font-headline font-bold")}
        />
        <div className="w-[10.5rem] shrink-0" title="Start time">
          <TimePicker
            value={w.startTime ?? ""}
            onChange={(v) => onChange({ startTime: v })}
            placeholder="Start time"
            size="xs"
            ariaLabel={`Start time for ${w.label || "new wave"}`}
          />
        </div>
        <div className="flex items-center gap-1.5" title="Max athletes">
          <Users className="w-3.5 h-3.5 text-muted-dark shrink-0" />
          <input
            type="number"
            min={0}
            value={w.capacity ?? ""}
            placeholder="No limit"
            aria-label={`Maximum athletes in ${name}`}
            onChange={(e) => onChange({ capacity: numberOrNull(e.target.value) })}
            className={cn(INPUT, "w-24 px-2 py-2 text-[13px]")}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-2 text-muted-dark hover:text-red-400 transition-colors"
          aria-label={`Remove ${w.label || "wave"}`}
          title="Remove wave"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Who it's for, in one line, with the rules tucked away. */}
      <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
        <p className="text-[12.5px] text-muted-light min-w-0" data-testid={`wave-summary-${w.id}`}>
          <span className="text-muted-dark">For: </span>
          {describeWaveRules(w)}
          <span className="text-muted-dark"> · </span>
          <span className="text-primary font-bold">{count}</span> athlete{count === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setRulesOpen((o) => !o)}
          aria-expanded={rulesOpen}
          aria-controls={rulesId}
          className="flex items-center gap-1 font-headline text-[10.5px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors"
        >
          {hasRules(w) ? "Edit rules" : "Add rules"}
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", rulesOpen && "rotate-180")} />
        </button>
      </div>

      {rulesOpen && (
        <div
          id={rulesId}
          role="group"
          aria-label={`Rules for ${name}`}
          className="mt-3 pt-3 border-t border-dark-lighter space-y-3">
          <p className="text-[11.5px] text-muted-dark">
            Optional. Leave a rule blank and anyone can go in this wave.
          </p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <div>
              <label htmlFor={`${w.id}-finish-min`} className="text-[11px] text-muted-dark block mb-1">
                Expected finish (minutes)
              </label>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} value={w.finishMin ?? ""} placeholder="From"
                  id={`${w.id}-finish-min`} aria-label={`Minimum finish minutes for ${name}`}
                  onChange={(e) => onChange({ finishMin: numberOrNull(e.target.value) })}
                  className={cn(INPUT, "w-full px-2 py-1.5 text-[13px]")} />
                <span className="text-muted-dark text-[12px]">to</span>
                <input type="number" min={0} value={w.finishMax ?? ""} placeholder="To"
                  aria-label={`Maximum finish minutes for ${name}`}
                  onChange={(e) => onChange({ finishMax: numberOrNull(e.target.value) })}
                  className={cn(INPUT, "w-full px-2 py-1.5 text-[13px]")} />
              </div>
            </div>
            <div>
              <label htmlFor={`${w.id}-age-min`} className="text-[11px] text-muted-dark block mb-1">Age</label>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} value={w.ageMin ?? ""} placeholder="From"
                  id={`${w.id}-age-min`} aria-label={`Minimum age for ${name}`}
                  onChange={(e) => onChange({ ageMin: numberOrNull(e.target.value) })}
                  className={cn(INPUT, "w-full px-2 py-1.5 text-[13px]")} />
                <span className="text-muted-dark text-[12px]">to</span>
                <input type="number" min={0} value={w.ageMax ?? ""} placeholder="To"
                  aria-label={`Maximum age for ${name}`}
                  onChange={(e) => onChange({ ageMax: numberOrNull(e.target.value) })}
                  className={cn(INPUT, "w-full px-2 py-1.5 text-[13px]")} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-dark mr-0.5">Gender:</span>
            {GENDER_CHOICES.map((g) => {
              const on = (w.genders ?? []).includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGender(g)}
                  aria-pressed={on}
                  className={cn(
                    "px-2 py-1 rounded-md text-[11px] font-headline font-bold uppercase tracking-wide border transition-colors",
                    on
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-dark-light border-dark-lighter text-muted-dark hover:text-light",
                  )}
                >
                  {g}
                </button>
              );
            })}
            {(w.genders ?? []).length === 0 && <span className="text-[11px] text-muted-dark">any</span>}
          </div>

          {hasRules(w) && (
            <button
              type="button"
              onClick={() => onChange({ finishMin: null, finishMax: null, genders: [], ageMin: null, ageMax: null })}
              className="font-headline text-[10.5px] font-bold uppercase tracking-widest text-muted-dark hover:text-light transition-colors"
            >
              Clear rules
            </button>
          )}
        </div>
      )}
    </div>
  );
}
