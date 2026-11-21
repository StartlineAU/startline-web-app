"use client";

import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import SelectMenu, { type SelectOption } from "@/components/ui/SelectMenu";
import { formatInEventTimeZone } from "@/lib/event-time";
import {
  CHECK_IN_LEAD_OPTIONS,
  CHECK_IN_OPENS_MINUTES_BEFORE,
  type CheckInState,
} from "@/lib/check-in-window";

export interface CheckInWindowData {
  state: CheckInState;
  opensAt: string | null;
  closesAt: string | null;
  /** The organiser opened check-in earlier than the default. */
  custom: boolean;
  /** Minutes before the start that check-in opens. It moves with the event. */
  leadMinutes: number;
}

const LEAD_LABELS: Record<number, string> = {
  60: "1 hour before start",
  120: "2 hours before start",
  [24 * 60]: "1 day before start",
  [7 * 24 * 60]: "1 week before start",
};

const OPTIONS: SelectOption[] = [
  ...CHECK_IN_LEAD_OPTIONS.map((minutes) => ({
    value: String(minutes),
    label: minutes === CHECK_IN_OPENS_MINUTES_BEFORE
      ? `${LEAD_LABELS[minutes]} (default)`
      : LEAD_LABELS[minutes],
  })),
  { value: "now", label: "Now" },
];

const CUSTOM = "custom";

/** "3 days", "5 hours", "90 minutes": a lead that isn't one of the presets. */
export function formatLead(minutes: number): string {
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (minutes >= 24 * 60 && minutes % (24 * 60) === 0) return unit(minutes / (24 * 60), "day");
  if (minutes >= 24 * 60) return unit(Math.round(minutes / (24 * 60)), "day");
  if (minutes % 60 === 0) return unit(minutes / 60, "hour");
  return unit(minutes, "minute");
}

/**
 * The menu, with the lead in force selected. "Now" is stored as the lead from
 * that moment to the start, so it shows as its own length afterwards: if the
 * event moves, so does check-in, and "Now" would no longer be true.
 */
function menu(checkIn: CheckInWindowData): { value: string; options: SelectOption[] } {
  const lead = checkIn.custom ? checkIn.leadMinutes : CHECK_IN_OPENS_MINUTES_BEFORE;
  if ((CHECK_IN_LEAD_OPTIONS as readonly number[]).includes(lead)) {
    return { value: String(lead), options: OPTIONS };
  }
  return {
    value: CUSTOM,
    options: [{ value: CUSTOM, label: `${formatLead(lead)} before start` }, ...OPTIONS],
  };
}

/**
 * Lets the organiser open athlete check-in earlier than the default hour
 * before start (#543). It can only move the opening earlier; the default is
 * the latest it can be. The choice is a lead before the start, so moving the
 * event moves check-in with it.
 */
export default function CheckInOpeningCard({
  eventId,
  timeZone,
  checkIn,
  onChange,
}: {
  eventId: string;
  timeZone: string;
  checkIn: CheckInWindowData;
  onChange: (next: CheckInWindowData) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const format = (iso: string) =>
    formatInEventTimeZone(new Date(iso), timeZone, {
      weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    });

  const save = async (value: string) => {
    if (value === CUSTOM) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/organiser/events/${eventId}/check-in`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open: value === "now" ? "now" : Number(value) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Couldn't change when check-in opens."); return; }
      onChange(d.checkIn);
    } catch {
      setError("Couldn't change when check-in opens.");
    } finally {
      setSaving(false);
    }
  };

  const { value, options } = menu(checkIn);

  let summary: string;
  if (checkIn.state === "open") {
    summary = checkIn.closesAt
      ? `Athletes can check in now, until ${format(checkIn.closesAt)}.`
      : "Athletes can check in now.";
  } else if (checkIn.state === "before" && checkIn.opensAt) {
    summary = `Athletes can check in from ${format(checkIn.opensAt)}.`;
  } else {
    summary = "Check-in isn't available for this event.";
  }

  return (
    <div className="mb-6 sm:mb-8 rounded-xl border border-dark-lighter bg-dark p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
            Check-in {checkIn.state === "open" ? "open" : "opens"}
          </div>
          <p className="text-[13px] text-muted mt-1">{summary}</p>
          {error && <p role="alert" className="text-[12px] text-red-300 mt-1">{error}</p>}
        </div>
      </div>
      {checkIn.state !== "unavailable" && (
        <div className="flex items-center gap-2 sm:w-64 shrink-0">
          <div className="flex-1 min-w-0">
            <SelectMenu
              size="sm"
              ariaLabel="When check-in opens"
              value={value}
              options={options}
              onChange={(v) => { if (!saving) void save(v); }}
            />
          </div>
          {saving && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" aria-label="Saving" />}
        </div>
      )}
    </div>
  );
}
