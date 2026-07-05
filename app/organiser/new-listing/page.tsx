"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2,
  Upload, Info, X, MapPin, Calendar, Users,
  ChevronDown, ChevronLeft, ChevronRight, Clock, Eye,
  Ticket, Package, ShoppingBag, Tag, ExternalLink,
} from "lucide-react";
import OrganiserTopBar     from "@/components/organiser/TopBar";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";

/* ── Step definitions ───────────────────────────────────────── */
const STEPS = [
  { k: "basics",   n: "01", label: "The Basics",          sub: "Name, discipline, summary"   },
  { k: "when",     n: "02", label: "Date & Location",     sub: "When and where it happens"   },
  { k: "format",   n: "03", label: "Format & Categories", sub: "How athletes compete"        },
  { k: "tickets",  n: "04", label: "Tickets & Pricing",   sub: "Categories, fees, inclusions"  },
  { k: "extras",   n: "05", label: "Details & Media",     sub: "Cover image, logistics"      },
  { k: "review",   n: "06", label: "Review & Publish",    sub: "Check and go live"           },
] as const;

const STEP_ERRORS: Record<number, string> = {
  0: "Event name is required.",
  1: "Date, street address, city and state are required.",
  2: "Discipline, competition format, level and minimum age are required.",
  3: "At least one ticket category with a price is required.",
  4: "A registration URL is required.",
};

type Discipline = "crossfit" | "running" | "hybrid" | "cycling" | "swimming" | "";
type Format     = "individual" | "team" | "both" | "";
type Level      = "beginner" | "open" | "elite" | "";
type AusState   = "nsw" | "vic" | "qld" | "wa" | "sa" | "tas" | "act" | "nt" | "";

interface Wave { label: string; price: string; closes: string; }

interface FormState {
  title: string; discipline: Discipline; description: string;
  date: string; endDate: string; startTime: string; endTime: string;
  venue: string; address: string; city: string; state: AusState;
  format: Format; level: Level; categories: string[]; cap: string; minAge: string;
  waves: Wave[];
  inclusions: string; extras: string; activations: string; refundPolicy: string;
  registrationType: 'startline' | 'external';
  feeStructure: 'athlete' | 'organiser';
  coverImage: File | null; coverImageUrl: string; registrationUrl: string; accessibilityInfo: string;
}

const INITIAL: FormState = {
  title: "", discipline: "", description: "",
  date: "", endDate: "", startTime: "", endTime: "",
  venue: "", address: "", city: "", state: "",
  format: "", level: "",
  categories: [],
  cap: "", minAge: "",
  waves: [
    { label: "", price: "", closes: "" },
  ],
  inclusions: "", extras: "", activations: "", refundPolicy: "",
  registrationType: "startline",
  feeStructure: "athlete",
  coverImage: null, coverImageUrl: "", registrationUrl: "", accessibilityInfo: "",
};

/* ── Shared field primitive ─────────────────────────────────── */
function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted-light">
          {label}{required && <span className="text-primary font-black text-[15px] leading-none ml-1">*</span>}
        </label>
        {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls    = "w-full bg-dark-light border border-dark-lighter rounded-md px-4 py-3 text-[15px] text-light placeholder:text-muted focus:border-primary focus:outline-none transition-colors";
const textareaCls = "w-full bg-dark-light border border-dark-lighter rounded-md px-4 py-3 text-[14px] text-light placeholder:text-muted focus:border-primary focus:outline-none resize-none transition-colors";

/* ═══════════════════════════════════════════════════════════════
   DATE PICKER POPOVER  (single OR range mode)
   Pass onChangeEnd to enable range mode.
   ══════════════════════════════════════════════════════════════ */
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function fmtDateShort(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function DatePickerPopover({
  value, onChange,
  rangeEnd, onChangeEnd,
  placeholder = "Select date",
  disablePast = true,
}: {
  value: string;
  onChange: (v: string) => void;
  rangeEnd?: string;
  onChangeEnd?: (v: string) => void;
  placeholder?: string;
  disablePast?: boolean;
}) {
  const isRange    = !!onChangeEnd;
  const todayDate  = new Date(); todayDate.setHours(0, 0, 0, 0);

  const parseView = (iso: string) => {
    if (iso) { const [y, m] = iso.split("-").map(Number); return { year: y, month: m - 1 }; }
    return { year: todayDate.getFullYear(), month: todayDate.getMonth() };
  };

  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState(parseView(value).year);
  const [viewMonth, setViewMonth] = useState(parseView(value).month);
  // In range mode: "start" = waiting for end pick after start is set
  const [picking,   setPicking]   = useState<"start" | "end">("start");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (value) { const [y, m] = value.split("-").map(Number); setViewYear(y); setViewMonth(m - 1); }
  }, [value]);

  const toIso = (d: number) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${viewYear}-${mm}-${dd}`;
  };

  const selectDay = (d: number) => {
    const iso = toIso(d);
    if (!isRange) { onChange(iso); setOpen(false); return; }

    if (picking === "start" || !value) {
      onChange(iso);
      if (onChangeEnd) onChangeEnd("");   // clear end when picking new start
      setPicking("end");
    } else {
      if (iso < value) {
        // Clicked before start → treat as new start
        onChange(iso);
        if (onChangeEnd) onChangeEnd("");
        setPicking("end");
      } else if (iso === value) {
        // Same day → single-day event, close
        if (onChangeEnd) onChangeEnd(iso);
        setOpen(false); setPicking("start");
      } else {
        if (onChangeEnd) onChangeEnd(iso);
        setOpen(false); setPicking("start");
      }
    }
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const isPast     = (d: number) => !disablePast ? false : new Date(viewYear, viewMonth, d) < todayDate;
  const isStart    = (d: number) => !!value   && toIso(d) === value;
  const isEnd      = (d: number) => !!rangeEnd && toIso(d) === rangeEnd;
  const isSelected = (d: number) => !isRange && !!value && toIso(d) === value;
  const isInRange  = (d: number) => {
    if (!isRange || !value || !rangeEnd) return false;
    const iso = toIso(d); return iso > value && iso < rangeEnd;
  };
  const isToday = (d: number) =>
    d === todayDate.getDate() && viewMonth === todayDate.getMonth() && viewYear === todayDate.getFullYear();

  const firstDow   = (() => { let d = new Date(viewYear, viewMonth, 1).getDay() - 1; return d < 0 ? 6 : d; })();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // Trigger label
  const displayValue = isRange
    ? value
      ? rangeEnd && rangeEnd !== value
        ? `${fmtDateShort(value)} — ${fmtDateShort(rangeEnd)}`
        : rangeEnd && rangeEnd === value
          ? fmtDateShort(value) + " (1 day)"
          : fmtDateShort(value) + " → pick end date"
      : ""
    : value ? fmtDateShort(value) : "";

  const selectToday = () => {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    onChange(iso);
    if (isRange && onChangeEnd) { onChangeEnd(""); setPicking("end"); }
    else setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(v => !v); if (!open) setPicking(value && !rangeEnd ? "end" : "start"); }}
        className={`w-full bg-dark-light border rounded-md px-4 py-3 text-[15px] text-left flex items-center justify-between transition-colors
          ${open ? "border-primary" : "border-dark-lighter hover:border-primary/40"}
          ${displayValue ? "text-light" : "text-muted"}`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Calendar className="w-4 h-4 text-muted-dark shrink-0" />
          <span className="truncate">{displayValue || placeholder}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-dark shrink-0 ml-2 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-dark border border-dark-lighter rounded-xl shadow-xl p-4 w-full sm:w-72 modal-in">
          {/* Range mode hint */}
          {isRange && (
            <div className="mb-3 flex items-center justify-between">
              <span className={`font-headline text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md
                ${picking === "start" ? "bg-primary/10 text-primary" : "text-muted-dark"}`}>
                {picking === "start" ? "▸ Tap start date" : "▸ Tap end date"}
              </span>
              {value && !rangeEnd && (
                <button type="button" onClick={() => { onChange(""); if (onChangeEnd) onChangeEnd(""); setPicking("start"); }}
                  className="font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors">
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth}
              className="w-9 h-9 rounded-md hover:bg-white/5 flex items-center justify-center text-muted hover:text-primary transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-headline text-[13px] font-bold text-light">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth}
              className="w-9 h-9 rounded-md hover:bg-white/5 flex items-center justify-center text-muted hover:text-primary transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => (
              <div key={d} className="font-headline text-[9px] uppercase tracking-widest text-muted-dark text-center py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="h-9" />;
              const inRange  = isInRange(d);
              const start    = isStart(d);
              const end      = isEnd(d);
              const sel      = isSelected(d);
              const past     = isPast(d);
              const today    = isToday(d);
              return (
                <div key={i}
                  className={`flex items-center justify-center h-9
                    ${inRange ? "bg-primary/10" : ""}
                    ${start && (rangeEnd || picking === "end") ? "bg-gradient-to-r from-transparent to-primary/10" : ""}
                    ${end ? "bg-gradient-to-l from-transparent to-primary/10" : ""}`}
                >
                  <button
                    type="button"
                    disabled={past}
                    onClick={() => selectDay(d)}
                    className={`w-9 h-9 rounded-full text-[13px] font-headline font-bold transition-colors
                      ${start || sel   ? "bg-primary text-dark"
                      : end            ? "bg-primary/80 text-dark"
                      : inRange        ? "text-primary hover:bg-primary/10"
                      : past           ? "text-muted-dark opacity-40 cursor-not-allowed"
                      : today          ? "text-primary border border-primary/40 hover:bg-primary/10"
                      :                  "text-muted hover:bg-white/5 hover:text-light"}`}
                  >
                    {d}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-dark-lighter flex items-center justify-between">
            <button type="button" onClick={() => { onChange(""); if (onChangeEnd) onChangeEnd(""); setOpen(false); setPicking("start"); }}
              className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors">
              Clear
            </button>
            <button type="button" onClick={selectToday}
              className="font-headline text-[11px] uppercase tracking-widest text-primary hover:underline transition-colors">
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TIME PICKER  — quick slots + custom entry
   ══════════════════════════════════════════════════════════════ */
const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 4; h < 24; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
})();

function fmt24to12(t: string): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function parseCustomTime(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, " ");
  // H:MM AM/PM or HH:MM AM/PM
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (ampm[3] === "AM") { if (h === 12) h = 0; }
    else { if (h !== 12) h += 12; }
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }
  // HH:MM 24-hour
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1], 10), m = parseInt(h24[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }
  return null;
}

function TimePicker({ value, onChange, placeholder = "Select time" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [open,        setOpen]        = useState(false);
  const [customRaw,   setCustomRaw]   = useState("");
  const [customError, setCustomError] = useState(false);
  const ref     = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open) {
      // Pre-fill custom input with current value so user can edit rather than retype
      setCustomRaw(value ? fmt24to12(value) : "");
      setCustomError(false);
      // Scroll slot list to selected value
      if (listRef.current && value) {
        const idx = TIME_SLOTS.indexOf(value);
        if (idx >= 0) listRef.current.scrollTop = Math.max(0, idx * 44 - 88);
      }
    }
  }, [open, value]);

  const commitCustom = () => {
    if (!customRaw.trim()) return;
    const parsed = parseCustomTime(customRaw);
    if (parsed) { onChange(parsed); setOpen(false); setCustomRaw(""); setCustomError(false); }
    else setCustomError(true);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`w-full bg-dark-light border rounded-md px-4 py-3 text-[15px] text-left flex items-center justify-between transition-colors
            ${open ? "border-primary" : "border-dark-lighter hover:border-primary/40"}
            ${value ? "text-light" : "text-muted"}`}
        >
          <span className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-muted-dark shrink-0" />
            {value ? fmt24to12(value) : placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-dark transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
            className="absolute right-9 p-1.5 text-muted-dark hover:text-light transition-colors"
            title="Clear time"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-dark border border-dark-lighter rounded-xl shadow-xl overflow-hidden w-56 modal-in">
          {/* Custom time input */}
          <div className="p-3 border-b border-dark-lighter">
            <div className="font-headline text-[9px] uppercase tracking-widest text-muted-dark mb-1.5">Custom time</div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={customRaw}
                onChange={e => { setCustomRaw(e.target.value); setCustomError(false); }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitCustom(); } }}
                placeholder="e.g. 7:15 AM or 19:15"
                className={`flex-1 min-w-0 bg-dark-light border rounded px-3 py-2 text-[13px] text-light placeholder:text-muted focus:outline-none transition-colors
                  ${customError ? "border-red-400 focus:border-red-500" : "border-dark-lighter focus:border-primary"}`}
              />
              <button
                type="button"
                onClick={commitCustom}
                className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-headline text-[11px] font-bold rounded transition-colors shrink-0"
              >
                Set
              </button>
            </div>
            {customError && (
              <p className="font-headline text-[10px] text-red-500 mt-1">
                Use format: 7:15 AM, 7:15 PM, or 19:15
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="px-4 py-2 font-headline text-[9px] uppercase tracking-widest text-muted-dark text-center">
            — or pick a slot —
          </div>

          {/* 30-min slot list */}
          <div ref={listRef} className="overflow-y-auto max-h-52" style={{ scrollbarWidth: "none" }}>
            {TIME_SLOTS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full px-4 py-3 text-left font-headline text-[14px] font-bold transition-colors
                  ${s === value
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-white/5 hover:text-light"}`}
              >
                {fmt24to12(s)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 1 — BASICS
   ══════════════════════════════════════════════════════════════ */
const DISCIPLINES: { v: Discipline; l: string; d: string }[] = [
  { v: "crossfit",  l: "CrossFit", d: "Functional fitness comp"    },
  { v: "running",   l: "Running",  d: "5K · 10K · Half · Marathon" },
  { v: "hybrid",    l: "Hybrid",   d: "Multi-discipline / OCR"     },
  { v: "cycling",   l: "Cycling",  d: "Road · Criterium · Gravel"  },
  { v: "swimming",  l: "Swimming", d: "Pool · Open water events"   },
];

const DISCIPLINE_CATS: Partial<Record<Discipline, string[]>> = {
  running:  ["5K", "10K", "Half Marathon", "Marathon", "Ultra"],
  cycling:  ["Road Race", "Criterium", "Time Trial", "Gran Fondo", "Mountain Bike", "Gravel"],
  swimming: ["50m", "100m", "200m", "400m", "800m", "1500m", "Open Water"],
};

function BasicsStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  return (
    <div>
      <Field label="Event title" required hint={`${form.title.length}/60`}>
        <input maxLength={60} value={form.title} onChange={(e) => update({ title: e.target.value })}
          placeholder="e.g. Functional Fitness Championship Sydney 2026" className={inputCls} />
      </Field>


      <Field label="Full description" hint={`${form.description.length}/1000`}>
        <textarea rows={6} maxLength={1000} value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Tell athletes what makes your event different. Course details, atmosphere, what to expect on race day."
          className={textareaCls} />
      </Field>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 2 — WHEN & WHERE
   ══════════════════════════════════════════════════════════════ */
const AUS_STATES: [AusState, string][] = [
  ["nsw","NSW"],["vic","VIC"],["qld","QLD"],["wa","WA"],
  ["sa","SA"],["tas","TAS"],["act","ACT"],["nt","NT"],
];

function WhenStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  return (
    <div>
      <Field label="Event date(s)" required hint="Tap start then end for multi-day">
        <DatePickerPopover
          value={form.date}
          onChange={v => update({ date: v })}
          rangeEnd={form.endDate}
          onChangeEnd={v => update({ endDate: v })}
          placeholder="Pick start date"
        />
        {/* Show clear end-date link when a range is set */}
        {form.endDate && form.endDate !== form.date && (
          <button
            type="button"
            onClick={() => update({ endDate: "" })}
            className="mt-1.5 font-headline text-[10px] uppercase tracking-widest text-muted-dark hover:text-primary transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Make single-day event
          </button>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <Field label="Start time" required>
          <TimePicker value={form.startTime} onChange={v => update({ startTime: v })} />
        </Field>
        <Field label="Cut-off time" hint="Last finisher">
          <TimePicker value={form.endTime} onChange={v => update({ endTime: v })} placeholder="Select end time" />
        </Field>
      </div>

      <div className="my-6 border-t border-dark-lighter" />

      <Field label="Street address" required>
        <AddressAutocomplete
          value={form.address}
          onChange={(raw) => update({ address: raw })}
          onSelect={({ address, city, state, venue }) => {
            update({
              ...(address && { address }),
              ...(city    && { city    }),
              ...(state   && { state: state as typeof form.state }),
              ...(venue   && { venue  }),
            });
          }}
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
          placeholder="Start typing an address…"
          className={inputCls}
        />
      </Field>

      <Field label="Venue name">
        <input value={form.venue} onChange={(e) => update({ venue: e.target.value })}
          placeholder="Sydney Olympic Park" className={inputCls} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <Field label="City" required>
          <div className={`${inputCls} ${form.city ? "text-light" : "text-muted-dark"}`}>
            {form.city || "—"}
          </div>
        </Field>
        <Field label="State" required>
          <div className={`${inputCls} ${form.state ? "text-light" : "text-muted-dark"}`}>
            {form.state ? form.state.toUpperCase() : "—"}
          </div>
        </Field>
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 3 — FORMAT & CATEGORIES
   ══════════════════════════════════════════════════════════════ */
const FORMATS: { v: Format; l: string; d: string }[] = [
  { v: "individual", l: "Individual",   d: "Solo athletes"     },
  { v: "team",       l: "Team / Pairs", d: "Doubles or relay"  },
  { v: "both",       l: "Both",         d: "Individual & team" },
];
const LEVELS: { v: Level; l: string }[] = [
  { v: "beginner", l: "Beginner friendly" },
  { v: "open",     l: "Open (all levels)" },
  { v: "elite",    l: "Elite / Pro"       },
];
const ALL_CATS = [
  "Individual","Doubles Mixed","Doubles Women","Doubles Men",
  "Relay 4-Person","Pro","Rx","Scaled",
];
const AGE_PRESETS  = ["18"];
const CAP_PRESETS  = ["250", "500", "1000", "2000", "3000", "5000"];

function FormatStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const toggle = (c: string) => {
    const s = new Set(form.categories);
    s.has(c) ? s.delete(c) : s.add(c);
    update({ categories: [...s] });
  };

  const [ageMode, setAgeMode] = useState<"open" | "preset" | "custom" | "none">(
    form.minAge === ""             ? "none"
    : form.minAge === "0"          ? "open"
    : AGE_PRESETS.includes(form.minAge) ? "preset"
    : "custom"
  );
  const [capMode, setCapMode] = useState<"preset" | "unlimited" | "custom" | "none">(
    form.cap === ""                ? "none"
    : CAP_PRESETS.includes(form.cap) ? "preset"
    : "custom"
  );

  const [showCustomCat,  setShowCustomCat]  = useState(false);
  const [customCatInput, setCustomCatInput] = useState("");

  const commitCustomCat = () => {
    const val = customCatInput.trim();
    if (val && !form.categories.includes(val)) {
      update({ categories: [...form.categories, val] });
    }
    setCustomCatInput("");
    setShowCustomCat(false);
  };

  return (
    <div>
      <Field label="Competition format" required>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {FORMATS.map((f) => {
            const on = form.format === f.v;
            return (
              <button key={f.v} type="button" onClick={() => update({ format: f.v })}
                className={`flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1 text-left p-3 sm:p-4 rounded-md border transition-all min-h-[44px]
                  ${on ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"}`}>
                <div className={`font-headline text-[14px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{f.l}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted">{f.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Discipline" required>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {DISCIPLINES.map((d) => {
            const on = form.discipline === d.v;
            return (
              <button key={d.v} type="button" onClick={() => update({ discipline: d.v, categories: [] })}
                className={`text-left p-4 rounded-md border transition-all ${on ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"}`}>
                <div className={`font-headline text-[15px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{d.l}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted mt-1">{d.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      {DISCIPLINE_CATS[form.discipline as Discipline] && (
        <Field label="Divisions & categories" hint={`${form.categories.length} selected`}>
          <div className="flex flex-wrap gap-2">
            {(DISCIPLINE_CATS[form.discipline as Discipline] ?? []).map((c) => (
              <button key={c} type="button" onClick={() => toggle(c)}
                className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border transition-colors ${form.categories.includes(c) ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
                {form.categories.includes(c) && <Check className="w-3 h-3 inline mr-1" />}
                {c}
              </button>
            ))}
            {/* Custom categories added by organiser */}
            {form.categories.filter(c => !(DISCIPLINE_CATS[form.discipline as Discipline] ?? []).includes(c)).map(c => (
              <button key={c} type="button" onClick={() => toggle(c)}
                className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border border-primary bg-primary/10 text-primary">
                <Check className="w-3 h-3 inline mr-1" />{c}
              </button>
            ))}
            {showCustomCat ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={customCatInput}
                  onChange={e => setCustomCatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); commitCustomCat(); }
                    if (e.key === "Escape") { setShowCustomCat(false); setCustomCatInput(""); }
                  }}
                  placeholder="e.g. Masters 45+"
                  className={`${inputCls} !py-2 w-36 text-[12px]`}
                />
                <button type="button" onClick={commitCustomCat}
                  className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                  Add
                </button>
                <button type="button" onClick={() => { setShowCustomCat(false); setCustomCatInput(""); }}
                  className="text-muted-dark hover:text-light transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowCustomCat(true)}
                className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border border-dark-lighter text-muted hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors">
                <Plus className="w-3 h-3 inline mr-1" /> Custom…
              </button>
            )}
          </div>
        </Field>
      )}

      <Field label="Experience level" required>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l.v} type="button" onClick={() => update({ level: l.v })}
              className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors ${form.level === l.v ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
              {l.l}
            </button>
          ))}
        </div>
      </Field>

      {/* Participant cap — chip picker */}
      <Field label="Participant cap" hint="Max registrations">
        <div className="flex flex-wrap gap-2 mb-3">
          {CAP_PRESETS.map(c => {
            const active = capMode === "preset" && form.cap === c;
            return (
              <button key={c} type="button"
                onClick={() => { update({ cap: c }); setCapMode("preset"); }}
                className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
                {parseInt(c).toLocaleString()}
              </button>
            );
          })}
          <button type="button"
            onClick={() => { update({ cap: "" }); setCapMode("unlimited"); }}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors ${capMode === "unlimited" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
            Unlimited
          </button>
          <button type="button"
            onClick={() => setCapMode("custom")}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors ${capMode === "custom" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
            Custom
          </button>
        </div>
        {capMode === "custom" && (
          <input type="number" value={form.cap} onChange={(e) => update({ cap: e.target.value })}
            placeholder="e.g. 4200" className={`${inputCls} w-40`} />
        )}
        {capMode === "unlimited" && (
          <p className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">No cap — open registrations until you close manually.</p>
        )}
      </Field>

      {/* Minimum age — chip picker */}
      <Field label="Minimum age" required>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button"
            onClick={() => { update({ minAge: "0" }); setAgeMode("open"); }}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors ${ageMode === "open" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
            Open to all
          </button>
          {AGE_PRESETS.map(a => {
            const active = ageMode === "preset" && form.minAge === a;
            return (
              <button key={a} type="button"
                onClick={() => { update({ minAge: a }); setAgeMode("preset"); }}
                className={`font-headline text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md border transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
                {a}+
              </button>
            );
          })}
          <button type="button"
            onClick={() => { update({ minAge: "" }); setAgeMode("custom"); }}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors ${ageMode === "custom" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
            Custom
          </button>
        </div>
        {ageMode === "custom" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-dark-lighter rounded-md overflow-hidden">
              <button type="button"
                onClick={() => update({ minAge: String(Math.max(0, (parseInt(form.minAge) || 0) - 1)) })}
                className="w-9 h-11 flex items-center justify-center text-muted-dark hover:text-light hover:bg-white/5 transition-colors font-headline text-lg select-none">
                −
              </button>
              <input
                type="number" value={form.minAge}
                onChange={(e) => update({ minAge: e.target.value })}
                placeholder="0"
                className="w-16 bg-dark-light px-2 py-3 text-[15px] text-light text-center placeholder:text-muted-dark focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button type="button"
                onClick={() => update({ minAge: String((parseInt(form.minAge) || 0) + 1) })}
                className="w-9 h-11 flex items-center justify-center text-muted-dark hover:text-light hover:bg-white/5 transition-colors font-headline text-lg select-none">
                +
              </button>
            </div>
            <span className="font-headline text-[13px] text-muted">years old minimum</span>
          </div>
        )}
        {ageMode === "open" && (
          <p className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">No age restriction — open to all ages.</p>
        )}
      </Field>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 4 — TICKETS & PRICING
   ══════════════════════════════════════════════════════════════ */
const INCLUSION_PRESETS = [
  "Finisher medal", "Timing chip", "Race bib", "Recovery bag",
  "Expo access", "T-shirt", "Nutrition", "Photos",
];

const REFUND_PRESETS: { v: string; l: string }[] = [
  { v: "no-refunds",  l: "No refunds"              },
  { v: "full-30",     l: "Full refund 30+ days out" },
  { v: "half-14",     l: "50% refund 14–30 days"    },
  { v: "deferrals",   l: "Deferrals accepted"        },
];

function refundPresetToText(v: string): string {
  return REFUND_PRESETS.find(r => r.v === v)?.l ?? v;
}

const STARTLINE_PCT  = 0.0395;
const STARTLINE_FLAT = 1.45;
const STRIPE_PCT     = 0.0175;
const STRIPE_FLAT    = 0.30;

function TicketsStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const updateWave = (i: number, patch: Partial<Wave>) => {
    const waves = [...form.waves];
    waves[i] = { ...waves[i], ...patch };
    update({ waves });
  };
  const removeWave = (i: number) => update({ waves: form.waves.filter((_, j) => j !== i) });
  const addWave    = () => update({ waves: [...form.waves, { label: "New wave", price: "", closes: "" }] });

  // Derive active inclusion chips from the form value
  const activeInclusions = form.inclusions
    ? form.inclusions.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  const toggleInclusion = (item: string) => {
    const next = activeInclusions.includes(item)
      ? activeInclusions.filter(x => x !== item)
      : [...activeInclusions, item];
    update({ inclusions: next.join(", ") });
  };

  const [showCustomInclusion,  setShowCustomInclusion]  = useState(false);
  const [customInclusionInput, setCustomInclusionInput] = useState("");

  const commitCustomInclusion = () => {
    const val = customInclusionInput.trim();
    if (val && !activeInclusions.includes(val)) {
      update({ inclusions: [...activeInclusions, val].join(", ") });
    }
    setCustomInclusionInput("");
    setShowCustomInclusion(false);
  };

  // Derive active refund chips from the form value
  const [refundSelected, setRefundSelected] = useState<string[]>(() => {
    return REFUND_PRESETS.filter(r => form.refundPolicy.includes(r.l)).map(r => r.v);
  });
  const [refundCustom, setRefundCustom] = useState(() => {
    // Any text that doesn't match a preset is treated as custom notes
    let text = form.refundPolicy;
    REFUND_PRESETS.forEach(r => { text = text.replace(r.l, "").replace(/^[.,\s]+|[.,\s]+$/g, ""); });
    return text.trim();
  });

  const buildRefundPolicy = (selected: string[], custom: string) => {
    const parts = [
      ...selected.map(refundPresetToText),
      ...(custom.trim() ? [custom.trim()] : []),
    ];
    return parts.join(". ");
  };

  const toggleRefund = (v: string) => {
    const next = refundSelected.includes(v)
      ? refundSelected.filter(x => x !== v)
      : [...refundSelected, v];
    setRefundSelected(next);
    update({ refundPolicy: buildRefundPolicy(next, refundCustom) });
  };

  const handleRefundCustom = (text: string) => {
    setRefundCustom(text);
    update({ refundPolicy: buildRefundPolicy(refundSelected, text) });
  };

  return (
    <div>
      {/* Registration type selector */}
      <Field label="Registration platform" required>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { value: "startline", title: "Startline",        sub: "Managed on this platform"      },
            { value: "external",  title: "External website", sub: "Link to your own registration" },
          ] as const).map(({ value, title, sub }) => {
            const active = form.registrationType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => update({ registrationType: value })}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 px-5 py-4 text-left transition-colors
                  ${active
                    ? "border-primary bg-primary/10"
                    : "border-dark-lighter hover:border-primary/40"}`}
              >
                <div className={`font-headline text-[13px] font-bold uppercase tracking-widest ${active ? "text-primary" : "text-light"}`}>
                  {title}
                </div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{sub}</div>
              </button>
            );
          })}
        </div>

        {form.registrationType === "startline" && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between mt-1">
              <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">Fee structure</div>
              <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">Startline fee: 3.95% + A$1.45 per ticket</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                {
                  value: "athlete",
                  title: "Athlete pays the fee",
                  sub: "Startline's fee added on top at checkout",
                },
                {
                  value: "organiser",
                  title: "Organiser absorbs the fee",
                  sub: "Fee deducted from your payout",
                },
              ] as const).map(({ value, title, sub }) => {
                const active = form.feeStructure === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update({ feeStructure: value })}
                    className={`flex flex-col items-start gap-1 rounded-xl border-2 px-5 py-4 text-left transition-colors
                      ${active
                        ? "border-primary bg-primary/10"
                        : "border-dark-lighter hover:border-primary/40"}`}
                  >
                    <div className={`font-headline text-[13px] font-bold uppercase tracking-widest ${active ? "text-primary" : "text-light"}`}>
                      {title}
                    </div>
                    <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{sub}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {form.registrationType === "external" && (
          <div className="mt-5">
            <Field label="Registration URL" required>
              <input
                value={form.registrationUrl}
                onChange={(e) => update({ registrationUrl: e.target.value })}
                placeholder="https://yourorg.com/events/sydney-2026"
                className={inputCls}
              />
            </Field>
          </div>
        )}
      </Field>

      <Field label="Ticket categories">
        <div className="space-y-3">
          {form.waves.map((w, i) => (
            <div key={i} className="bg-dark-light border border-dark-lighter rounded-lg p-4 space-y-3">
              {/* Row 1: number + category name */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-dark border border-dark-lighter flex items-center justify-center font-headline font-black italic text-primary text-[13px] shrink-0">
                  {i + 1}
                </div>
                <input value={w.label} onChange={(e) => updateWave(i, { label: e.target.value })}
                  placeholder="General admission"
                  className={`${inputCls} flex-1`} />
                <button onClick={() => removeWave(i)}
                  className="w-9 h-9 rounded text-muted-dark hover:text-primary hover:bg-white/5 flex items-center justify-center transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* Row 2: price + close date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">Price (A$)</div>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">Free</span>
                      <div
                        onClick={() => updateWave(i, { price: w.price === "0" ? "" : "0" })}
                        className={`relative w-8 h-4 rounded-full transition-colors duration-200 cursor-pointer ${w.price === "0" ? "bg-primary" : "bg-dark-lighter"}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${w.price === "0" ? "translate-x-4" : "translate-x-0.5"}`} />
                      </div>
                    </label>
                  </div>
                  {w.price === "0" ? (
                    <div className="w-full bg-primary/10 border border-primary/20 rounded-md px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-primary">
                      Free
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-headline text-[13px] text-muted">A$</span>
                      <input value={w.price} onChange={(e) => updateWave(i, { price: e.target.value })}
                        placeholder="129" className={`${inputCls} pl-9`} />
                    </div>
                  )}
                  {form.registrationType === "startline" && (() => {
                    const p = parseFloat(w.price);
                    if (!w.price || w.price === "0" || isNaN(p) || p <= 0) return null;
                    const startlineFee = p * STARTLINE_PCT + STARTLINE_FLAT;
                    const stripeFee    = p * STRIPE_PCT    + STRIPE_FLAT;
                    const athletePays  = form.feeStructure === "athlete" ? p + startlineFee : p;
                    const youReceive   = form.feeStructure === "athlete"
                      ? p - stripeFee
                      : p - startlineFee - stripeFee;
                    const fmt = (n: number) => `A$${n.toFixed(2)}`;
                    return (
                      <div className="mt-2 rounded-md bg-dark px-3 py-2.5 space-y-1">
                        {([
                          { label: "Athlete pays",  value: fmt(athletePays),   muted: false, sub: null              },
                          { label: "You receive",   value: fmt(youReceive),    muted: false, sub: "after Stripe fee" },
                          { label: "Startline fee", value: fmt(startlineFee),  muted: true,  sub: null              },
                        ] as const).map(r => (
                          <div key={r.label} className="flex items-baseline justify-between">
                            <span className="font-headline text-[13px] uppercase tracking-widest text-light">
                              {r.label}{r.sub && <span className="ml-1.5 normal-case text-[11px] text-muted">({r.sub})</span>}
                            </span>
                            <span className={`font-headline text-[14px] font-bold ${r.muted ? "text-muted" : "text-light"}`}>
                              {r.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-1.5">Category closes</div>
                  <DatePickerPopover
                    value={w.closes}
                    onChange={v => updateWave(i, { closes: v })}
                    placeholder="Optional close date"
                    disablePast={false}
                  />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addWave}
            className="w-full border border-dashed border-dark-lighter rounded-md py-3 font-headline text-[12px] uppercase tracking-widest text-muted hover:text-primary hover:border-primary/40 flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add ticket category
          </button>
        </div>
      </Field>

      {/* Inclusions — preset chips + custom input */}
      <Field label="What's included">
        <div className="flex flex-wrap gap-2">
          {INCLUSION_PRESETS.map(item => {
            const active = activeInclusions.includes(item);
            return (
              <button key={item} type="button" onClick={() => toggleInclusion(item)}
                className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border transition-colors flex items-center gap-1.5
                  ${active ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
                {active && <Check className="w-3 h-3" />}
                {item}
              </button>
            );
          })}
          {/* Custom inclusions added by organiser */}
          {activeInclusions.filter(i => !INCLUSION_PRESETS.includes(i)).map(item => (
            <button key={item} type="button" onClick={() => toggleInclusion(item)}
              className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border border-primary bg-primary/10 text-primary flex items-center gap-1.5">
              <Check className="w-3 h-3" />{item}
            </button>
          ))}
          {showCustomInclusion ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={customInclusionInput}
                onChange={e => setCustomInclusionInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); commitCustomInclusion(); }
                  if (e.key === "Escape") { setShowCustomInclusion(false); setCustomInclusionInput(""); }
                }}
                placeholder="e.g. Warm-up area access"
                className={`${inputCls} !py-2 w-44 text-[12px]`}
              />
              <button type="button" onClick={commitCustomInclusion}
                className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                Add
              </button>
              <button type="button" onClick={() => { setShowCustomInclusion(false); setCustomInclusionInput(""); }}
                className="text-muted-dark hover:text-light transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowCustomInclusion(true)}
              className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border border-dark-lighter text-muted hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors">
              <Plus className="w-3 h-3 inline mr-1" /> Custom…
            </button>
          )}
        </div>
      </Field>

      {/* Extras — keep as textarea */}
      {/* Activations — toggle + slide-in textarea */}
      {(() => {
        const on = form.activations !== "";
        return (
          <div className="border border-dark-lighter rounded-xl overflow-hidden mb-6">
            <button
              type="button"
              onClick={() => update({ activations: on ? "" : " " })}
              className="w-full flex items-center justify-between px-5 py-4 bg-dark-light hover:bg-dark-light/80 transition-colors"
            >
              <div>
                <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-light text-left">Activations</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-0.5 text-left">Brand activations, experiences &amp; sponsor zones</div>
              </div>
              <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-primary" : "bg-dark-lighter"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
              </div>
            </button>
            {on && (
              <div className="px-5 pb-5 pt-3 bg-dark-light border-t border-dark-lighter">
                <textarea
                  autoFocus
                  rows={3}
                  value={form.activations.trim() === "" ? "" : form.activations}
                  onChange={e => update({ activations: e.target.value })}
                  placeholder="Describe the activations available — e.g. recovery zone, supplement sampling, athlete village, sponsor booths…"
                  className={textareaCls}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* Optional extras — toggle + slide-in textarea */}
      {(() => {
        const on = form.extras !== "";
        return (
          <div className="border border-dark-lighter rounded-xl overflow-hidden mb-6">
            <button
              type="button"
              onClick={() => update({ extras: on ? "" : " " })}
              className="w-full flex items-center justify-between px-5 py-4 bg-dark-light hover:bg-dark-light/80 transition-colors"
            >
              <div>
                <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-light text-left">Optional extras</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-0.5 text-left">Add-ons athletes can purchase at checkout</div>
              </div>
              <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-primary" : "bg-dark-lighter"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
              </div>
            </button>
            {on && (
              <div className="px-5 pb-5 pt-3 bg-dark-light border-t border-dark-lighter">
                <textarea
                  autoFocus
                  rows={3}
                  value={form.extras.trim() === "" ? "" : form.extras}
                  onChange={e => update({ extras: e.target.value })}
                  placeholder="Race kit ($65), official photos ($45), merch bundle ($89)…"
                  className={textareaCls}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* Refund policy — preset chips + optional notes */}
      <Field label="Refund & transfer policy">
        <div className="flex flex-wrap gap-2 mb-3">
          {REFUND_PRESETS.map(({ v, l }) => {
            const active = refundSelected.includes(v);
            return (
              <button key={v} type="button" onClick={() => toggleRefund(v)}
                className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2.5 rounded-md border transition-colors flex items-center gap-1.5
                  ${active ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:border-primary/40 hover:text-light"}`}>
                {active && <Check className="w-3 h-3" />}
                {l}
              </button>
            );
          })}
        </div>
        <textarea rows={2} value={refundCustom}
          onChange={(e) => handleRefundCustom(e.target.value)}
          placeholder="Additional details, deferral windows, exceptions…"
          className={textareaCls} />
      </Field>


    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 5 — DETAILS & MEDIA
   ══════════════════════════════════════════════════════════════ */
function ExtrasStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  return (
    <div>
      <Field label="Cover image" required hint="Recommended 1920×1080 · max 5MB">
        <label className="block cursor-pointer">
          {(form.coverImage || form.coverImageUrl) ? (
            <div className="relative rounded-md border border-primary/40 overflow-hidden aspect-video">
              <img
                src={form.coverImage ? URL.createObjectURL(form.coverImage) : form.coverImageUrl}
                alt="Cover preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); update({ coverImage: null, coverImageUrl: "" }); }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-dark/70 text-muted hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-3 bg-dark/80 backdrop-blur-sm px-3 py-1.5 rounded-md">
                <div className="font-headline text-[11px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <Check className="w-3 h-3" /> Image ready
                </div>
              </div>
            </div>
          ) : (
            <div className="relative rounded-md border-2 border-dashed border-dark-lighter hover:border-primary/40 bg-dark-light aspect-video flex flex-col items-center justify-center transition-colors">
              <div className="w-12 h-12 rounded-full bg-dark border border-dark-lighter flex items-center justify-center mb-3">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div className="font-headline text-sm font-bold uppercase tracking-widest text-light">Drop cover image here</div>
              <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mt-1">or click to browse</div>
              <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-dark">JPG · PNG · WEBP</div>
            </div>
          )}
          <input type="file" accept="image/*" className="sr-only"
            onChange={(e) => update({ coverImage: e.target.files?.[0] ?? null })} />
        </label>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <Field label="Bag drop info">
          <textarea rows={3} placeholder="Complimentary, opens 06:00 at the event village…" className={textareaCls} />
        </Field>
        <Field label="Parking & transport">
          <textarea rows={3} placeholder="Car Park 4 & 6 · $15 flat. Olympic Park Station 5 min walk." className={textareaCls} />
        </Field>
      </div>

      <Field label="Accessibility">
        <textarea rows={2} value={form.accessibilityInfo} onChange={(e) => update({ accessibilityInfo: e.target.value })}
          placeholder="Wheelchair accessible venue, accessible parking in Car Park 4."
          className={textareaCls} />
      </Field>

      <Field label="Additional notes">
        <textarea rows={2} placeholder="Spectator entry is free. Dogs on lead welcome in outdoor areas."
          className={textareaCls} />
      </Field>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 6 — REVIEW
   ══════════════════════════════════════════════════════════════ */
function ReviewStep({ form, setStep, confirmed, onConfirm }: { form: FormState; setStep: (n: number) => void; confirmed: boolean; onConfirm: (v: boolean) => void }) {
  const rows: { k: string; v: string; step: number }[] = [
    { k: "Title",         v: form.title || "—",                                                              step: 0 },
    { k: "Discipline",    v: form.discipline ? form.discipline.toUpperCase() : "—",                          step: 0 },
    { k: "Date",          v: form.date
        ? form.endDate && form.endDate !== form.date
          ? `${new Date(form.date + "T00:00:00").toLocaleDateString("en-AU", { weekday:"short", day:"numeric", month:"short", year:"numeric" })} — ${new Date(form.endDate + "T00:00:00").toLocaleDateString("en-AU", { weekday:"short", day:"numeric", month:"short", year:"numeric" })}`
          : new Date(form.date + "T00:00:00").toLocaleDateString("en-AU", { weekday:"short", day:"numeric", month:"short", year:"numeric" })
        : "—", step: 1 },
    { k: "Start / End",   v: form.startTime ? `${fmt24to12(form.startTime)}${form.endTime ? ` → ${fmt24to12(form.endTime)}` : ""}` : "—", step: 1 },
    { k: "Venue",         v: `${form.venue || "—"}, ${form.city || "—"}, ${form.state ? form.state.toUpperCase() : "—"}`, step: 1 },
    { k: "Format",        v: form.format || "—",                                                              step: 2 },
    { k: "Level",         v: form.level  || "—",                                                              step: 2 },
    { k: "Categories",    v: form.categories.join(", ") || "—",                                              step: 2 },
    { k: "Cap / Min age", v: `${form.cap ? parseInt(form.cap).toLocaleString() : "∞"} · ${form.minAge === "0" ? "Open to all" : form.minAge ? `${form.minAge}+` : "—"}`,   step: 2 },
    { k: "Ticket categories", v: `${form.waves.length} categor${form.waves.length !== 1 ? "ies" : "y"}, from ${form.waves[0]?.price === "0" ? "Free" : form.waves[0]?.price ? `A$${form.waves[0].price}` : "—"}`, step: 3 },
    { k: "Cover image",   v: form.coverImage ? "Uploaded" : "Using placeholder",                             step: 4 },
    { k: "Registration",  v: form.registrationType === "startline" ? "Startline" : form.registrationUrl || "—", step: 3 },
    { k: "Fee structure", v: form.registrationType === "startline" ? (form.feeStructure === "athlete" ? "Athlete pays fee" : "Organiser absorbs fee") : "N/A (external)", step: 3 },
  ];

  return (
    <div>
      <div className="bg-dark border border-dark-lighter rounded-lg overflow-hidden mb-6">
        {rows.map((r, i) => (
          <div key={r.k} className={`flex items-center gap-4 px-5 py-4 ${i === rows.length - 1 ? "" : "border-b border-white/5"}`}>
            <div className="font-headline text-[11px] uppercase tracking-widest text-muted w-32 flex-shrink-0">{r.k}</div>
            <div className="flex-1 text-[14px] text-light truncate">{r.v}</div>
            <button onClick={() => setStep(r.step)}
              className="font-headline text-[11px] uppercase tracking-widest text-muted-dark hover:text-primary flex items-center gap-1 transition-colors">
              Edit <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-primary/5 border border-primary/30 rounded-md p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-primary text-dark flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <div className="font-headline text-[14px] font-black italic tracking-tighter text-light mb-1">
              Your listing is ready to publish.
            </div>
            <p className="text-[13px] text-muted leading-relaxed">
              Once published, athletes will be able to find your event in search and carousels.
              You&apos;ll receive a notification each time someone registers.
            </p>
          </div>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
          className="accent-primary w-4 h-4 mt-1 cursor-pointer"
        />
        <span className="text-[13px] text-muted leading-relaxed">
          I confirm I have the rights to host this event and the information provided is accurate.
          I agree to the{" "}
          <span className="text-primary hover:underline cursor-pointer">Organiser Terms</span> and{" "}
          <span className="text-primary hover:underline cursor-pointer">Event Listing Policy</span>.
        </span>
      </label>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIVE PREVIEW SIDEBAR
   ══════════════════════════════════════════════════════════════ */
const DISC_LABEL: Record<string, string> = {
  crossfit: "CrossFit", running: "Running", hybrid: "Hybrid", cycling: "Cycling", swimming: "Swimming",
};
const MONTHS_SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function LivePreview({ form }: { form: FormState }) {
  const sp    = (form.date    || "").split("-");
  const ep    = (form.endDate || "").split("-");
  const sDay  = sp[2] || "—";
  const sMon  = sp[1] ? MONTHS_SHORT[parseInt(sp[1]) - 1] : "—";
  const eDay  = ep[2];
  const eMon  = ep[1] ? MONTHS_SHORT[parseInt(ep[1]) - 1] : null;
  const price = form.waves.find(w => w.price === "0" || !!w.price)?.price;

  const dateLabel = form.date
    ? form.endDate && form.endDate !== form.date
      ? `${sDay} ${sMon} — ${eDay} ${eMon}`
      : `${sDay} ${sMon}${sp[0] ? ` ${sp[0]}` : ""}`
    : "Date TBC";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-lime-600">
          Live preview
        </span>
        <span className="font-headline text-[10px] uppercase tracking-widest text-gray-400">
        </span>
      </div>

      {/* Card */}
      <div className="bg-dark-darker rounded-xl border border-dark-lighter overflow-hidden">
        {/* Cover image */}
        <div className="relative h-52 placeholder-stripes scan-grid flex items-center justify-center overflow-hidden">
          {(form.coverImage || form.coverImageUrl) && (
            <img
              src={form.coverImage ? URL.createObjectURL(form.coverImage) : form.coverImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/50 to-transparent" />

          {/* DRAFT badge */}
          <div className="absolute top-3 left-3">
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-2.5 py-1 rounded-full">
              DRAFT
            </span>
          </div>

          {/* Date badge */}
          {form.date && (
            <div className="absolute top-3 right-3 bg-dark/80 backdrop-blur-sm px-3 py-1.5 rounded-md text-right">
              <div className="font-headline text-[9px] uppercase tracking-widest text-muted leading-none mb-0.5">{sMon}</div>
              <div className="font-headline text-xl font-black text-light leading-none">{sDay}</div>
            </div>
          )}

          {/* Title overlay */}
          <div className="absolute bottom-4 left-4 right-4">
            {form.discipline && (
              <div className="font-headline text-[10px] uppercase tracking-widest text-primary mb-1">
                {DISC_LABEL[form.discipline]}
              </div>
            )}
            <div className="font-headline text-lg font-black italic tracking-tighter text-light leading-tight line-clamp-2">
              {form.title || <span className="text-muted-dark/60">Event title…</span>}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Meta rows */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-px" />
              <span className="font-headline text-[11px] uppercase tracking-widest text-muted leading-snug">
                {form.venue
                  ? `${form.venue}${form.city ? `, ${form.city}` : ""}${form.state ? ` ${form.state.toUpperCase()}` : ""}`
                  : "Venue TBC"}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-3.5 h-3.5 text-primary shrink-0 mt-px" />
              <span className="font-headline text-[11px] uppercase tracking-widest text-muted leading-snug">
                {dateLabel}{form.startTime ? ` · ${fmt24to12(form.startTime)}` : ""}
              </span>
            </div>
            {form.format && (
              <div className="flex items-start gap-3">
                <Users className="w-3.5 h-3.5 text-primary shrink-0 mt-px" />
                <span className="font-headline text-[11px] uppercase tracking-widest text-muted">
                  {form.format === "both"       ? "Individual & Team"
                  : form.format === "individual" ? "Individual"
                  :                               "Team / Pairs"}
                </span>
              </div>
            )}
          </div>

          {/* Price */}
          {(price === "0" || !!price) && (
            <div className="mt-5 pt-4 border-t border-dark-lighter flex items-center justify-between">
              <span className="font-headline text-[10px] uppercase tracking-widest text-muted">Entry from</span>
              <span className="font-headline text-xl font-black italic tracking-tighter text-primary">{price === "0" ? "Free" : `A$${price}`}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FULL EVENT PAGE PREVIEW
   ══════════════════════════════════════════════════════════════ */
const STATE_LABELS_PREVIEW: Record<string, string> = {
  nsw: "NSW", vic: "VIC", qld: "QLD", wa: "WA",
  sa: "SA", tas: "TAS", act: "ACT", nt: "NT",
};
const FORMAT_LABELS_PREVIEW: Record<string, string> = {
  individual: "Individual", team: "Team / Pairs", both: "Individual & Team",
};
const LEVEL_LABELS_PREVIEW: Record<string, string> = {
  beginner: "Beginner Friendly", open: "Open (All Levels)", elite: "Elite / Pro",
};

function EventFullPreview({ form, onClose }: { form: FormState; onClose: () => void }) {
  const discipline = DISC_LABEL[form.discipline] || "—";
  const stateLabel = STATE_LABELS_PREVIEW[form.state] || form.state.toUpperCase();
  const formatLabel = FORMAT_LABELS_PREVIEW[form.format] || "—";
  const levelLabel = LEVEL_LABELS_PREVIEW[form.level] || "—";
  const ageLabel = form.minAge === "0" ? "Open to all" : form.minAge ? `${form.minAge}+` : "—";

  const dateLabel = (() => {
    if (!form.date) return "Date TBC";
    const d = new Date(form.date);
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
    if (form.endDate && form.endDate !== form.date) {
      const e = new Date(form.endDate);
      return `${d.toLocaleDateString("en-AU", { day: "numeric", month: "long" })} – ${e.toLocaleDateString("en-AU", opts)}`;
    }
    return d.toLocaleDateString("en-AU", opts);
  })();

  const inclusions = form.inclusions
    ? form.inclusions.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  const titleWords = (form.title || "Your Event Title").split(" ");

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex flex-col w-full h-full overflow-hidden modal-in">
        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-5 py-3 bg-dark-darker/95 backdrop-blur border-b border-dark-lighter shrink-0">
          <div className="flex items-center gap-3">
            <Eye className="w-4 h-4 text-primary" />
            <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Athlete view preview</span>
            <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark hidden sm:block">— This is how your listing will appear to athletes</span>
          </div>
          <button onClick={onClose}
            className="flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors">
            <X className="w-4 h-4" /> Close preview
          </button>
        </div>

        {/* Scrollable page mock */}
        <div className="relative flex-1 overflow-y-auto bg-dark-darker">

          {/* Hero */}
          <section className="relative h-72 sm:h-96 w-full overflow-hidden flex items-end">
            <div className="absolute inset-0 bg-gradient-to-br from-dark via-dark-lighter to-dark-darker" />
            {/* Grid texture */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(#d4ff00 1px, transparent 1px), linear-gradient(90deg, #d4ff00 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
            <div className="relative z-10 w-full px-6 sm:px-10 pb-8 sm:pb-12">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {form.discipline && (
                  <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-dark bg-primary px-3 py-1 rounded-full">{discipline}</span>
                )}
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/40 px-2.5 py-1 rounded-full">Draft</span>
              </div>
              <h1 className="font-headline text-4xl sm:text-6xl font-black italic tracking-tighter leading-none mb-3 text-light">
                {titleWords.map((word, i) =>
                  i === titleWords.length - 1
                    ? <span key={i} className="text-primary"> {word}</span>
                    : <span key={i}>{i > 0 ? " " : ""}{word}</span>
                )}
              </h1>
              <span className="inline-flex items-center gap-3 bg-primary/20 border border-primary/30 text-primary font-headline text-[12px] font-black uppercase tracking-widest px-6 py-3 rounded-xl cursor-default">
                Register Now <ExternalLink className="w-4 h-4" />
              </span>
            </div>
          </section>

          {/* Quick stats */}
          <div className="px-5 sm:px-10 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <Calendar className="w-4 h-4 text-primary" />, label: "Date", value: dateLabel },
                { icon: <Clock className="w-4 h-4 text-primary" />, label: "Start time", value: form.startTime ? fmt24to12(form.startTime) : "TBC" },
                { icon: <MapPin className="w-4 h-4 text-primary" />, label: "Location", value: form.city ? `${form.city}, ${stateLabel}` : "Location TBC" },
                { icon: <Users className="w-4 h-4 text-primary" />, label: "Format", value: formatLabel },
              ].map(s => (
                <div key={s.label} className="bg-dark rounded-xl px-4 py-3 flex items-center gap-3">
                  {s.icon}
                  <div>
                    <span className="font-headline text-[10px] tracking-widest text-muted uppercase block">{s.label}</span>
                    <span className="font-headline text-[13px] font-black text-light">{s.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 sm:px-10 pb-16 space-y-4">

            {/* 01 Overview */}
            <PreviewSection number="01" title="Event Overview">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-dark rounded-xl p-5">
                  <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 block">About This Event</span>
                  <p className="font-headline text-[13px] font-medium text-muted leading-relaxed">
                    {form.description || <span className="italic text-muted-dark">Full description will appear here.</span>}
                  </p>
                </div>
                <div className="bg-dark rounded-xl p-5 border-l-4 border-primary flex flex-col gap-4">
                  <div>
                    <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Discipline</span>
                    {form.discipline
                      ? <span className="bg-primary text-dark font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">{discipline}</span>
                      : <span className="text-muted-dark text-[12px]">—</span>}
                  </div>
                  <div>
                    <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-1 block">Level</span>
                    <span className="font-headline text-xl font-black italic text-light">{levelLabel}</span>
                  </div>
                  <div>
                    <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-1 block">Min age</span>
                    <span className="font-headline text-xl font-black italic text-light">{ageLabel}</span>
                  </div>
                </div>
              </div>
            </PreviewSection>

            {/* 02 Date, Time & Location */}
            <PreviewSection number="02" title="Date, Time & Location">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-dark rounded-xl p-5">
                  <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-primary" /> Date</span>
                  <div className="font-headline text-[15px] font-black text-light">{dateLabel}</div>
                </div>
                <div className="bg-dark rounded-xl p-5">
                  <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-primary" /> Times</span>
                  <div className="font-headline text-[13px] font-medium text-muted">Start: <span className="text-light font-bold">{form.startTime ? fmt24to12(form.startTime) : "TBC"}</span></div>
                  {form.endTime && <div className="font-headline text-[13px] font-medium text-muted mt-1">Cut-off: <span className="text-light font-bold">{fmt24to12(form.endTime)}</span></div>}
                </div>
                <div className="bg-dark rounded-xl p-5">
                  <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-primary" /> Venue</span>
                  <div className="font-headline text-[16px] font-black italic text-light leading-tight">{form.venue || "Venue TBC"}</div>
                  {form.address && <p className="font-headline text-[12px] text-muted mt-1">{form.address}</p>}
                  {form.city && <p className="font-headline text-[12px] uppercase tracking-widest text-muted mt-0.5">{form.city}{stateLabel ? `, ${stateLabel}` : ""}</p>}
                </div>
              </div>
            </PreviewSection>

            {/* 03 Categories */}
            {(form.categories.length > 0 || form.format) && (
              <PreviewSection number="03" title="Categories & Format">
                <div className="bg-dark rounded-xl p-5">
                  {form.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {form.categories.map(c => (
                        <span key={c} className="font-headline text-[11px] font-bold uppercase tracking-widest text-dark bg-primary px-3 py-1.5 rounded-full">{c}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-dark text-[12px] italic mb-4">No categories selected.</p>
                  )}
                  {form.format && (
                    <div className="pt-4 border-t border-dark-lighter flex items-center gap-3">
                      <span className="font-headline text-[10px] tracking-widest text-muted uppercase">Format</span>
                      <span className="font-headline text-[13px] font-bold text-light">{formatLabel}</span>
                    </div>
                  )}
                </div>
              </PreviewSection>
            )}

            {/* 04 Registration & Tickets */}
            {form.waves.some(w => w.price === "0" || !!w.price) && (
              <PreviewSection number="04" title="Registration & Tickets">
                <div className={`grid gap-4 ${form.waves.length === 1 ? "grid-cols-1" : form.waves.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                  {form.waves.filter(w => w.price === "0" || !!w.price).map((w, i) => (
                    <div key={i} className={`bg-dark rounded-xl p-5 ${i === 0 ? "border-l-4 border-primary" : ""}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Ticket className="w-4 h-4 text-primary" />
                        <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">{w.label || "General admission"}</span>
                      </div>
                      <div className="font-headline text-3xl font-black text-primary leading-none mb-1">{w.price === "0" ? "Free" : `A$${w.price}`}</div>
                      {w.closes && <div className="font-headline text-[11px] font-medium uppercase tracking-widest text-muted-dark">Closes {w.closes}</div>}
                    </div>
                  ))}
                </div>
                {/* Registration platform badge */}
                <div className="mt-4 flex items-center gap-3">
                  {form.registrationType === "startline" ? (
                    <div className="inline-flex items-center gap-2 bg-lime-500/10 border border-lime-500/30 rounded-full px-4 py-2">
                      <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Register on Startline</span>
                    </div>
                  ) : form.registrationUrl ? (
                    <div className="inline-flex items-center gap-2 bg-dark rounded-full px-4 py-2 border border-gray-700">
                      <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">External registration</span>
                      <span className="font-headline text-[11px] text-muted truncate max-w-[140px] sm:max-w-[200px]">{form.registrationUrl}</span>
                    </div>
                  ) : null}
                </div>

                {form.refundPolicy && (
                  <div className="bg-dark rounded-xl p-5 mt-4">
                    <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Refund Policy</span>
                    <p className="font-headline text-[13px] font-medium text-muted leading-relaxed">{form.refundPolicy}</p>
                  </div>
                )}
              </PreviewSection>
            )}

            {/* 05 What's included */}
            {(inclusions.length > 0 || form.extras || form.activations) && (
              <PreviewSection number="05" title="What&apos;s Included">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inclusions.length > 0 && (
                    <div className="bg-dark rounded-xl p-5">
                      <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 flex items-center gap-2"><Package className="w-3.5 h-3.5 text-primary" /> Included</span>
                      <div className="flex flex-wrap gap-2">
                        {inclusions.map(item => (
                          <span key={item} className="font-headline text-[11px] font-bold uppercase tracking-widest text-dark bg-primary/80 px-3 py-1.5 rounded-full">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {form.activations && form.activations.trim() && (
                    <div className="bg-dark rounded-xl p-5">
                      <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-primary" /> Activations</span>
                      <p className="font-headline text-[13px] font-medium text-muted leading-relaxed">{form.activations}</p>
                    </div>
                  )}
                  {form.extras && form.extras.trim() && (
                    <div className="bg-dark rounded-xl p-5">
                      <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 flex items-center gap-2"><ShoppingBag className="w-3.5 h-3.5 text-primary" /> Optional Extras</span>
                      <p className="font-headline text-[13px] font-medium text-muted leading-relaxed">{form.extras}</p>
                    </div>
                  )}
                </div>
              </PreviewSection>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="pt-2">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary/60">{number}</span>
        <div className="h-px flex-1 bg-dark-lighter" />
        <h2 className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">{title}</h2>
        <div className="h-px flex-1 bg-dark-lighter" />
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN WIZARD PAGE
   ══════════════════════════════════════════════════════════════ */
export default function NewListingPage() {
  const router = useRouter();
  const [step,     setStep]     = useState(0);
  const [form,     setForm]     = useState<FormState>(INITIAL);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [apiError,      setApiError]      = useState("");
  const [submitErrors,  setSubmitErrors]  = useState<number[]>([]);
  const [visited,       setVisited]       = useState<Set<number>>(new Set());
  const [confirmed,         setConfirmed]         = useState(false);
  const [showCancelModal,   setShowCancelModal]   = useState(false);
  const [showFullPreview,   setShowFullPreview]   = useState(false);
  const [direction,          setDirection]          = useState<"forward" | "back">("forward");
  const [showMobilePreview,  setShowMobilePreview]  = useState(false);
  const [eventId,   setEventId]   = useState<string | null>(null);

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  // Load existing event when navigating from listings edit button
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    setLoadingEvent(true);
    fetch(`/api/organiser/events/${id}`)
      .then(r => r.json())
      .then(e => {
        if (e.error) return;
        setEventId(id);
        setForm({
          title:             e.basics?.title        ?? "",
          discipline:        e.format?.discipline   ?? "",
          description:       e.basics?.description  ?? "",
          date:              e.schedule?.eventDate    ?? "",
          endDate:           e.schedule?.endDate      ?? "",
          startTime:         e.schedule?.startTime    ?? "",
          endTime:           e.schedule?.endTime      ?? "",
          venue:             e.schedule?.venue        ?? "",
          address:           e.schedule?.address      ?? "",
          city:              e.schedule?.city         ?? "",
          state:             e.schedule?.state        ?? "",
          format:            e.format?.format       ?? "",
          level:             e.format?.level        ?? "",
          categories:        Array.isArray(e.format?.categories) ? e.format.categories : [],
          cap:               e.format?.cap != null  ? String(e.format.cap) : "",
          minAge:            e.format?.minAge != null ? String(e.format.minAge) : "",
          waves:             Array.isArray(e.tickets?.waves) && e.tickets.waves.length ? e.tickets.waves : [{ label: "", price: "", closes: "" }],
          inclusions:        e.tickets?.inclusions   ?? "",
          extras:            e.tickets?.extras       ?? "",
          activations:       e.tickets?.activations  ?? "",
          refundPolicy:      e.tickets?.refundPolicy ?? "",
          registrationType:  (e.tickets?.registrationType === "external" ? "external" : "startline") as 'startline' | 'external',
          feeStructure:      (e.tickets?.feeStructure === "organiser" ? "organiser" : "athlete") as 'athlete' | 'organiser',
          registrationUrl:   e.tickets?.registrationUrl   ?? "",
          accessibilityInfo: e.details?.accessibilityInfo ?? "",
          coverImage:        null,
          coverImageUrl:     e.details?.coverImageUrl ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoadingEvent(false));
  }, []);

  const stepHasErrors = (s: number): boolean => {
    if (s === 0) return !(form.title.trim().length > 2);
    if (s === 1) return !(form.date && form.address.trim() && form.city.trim() && form.state);
    if (s === 2) return !(form.format && form.level && form.minAge !== "" && form.discipline);
    if (s === 3) return !(
      form.waves.length > 0 && (form.waves[0]?.price === "0" || !!form.waves[0]?.price) &&
      (form.registrationType === "startline" || !!form.registrationUrl.trim())
    );
    if (s === 4) return !(form.coverImage || form.coverImageUrl);
    if (s === 5) return !confirmed;
    return false;
  };

  const goTo = (target: number) => {
    setVisited(prev => new Set([...prev, step]));
    setDirection(target > step ? "forward" : "back");
    if (target !== 5) setConfirmed(false);
    setStep(target);
  };

  const submitToApi = async (asDraft: boolean, overrideTitle?: string) => {
    setSaving(true); setApiError(""); setSubmitErrors([]);
    try {
      let coverImageUrl: string | null = null;
      if (form.coverImage) {
        const fd = new FormData();
        fd.append("file", form.coverImage);
        fd.append("type", "cover");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (uploadRes.ok) {
          const { fileUrl } = await uploadRes.json();
          coverImageUrl = fileUrl;
        }
      }

      const payload = {
        submit: !asDraft,
        basics: {
          title: overrideTitle ?? form.title,
          description: form.description || null,
        },
        schedule: {
          eventDate: form.date,
          endDate: form.endDate || null,
          startTime: form.startTime,
          endTime: form.endTime || null,
          venue: form.venue,
          address: form.address || null,
          city: form.city,
          state: form.state,
        },
        format: {
          discipline: form.discipline,
          format: form.format,
          level: form.level,
          categories: form.categories,
          cap: form.cap ? parseInt(form.cap) : null,
          minAge: form.minAge ? parseInt(form.minAge) : 16,
        },
        tickets: {
          waves: form.waves,
          inclusions: form.inclusions || null,
          extras: form.extras || null,
          activations: form.activations || null,
          refundPolicy: form.refundPolicy || null,
          registrationType: form.registrationType,
          feeStructure: form.feeStructure,
          registrationUrl: form.registrationType === "external" ? form.registrationUrl : null,
        },
        details: {
          coverImageUrl: coverImageUrl ?? form.coverImageUrl ?? null,
          accessibilityInfo: form.accessibilityInfo || null,
        },
      };

      let res: Response;
      if (eventId) {
        res = await fetch(`/api/organiser/events/${eventId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/organiser/events", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) { setApiError(data.error ?? "Something went wrong."); return; }

      if (asDraft) {
        if (!eventId && data.id) setEventId(data.id);
        router.push("/organiser/dashboard");
      } else {
        router.push("/organiser/dashboard");
      }
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      goTo(step + 1);
    } else {
      // Pre-validate all steps before hitting the API
      const errs = [0, 1, 2, 3, 4, 5].filter(i => stepHasErrors(i));
      if (errs.length > 0) {
        setVisited(new Set([0, 1, 2, 3, 4, 5]));
        setSubmitErrors(errs);
        return;
      }
      submitToApi(false);
    }
  };
  const prev = () => {
    if (step > 0) {
      setVisited(s => new Set([...s, step]));
      setDirection("back");
      setStep(step - 1);
    } else {
      setShowCancelModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-dark-darker">
      <OrganiserTopBar />
      <div className="pt-14">

        <div className="anim-fade-slide">
          {/* Sticky header */}
          <div className="sticky top-16 z-30 bg-dark/95 backdrop-blur border-b border-dark-lighter">
            <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pt-3 pb-3">
              {/* Breadcrumb */}
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setShowCancelModal(true)}
                  className="flex items-center gap-1.5 text-muted-dark hover:text-primary font-headline text-[11px] uppercase tracking-widest transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Event Listings
                </button>
                <span className="text-dark-lighter">/</span>
                <span className="font-headline text-[11px] uppercase tracking-widest text-muted-light">Create new listing</span>
                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={() => setShowFullPreview(true)}
                    className="flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted-dark hover:text-primary transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                </div>
              </div>

              {/* Step rail */}
              <div className="flex items-center gap-0 overflow-x-auto no-scrollbar -mx-2 px-2">
                {STEPS.map((s, i) => {
                  const done    = visited.has(i) && !stepHasErrors(i) && i !== step;
                  const cur     = i === step;
                  const hasErr  = visited.has(i) && stepHasErrors(i) && !cur;
                  return (
                    <div key={s.k} className="flex items-center flex-1 min-w-0">
                      <button
                        onClick={() => goTo(i)}
                        className={`flex items-center gap-2.5 text-left transition-opacity min-w-0 ${cur ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
                      >
                        {/* Circle — hasErr takes priority over done */}
                        <div className={`relative w-8 h-8 rounded-md border flex items-center justify-center font-headline font-black italic text-[13px] flex-shrink-0
                          ${cur    ? "bg-primary text-dark border-primary"
                          : hasErr ? "bg-orange-400/10 text-orange-400 border-orange-400/40"
                          : done   ? "bg-dark-light text-primary border-primary/40"
                          :          "bg-dark border-dark-lighter text-muted-dark"}`}>
                          {hasErr ? <span className="text-[15px] leading-none font-black">!</span>
                           : done  ? <Check className="w-4 h-4" />
                           :         s.n}
                        </div>
                        <div className="hidden xl:block min-w-0">
                          <div className={`font-headline text-[11px] font-bold uppercase tracking-widest truncate ${cur ? "text-light" : hasErr ? "text-orange-400" : "text-muted"}`}>
                            {s.label}
                          </div>
                          <div className={`font-headline text-[10px] uppercase tracking-widest truncate ${hasErr ? "text-orange-400" : "text-muted-dark"}`}>
                            {hasErr ? "Missing required fields" : s.sub}
                          </div>
                        </div>
                      </button>
                      {i < STEPS.length - 1 && (
                        <div className="flex-1 h-px mx-3 bg-dark-lighter" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="max-w-[1280px] mx-auto grid lg:grid-cols-[1fr_360px]">
            <div className="p-4 sm:p-6 lg:p-8 pb-32 lg:pb-10">
              <div key={step} className={direction === "forward" ? "step-forward" : "step-back"}>
                <div className="mb-6">
                  <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
                    STEP {STEPS[step].n} / {STEPS[STEPS.length - 1].n}
                  </div>
                  <h1 className="font-headline text-[28px] sm:text-[38px] font-black italic tracking-tighter leading-none text-white">
                    {step === 0 && <>Let&apos;s start with<br /><span className="text-primary">the basics.</span></>}
                    {step === 1 && <>When and where<br /><span className="text-primary">do athletes race?</span></>}
                    {step === 2 && <>Pick the<br /><span className="text-primary">race format.</span></>}
                    {step === 3 && <>Tickets, categories<br /><span className="text-primary">and pricing.</span></>}
                    {step === 4 && <>Final details<br /><span className="text-primary">and cover image.</span></>}
                    {step === 5 && <>Review, then<br /><span className="text-primary">hit publish.</span></>}
                  </h1>
                  <p className="text-muted mt-2 max-w-lg text-[14px]">
                    {step === 0 && "Keep it short and sharp — this is what athletes will see first."}
                    {step === 1 && "Athletes will search your event by city, state and date."}
                    {step === 2 && "You can enable multiple formats. Functional fitness events commonly offer Individual and Doubles."}
                    {step === 3 && "Add ticket categories with pricing. You can edit dates and prices anytime before opening sales."}
                    {step === 4 && "Polish your listing with a cover image, logistics info and your registration link."}
                    {step === 5 && "Nothing's live yet. You can always come back to edit after publishing."}
                  </p>
                </div>

                {step === 0 && <BasicsStep  form={form} update={update} />}
                {step === 1 && <WhenStep    form={form} update={update} />}
                {step === 2 && <FormatStep  form={form} update={update} />}
                {step === 3 && <TicketsStep form={form} update={update} />}
                {step === 4 && <ExtrasStep  form={form} update={update} />}
                {step === 5 && <ReviewStep form={form} setStep={goTo} confirmed={confirmed} onConfirm={setConfirmed} />}

                {apiError && (
                  <div className="mt-4 px-4 py-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-300 font-headline text-[13px]">
                    {apiError}
                  </div>
                )}

                {submitErrors.length > 0 && (
                  <div className="mt-5 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                    <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[11px] font-black">!</span>
                      Before you can submit, please complete the following:
                    </p>
                    <ul className="space-y-2.5">
                      {submitErrors.map(i => (
                        <li key={i} className="flex items-start justify-between gap-4 py-2.5 px-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                          <div>
                            <p className="font-headline text-[12px] font-bold uppercase tracking-widest text-orange-600">{STEPS[i].n} — {STEPS[i].label}</p>
                            <p className="text-orange-500 text-[12px] mt-0.5">{STEP_ERRORS[i]}</p>
                          </div>
                          <button
                            onClick={() => { setSubmitErrors([]); goTo(i); }}
                            className="shrink-0 font-headline text-[11px] font-bold uppercase tracking-widest text-orange-500 hover:text-orange-700 flex items-center gap-1 transition-colors mt-0.5"
                          >
                            Fix now <ArrowRight className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ── Mobile preview (collapsible, sits above nav) ── */}
              <div className="lg:hidden mt-8 rounded-xl border border-dark-lighter overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMobilePreview(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-dark-light text-left"
                >
                  <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">
                    Event preview
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-200 ${showMobilePreview ? "rotate-180" : ""}`} />
                </button>
                {showMobilePreview && (
                  <div className="p-5 pt-0 bg-dark-light border-t border-dark-lighter">
                    <LivePreview form={form} />
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between pt-5 border-t border-dark-lighter">
                <button onClick={prev}
                  className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-2 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> {step === 0 ? "Cancel" : "Back"}
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => submitToApi(true, form.title.trim() || "Untitled draft")}
                    disabled={saving}
                    className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light px-5 py-3 transition-colors disabled:opacity-40"
                  >
                    Save draft
                  </button>
                  <button onClick={next} disabled={saving || (step === STEPS.length - 1 && !confirmed)}
                    className="bg-machined shadow-machined disabled:opacity-40 disabled:cursor-not-allowed text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform">
                    {saving
                      ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Saving…</>
                      : step === STEPS.length - 1
                        ? <><Check className="w-4 h-4" /> Publish listing</>
                        : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <aside className="hidden lg:block border-l border-dark-lighter bg-dark p-6 sticky top-[152px] h-[calc(100vh-152px)] overflow-y-auto">
              <LivePreview form={form} />
            </aside>
          </div>
        </div>
      </div>

      {/* ── Full event page preview modal ── */}
      {showFullPreview && (
        <EventFullPreview form={form} onClose={() => setShowFullPreview(false)} />
      )}

      {/* ── Cancel confirmation modal ── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
          <div className="relative bg-dark border border-dark-lighter rounded-2xl shadow-2xl w-full max-w-sm p-7 modal-in">
            <h2 className="font-headline text-[22px] font-black italic tracking-tight text-white mb-2">
              Leave without saving?
            </h2>
            <p className="text-muted text-[14px] leading-relaxed mb-7">
              Your event details haven't been saved yet. Save as a draft so you can come back and finish it later.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  setShowCancelModal(false);
                  await submitToApi(true, form.title.trim() || "Untitled draft");
                  router.push("/organiser/dashboard");
                }}
                disabled={saving}
                className="w-full font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? "Saving…" : <><Check className="w-4 h-4" /> Save draft &amp; leave</>}
              </button>
              <button
                onClick={() => router.push("/organiser/dashboard")}
                className="w-full font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md border border-dark-lighter text-muted hover:text-light hover:border-primary/40 transition-colors"
              >
                Discard &amp; leave
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="font-headline text-[12px] uppercase tracking-widest text-muted-dark hover:text-muted transition-colors text-center py-1"
              >
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
