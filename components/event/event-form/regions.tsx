"use client";

import { useEffect, useLayoutEffect, useRef, useState, startTransition, type ReactNode } from "react";
import Image from "next/image";
import {
  ArrowRight, Calendar, Check, ChevronDown, ChevronUp, Clock, ExternalLink, EyeOff, FileText,
  MapPin, Pencil, Plus, Ticket, Trash2, Upload, X,
} from "lucide-react";
import { keepInView, popIn, revealPanel, settleIn } from "./motion";
import { Button } from "@/components/ui/button";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import SuburbAutocomplete  from "@/components/ui/SuburbAutocomplete";
import LocationPreviewMap  from "@/components/organiser/LocationPreviewMap";
import DatePicker          from "@/components/ui/DatePicker";
import SelectMenu          from "@/components/ui/SelectMenu";
import TimePicker          from "@/components/ui/TimePicker";
import {
  BANNER_META_CLASS, BANNER_TITLE_CLASS, DISCIPLINE_PILL_CLASS, PRICING_ROW_CLASS,
  DetailLabel, DetailSub, DetailValue, PrizePoolCard, RequiredMark, SectionHeading, SidebarCard,
} from "@/components/event/EventDetailView";
import { formatDivisionLabel } from "@/lib/divisions";
import { isFreeEvent } from "@/lib/event-types";
import { normalisePrizeAmount } from "@/lib/prize-pool";
import { describeTiers } from "@/lib/refund-policy";
import { UPLOAD_LIMITS, TYPE_MIMES } from "@/lib/upload-limits";
import {
  formatCompetitionFormat, formatDiscipline, formatEventDate, formatEventDateRange, formatLevel, formatLongDate,
} from "@/lib/utils";
import { STATE_LABELS } from "@/types";
import {
  DISCIPLINES, DISCIPLINE_CATS, EMPTY_WAVE, FORMATS, INTENSITY_LEVELS, RichTextEditor, fmt24to12, inputCls, waveQty,
  type AusState, type Discipline, type FormState, type RegionId, type Wave,
} from "./shared";

/* Every control takes the whole form and a patch function, like the steps did. */
type Update = (patch: Partial<FormState>) => void;
interface Props { form: FormState; update: Update }

export const MAX_GALLERY_PHOTOS = 8;
export const MAX_INFO_PDFS = 10;
// Same caps the upload routes enforce. Checking at pick time matters because
// uploads are deferred to save: without this an oversized file is accepted
// silently and only fails when the organiser publishes (issue #300).
const MAX_PDF_BYTES   = UPLOAD_LIMITS.document.bytes;
const MAX_IMAGE_BYTES = UPLOAD_LIMITS.cover.bytes;
const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const oversizedMessage = (rejected: File[], maxBytes: number, kind: string) => {
  const first = rejected[0];
  const others = rejected.length > 1 ? ` (and ${rejected.length - 1} more)` : "";
  return `"${first.name}" is ${formatMb(first.size)}${others}. ${kind} must be ${formatMb(maxBytes)} or smaller.`;
};

/** An inline input that reads as the text it will become: no box, a dashed rule. */
const ghostInput =
  "bg-transparent border-0 border-b border-dashed border-light/25 hover:border-light/50 focus:border-primary focus:outline-none placeholder:text-placeholder transition-colors";

const chip = (on: boolean) =>
  `font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border transition-colors ${
    on ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-light hover:border-primary/40"
  }`;

const optionCard = (on: boolean) =>
  `flex flex-col items-start text-left gap-0.5 px-3 py-2.5 rounded-md border transition-colors ${
    on ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"
  }`;

/* ── Region chrome ─────────────────────────────────────────── */

/** The one line under a field that still needs filling in. Quiet on purpose. */
export function MissingHint({ message }: { message: string }) {
  return (
    <p className="mt-2 flex items-center gap-2 font-headline text-[10px] font-bold uppercase tracking-widest text-orange-300/90">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" aria-hidden="true" /> {message}
    </p>
  );
}

/**
 * One part of the page the organiser fills in. Its id is what the checklist
 * scrolls to. It draws nothing itself: an unfinished field shows it on its own
 * border or label, so the page never fills up with boxes.
 */
export function Region({ id, missing, children, className = "" }: {
  id: RegionId; missing?: string; children: ReactNode; className?: string;
}) {
  return (
    <div id={`region-${id}`} data-region={id} data-missing={missing ? "true" : undefined} className={`scroll-mt-48 ${className}`}>
      {children}
    </div>
  );
}

/** A row of the Event Details card: the public value, and its editor in place. */
export function EditableDetail({ id, label, value, placeholder, open, onToggle, onNext, nextLabel, missing, required = true, children }: {
  id: RegionId; label: string; value: ReactNode | null; placeholder: string; required?: boolean;
  open: boolean; onToggle: () => void; missing?: string; children: ReactNode;
  /** Move on from this row: the next unfinished one, or close when there is none. */
  onNext: () => void;
  nextLabel: string | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const hasValue = value != null;
  const hadValue = useRef(hasValue);
  useEffect(() => {
    if (!open) return;
    // Measure before the panel collapses for its opening animation: React has
    // just rendered it at full height, so this is where the row will end.
    keepInView(rowRef.current);
    revealPanel(panelRef.current);
  }, [open]);
  // A row filled in for the first time lets its value settle in, so the
  // organiser sees where what they chose landed on the page.
  useEffect(() => {
    if (hasValue && !hadValue.current) settleIn(valueRef.current);
    hadValue.current = hasValue;
  }, [hasValue]);

  return (
    <Region id={id} missing={open ? undefined : missing}>
      <div ref={rowRef} className={`-mx-3 px-3 py-2 rounded-lg transition-colors ${open ? "bg-dark-light" : "hover:bg-white/[0.03]"}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? "Done editing" : "Edit"} ${id}`}
          className="w-full flex items-start justify-between gap-3 text-left group"
        >
          <div className="min-w-0">
            <DetailLabel>
              <span className={missing && !open ? "text-orange-300" : undefined}>{label}</span>
              {required && <RequiredMark />}
            </DetailLabel>
            <div ref={valueRef}>
              {value ?? (
                <p className={`font-headline text-sm italic ${missing && !open ? "text-orange-300/80" : "text-placeholder"}`}>{placeholder}</p>
              )}
            </div>
          </div>
          <span className="mt-1 shrink-0 inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-muted group-hover:text-primary transition-colors">
            {open ? <><Check className="w-3 h-3" /> Done</> : <><Pencil className="w-3 h-3" /> {value ? "Edit" : "Add"}</>}
          </span>
        </button>
        {open && (
          <div ref={panelRef} className="pt-4 pb-1 space-y-4">
            {children}
            <div className="flex justify-end pt-1">
              <button type="button" onClick={onNext}
                className="inline-flex items-center gap-1.5 rounded-full border border-dark-lighter px-3 py-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-light hover:border-primary/50 hover:text-primary transition-colors">
                {nextLabel ? <>Next: {nextLabel} <ArrowRight className="w-3 h-3" /></> : <><Check className="w-3 h-3" /> Done</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </Region>
  );
}

function MiniField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-light">{label}</span>
        {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/* ── Banner ────────────────────────────────────────────────── */

export function CoverMedia({ src }: { src: string | null }) {
  return src
    ? <Image src={src} alt="Cover preview" fill unoptimized={src.startsWith("blob:")} sizes="100vw" className="object-cover" />
    : <div className="absolute inset-0 placeholder-stripes scan-grid" />;
}

/**
 * The banner itself is the cover upload: click anywhere above the title. With
 * a cover in place the controls move to the corner, out of the photo's way.
 */
export function CoverControls({ form, update, missing }: Props & { missing?: string }) {
  const [error, setError] = useState("");
  const hasCover = !!(form.coverImage || form.coverImageUrl);

  const pick = (file: File | null) => {
    if (file && file.size > MAX_IMAGE_BYTES) {
      setError(oversizedMessage([file], MAX_IMAGE_BYTES, "Images"));
      return;
    }
    setError("");
    update({ coverImage: file });
  };
  const input = (
    <input type="file" accept={TYPE_MIMES.cover.join(",")} className="sr-only" aria-label="Cover image"
      onChange={e => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
  );

  return (
    <div id="region-cover" data-region="cover" data-missing={missing ? "true" : undefined} className="absolute inset-0">
      {hasCover ? (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-full bg-dark/80 backdrop-blur px-3.5 py-2 font-headline text-[10px] font-bold uppercase tracking-widest text-light hover:text-primary transition-colors">
            <Upload className="w-3.5 h-3.5" /> Change cover
            {input}
          </label>
          <button type="button" onClick={() => update({ coverImage: null, coverImageUrl: "" })} aria-label="Remove cover image"
            className="w-8 h-8 rounded-full bg-dark/80 backdrop-blur text-light hover:text-primary flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="absolute inset-0 cursor-pointer group flex items-start justify-center pt-5 sm:pt-6">
          <span className={`flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-5 py-3.5 sm:px-6 sm:py-5 bg-dark/60 backdrop-blur-sm transition-colors ${
            missing ? "border-orange-400/70" : "border-light/25 group-hover:border-primary/60"
          }`}>
            <Upload className="w-6 h-6 text-primary" />
            <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">Upload cover image<RequiredMark /></span>
            <span className="font-headline text-[10px] uppercase tracking-widest text-muted">JPG · PNG · WEBP · 1920×1080</span>
          </span>
          {input}
        </label>
      )}
      {error && (
        <p className="absolute top-3 left-3 right-3 sm:right-auto z-10 rounded-md bg-dark/90 px-3 py-2 font-headline text-[10px] uppercase tracking-widest text-red-400">{error}</p>
      )}
    </div>
  );
}

/** The discipline pill. Picking one opens a sheet, since the banner clips popovers. */
export function DisciplinePill({ form, update, missing }: Props & { missing?: string }) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    popIn(sheetRef.current, 0.97);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span id="region-discipline" data-region="discipline" data-missing={missing ? "true" : undefined} className="inline-block scroll-mt-48">
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Choose discipline"
        className={form.discipline
          ? `${DISCIPLINE_PILL_CLASS} inline-flex items-center gap-1.5 hover:brightness-110`
          : `inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-dashed ${
              missing ? "border-orange-400/80 text-orange-300" : "border-primary/70 text-primary"
            } bg-dark/60 hover:bg-primary/10 transition-colors`}>
        {form.discipline ? formatDiscipline(form.discipline) : <><Plus className="w-3 h-3" /> Discipline<RequiredMark /></>}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 overlay-in" role="dialog" aria-modal="true" aria-label="Discipline">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div ref={sheetRef} className="relative w-full sm:max-w-lg bg-dark border border-dark-lighter rounded-t-2xl sm:rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline text-[18px] font-black italic tracking-tight text-light">Discipline</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="w-8 h-8 rounded-full text-light hover:text-primary flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {DISCIPLINES.map(d => {
                const on = form.discipline === d.v;
                return (
                  <button key={d.v} type="button"
                    onClick={() => {
                      if (!on) update({ discipline: d.v, categories: [] });
                      setOpen(false);
                      // Next on the banner is the name, so the cursor goes there.
                      const title = document.querySelector<HTMLTextAreaElement>("#region-title textarea");
                      if (title && !title.value.trim()) requestAnimationFrame(() => title.focus());
                    }}
                    className={`text-left p-3.5 rounded-md border transition-colors ${on ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"}`}>
                    <div className={`font-headline text-[15px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{d.l}</div>
                    <div className="font-headline text-[10px] uppercase tracking-widest text-muted mt-1">{d.d}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

/** The h1, typed straight into. A textarea so a long name wraps as the title does. */
export function TitleInput({ form, update, missing }: Props & { missing?: string }) {
  // Grows with the text where the browser has no field-sizing (Firefox, Safari).
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || CSS.supports("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [form.title]);

  return (
    // The size sits on the wrapper too: globals.css lifts phone inputs to
    // max(16px, 1em) against iOS zoom, and 1em is the parent's size.
    <div id="region-title" data-region="title" data-missing={missing ? "true" : undefined} className="scroll-mt-48 mb-2 text-[28px] sm:text-4xl lg:text-5xl">
      <textarea
        ref={ref}
        rows={1}
        maxLength={80}
        value={form.title}
        onChange={e => update({ title: e.target.value.replace(/\n/g, " ") })}
        onKeyDown={e => {
          if (e.key !== "Enter") return;
          // Enter finishes the name and moves on to the description below it.
          e.preventDefault();
          const next = document.querySelector<HTMLElement>("#region-description [contenteditable]");
          next?.scrollIntoView({ behavior: "smooth", block: "center" });
          next?.focus({ preventScroll: true });
        }}
        placeholder="e.g. Apex Throwdown Sydney 2026"
        aria-label="Event title"
        className={`${BANNER_TITLE_CLASS} !mb-0 block w-full resize-none overflow-hidden [field-sizing:content] ${ghostInput} ${
          missing ? "!border-orange-400" : ""
        }`}
      />
      <div className="flex items-center justify-between mt-1">
        {missing ? <MissingHint message={missing} /> : (
          <span className="font-headline text-[10px] uppercase tracking-widest text-muted">Event title<RequiredMark /></span>
        )}
        <span className="font-headline text-[10px] uppercase tracking-widest text-muted">{form.title.length}/80</span>
      </div>
    </div>
  );
}

/** Location and date under the title, as athletes read them. Each opens its row. */
export function BannerMeta({ form, onOpen }: { form: FormState; onOpen: (id: RegionId) => void }) {
  const place = [form.venue.trim() || form.city.trim(), form.state ? STATE_LABELS[form.state] : ""].filter(Boolean).join(", ");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => onOpen("location")} className={`${BANNER_META_CLASS} hover:text-primary transition-colors`}>
        <MapPin className="w-3.5 h-3.5 text-primary" />
        {place || <span className="italic text-placeholder normal-case tracking-normal">Add a venue</span>}
      </button>
      <button type="button" onClick={() => onOpen("date")} className={`${BANNER_META_CLASS} hover:text-primary transition-colors`}>
        <Calendar className="w-3.5 h-3.5 text-primary" />
        {form.date ? dateLabel(form) : <span className="italic text-placeholder normal-case tracking-normal">Add a date</span>}
      </button>
    </div>
  );
}

export function dateLabel(form: Pick<FormState, "date" | "endDate">): string {
  return form.endDate && form.endDate !== form.date
    ? formatEventDateRange(form.date, form.endDate)
    : formatEventDate(form.date);
}

/* ── Main column ───────────────────────────────────────────── */

export function DescriptionEditor({ form, update, missing }: Props & { missing?: string }) {
  return (
    <Region id="description" missing={missing}>
      <RichTextEditor value={form.description} onChange={html => update({ description: html })} invalid={!!missing} />
      {missing && <MissingHint message={missing} />}
    </Region>
  );
}

export function PrizePoolEditor({ form, update }: Props) {
  if (!form.prizeMoney) {
    return (
      <button type="button" onClick={() => update({ prizeMoney: true })}
        className="w-full rounded-xl border border-dashed border-dark-lighter hover:border-primary/40 px-5 py-4 flex items-center gap-3 text-left transition-colors group">
        <Plus className="w-4 h-4 text-primary shrink-0" />
        <span>
          <span className="block font-headline text-[12px] font-bold uppercase tracking-widest text-light group-hover:text-primary transition-colors">Add a prize pool</span>
          <span className="block font-headline text-[10px] uppercase tracking-widest text-muted mt-0.5">Optional. Shown when the event offers cash prizes</span>
        </span>
      </button>
    );
  }
  return (
    <PrizePoolCard amount={normalisePrizeAmount(form.prizeMoneyAmount)}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-baseline gap-1 font-headline text-xl font-black text-primary leading-tight">
            <span>$</span>
            <input value={form.prizeMoneyAmount} onChange={e => update({ prizeMoneyAmount: e.target.value })}
              placeholder="2,000" aria-label="Total prize pool"
              className={`${ghostInput} w-28 text-primary font-black`} />
            <span className="whitespace-nowrap">prize pool</span>
          </div>
          <input value={form.prizeMoneyDetails} onChange={e => update({ prizeMoneyDetails: e.target.value })}
            placeholder="How it's awarded, e.g. podium finishers per division" aria-label="How the prize pool is awarded"
            className={`${ghostInput} w-full font-headline text-[11px] font-medium uppercase tracking-widest text-muted`} />
        </div>
        <button type="button" onClick={() => update({ prizeMoney: false })} aria-label="Remove prize pool"
          className="w-8 h-8 rounded-full text-muted hover:text-primary hover:bg-white/5 flex items-center justify-center transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </PrizePoolCard>
  );
}

const STARTLINE_PCT  = 0.0395;
const STARTLINE_FLAT = 1.45;
const STRIPE_PCT     = 0.0175;
const STRIPE_FLAT    = 0.30;

function FeeBreakdown({ price, feeStructure }: { price: string; feeStructure: FormState["feeStructure"] }) {
  const p = parseFloat(price);
  if (!price || price === "0" || isNaN(p) || p <= 0) return null;
  const startlineFee = p * STARTLINE_PCT + STARTLINE_FLAT;
  const stripeFee    = p * STRIPE_PCT + STRIPE_FLAT;
  const athletePays  = feeStructure === "athlete" ? p + startlineFee : p;
  const youReceive   = feeStructure === "athlete" ? p - stripeFee : p - startlineFee - stripeFee;
  const fmt = (n: number) => `A$${n.toFixed(2)}`;
  const cell = (label: string, value: string, note?: string) => (
    <div className="min-w-0">
      <div className="font-headline text-[9px] font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className="font-headline text-[14px] font-bold text-light tabular-nums">{value}</div>
      {note && <div className="font-headline text-[9px] uppercase tracking-widest text-muted-dark">{note}</div>}
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-3 rounded-lg bg-dark-darker/60 px-4 py-3" data-testid="fee-breakdown">
      {cell("Athlete pays", fmt(athletePays))}
      {cell("You receive", fmt(youReceive), "After Stripe fee")}
      {cell("Startline fee", fmt(startlineFee))}
    </div>
  );
}

/** A labelled field in a ticket card: the label above, a hint under it. */
function TicketField({ label, htmlFor, required, hint, className = "", children }: {
  label: string; htmlFor?: string; required?: boolean; hint?: string; className?: string; children: ReactNode;
}) {
  const Label = htmlFor ? "label" : "p";
  return (
    <div className={`min-w-0 ${className}`}>
      <Label htmlFor={htmlFor} className="block font-headline text-[10px] font-bold uppercase tracking-widest text-light mb-1.5">
        {label}{required && <RequiredMark />}
      </Label>
      {children}
      {hint && <p className="font-headline text-[10px] tracking-wide text-muted mt-1.5 leading-snug">{hint}</p>}
    </div>
  );
}

const ticketInput = `${inputCls} !py-2.5 text-[14px]`;

/**
 * The Pricing section: one card per ticket category, filled in top to bottom
 * (name, price, how many), so a first-time organiser can follow it without
 * knowing the page. Wave start and closing date are tucked behind a link.
 */
export function TicketsEditor({ form, update, missing }: Props & { missing?: string }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const updateWave = (i: number, patch: Partial<Wave>) => {
    const waves = [...form.waves]; waves[i] = { ...waves[i], ...patch }; update({ waves });
  };
  const removeWave = (i: number) => {
    update({ waves: form.waves.filter((_, j) => j !== i) });
    setExpanded(new Set());
  };
  const addWave = () => update({ waves: [...form.waves, EMPTY_WAVE] });
  const toggle = (i: number) => setExpanded(prev => {
    const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next;
  });
  const quantities = form.waves.map(waveQty);
  const allLimited = quantities.length > 0 && quantities.every(q => q !== null);
  const totalTickets = quantities.reduce<number>((sum, q) => sum + (q ?? 0), 0);

  return (
    <Region id="tickets" missing={missing}>
      <SectionHeading required>Pricing</SectionHeading>
      <p className="text-[13px] text-muted leading-relaxed -mt-1 mb-4">
        Add each ticket athletes can buy, such as General entry or Early bird. Athletes see the name and price.
      </p>

      <div className="space-y-3">
        {form.waves.map((w, i) => {
          const open = expanded.has(i) || !!(w.startTime || w.closes);
          const free = w.price === "0";
          const labelMissing = !!missing && !w.label.trim();
          const priceMissing = !!missing && !free && !(parseFloat(w.price) >= 0);
          const id = `ticket-${i}`;
          return (
            <div key={i} data-testid="ticket-row" className="bg-dark rounded-xl border border-dark-lighter p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">
                  Ticket {i + 1}
                </span>
                {form.waves.length > 1 && (
                  <button type="button" onClick={() => removeWave(i)} aria-label="Remove this ticket category"
                    className="inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_200px] gap-4">
                <TicketField label="Ticket name" htmlFor={`${id}-name`} required hint="What athletes choose at checkout.">
                  <input id={`${id}-name`} value={w.label} onChange={e => updateWave(i, { label: e.target.value })}
                    placeholder="e.g. General entry" aria-label="Ticket category name"
                    className={`${ticketInput} ${labelMissing ? "!border-orange-400/70" : ""}`} />
                </TicketField>

                <TicketField label="Price" htmlFor={`${id}-price`} required>
                  <div className="flex items-stretch gap-2">
                    {free ? (
                      <div className="flex-1 flex items-center rounded-md border border-primary/30 bg-primary/10 px-4 font-headline text-[13px] font-bold uppercase tracking-widest text-primary">
                        Free
                      </div>
                    ) : (
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-headline text-[13px] text-muted pointer-events-none">A$</span>
                        <input id={`${id}-price`} value={w.price} inputMode="decimal" placeholder="0.00" aria-label="Ticket price"
                          onChange={e => updateWave(i, { price: e.target.value.replace(/[^\d.]/g, "") })}
                          className={`${ticketInput} !pl-10 tabular-nums ${priceMissing ? "!border-orange-400/70" : ""}`} />
                      </div>
                    )}
                    <button type="button" aria-pressed={free} onClick={() => updateWave(i, { price: free ? "" : "0" })}
                      className={`shrink-0 rounded-md border px-3 font-headline text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        free ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-muted hover:text-primary hover:border-primary/40"
                      }`}>
                      Free
                    </button>
                  </div>
                </TicketField>
              </div>

              <TicketField label="Tickets available" htmlFor={`${id}-qty`} className="sm:max-w-[260px]"
                hint="Leave blank for no limit. Only you see this. Sales stop when it runs out.">
                <div className="relative">
                  <input id={`${id}-qty`} value={w.qty} inputMode="numeric" placeholder="No limit" aria-label="Tickets available"
                    onChange={e => updateWave(i, { qty: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    className={`${ticketInput} !pr-10 tabular-nums`} />
                  <EyeOff className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                </div>
              </TicketField>

              {open ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <TicketField label="Wave start time" hint="Optional. Leave blank to use the event start.">
                    <TimePicker value={w.startTime} onChange={v => updateWave(i, { startTime: v })} placeholder="Same as event start" ariaLabel="Wave start time" />
                  </TicketField>
                  <TicketField label="Sales close" hint="Optional. The last day this ticket can be bought.">
                    <DatePicker value={w.closes} onChange={v => updateWave(i, { closes: v })} placeholder="Open until the event" disablePast={false} maxDate={form.endDate || form.date} />
                  </TicketField>
                  {!(w.startTime || w.closes) && (
                    <button type="button" onClick={() => toggle(i)}
                      className="sm:col-span-2 justify-self-start inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors">
                      <ChevronUp className="w-3 h-3" /> Hide
                    </button>
                  )}
                </div>
              ) : (
                <button type="button" onClick={() => toggle(i)} aria-expanded={false}
                  className="inline-flex items-start gap-1.5 text-left font-headline text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors">
                  <Plus className="w-3 h-3 mt-px shrink-0" />
                  <span>Wave start or sales close <span className="text-muted-dark">· Optional</span></span>
                </button>
              )}

              {form.registrationType === "startline" && <FeeBreakdown price={w.price} feeStructure={form.feeStructure} />}
            </div>
          );
        })}

        {allLimited && (
          <p className="px-1 font-headline text-[10px] uppercase tracking-widest text-muted" data-testid="ticket-total">
            {totalTickets.toLocaleString()} ticket{totalTickets === 1 ? "" : "s"} in total · registrations close when they sell out
          </p>
        )}
        {!allLimited && form.cap && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3" data-testid="legacy-cap">
            <p className="text-[12.5px] text-muted-light leading-relaxed">
              This event also has an overall limit of <span className="font-bold text-light">{parseInt(form.cap).toLocaleString()} entries</span>,
              set before ticket quantities. Give every ticket a quantity to replace it, or remove it.
            </p>
            <button type="button" onClick={() => update({ cap: "" })}
              className="font-headline text-[10px] font-bold uppercase tracking-widest text-light hover:text-primary transition-colors">
              Remove limit
            </button>
          </div>
        )}

        <button type="button" onClick={addWave}
          className="w-full border border-dashed border-dark-lighter rounded-xl py-3 font-headline text-[12px] uppercase tracking-widest text-light hover:text-primary hover:border-primary/40 flex items-center justify-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Add another ticket
        </button>
      </div>
      {missing && <MissingHint message={missing} />}
    </Region>
  );
}

function GalleryThumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-dark">
      <Image src={src} alt="" fill unoptimized={src.startsWith("blob:")} sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
      <button type="button" onClick={onRemove} aria-label="Remove photo"
        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-dark/80 text-light hover:text-primary flex items-center justify-center transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Gallery, laid out like the public one. `photoSrcs` are the new files' object URLs. */
export function GalleryEditor({ form, update, photoSrcs }: Props & { photoSrcs: string[] }) {
  const [error, setError] = useState("");
  const count = form.photoUrls.length + form.photos.length;
  const add = (list: FileList | null) => {
    const picked = Array.from(list ?? []).filter(f => (TYPE_MIMES.photo as readonly string[]).includes(f.type));
    const files = picked.filter(f => f.size <= MAX_IMAGE_BYTES);
    const rejected = picked.filter(f => f.size > MAX_IMAGE_BYTES);
    setError(rejected.length ? oversizedMessage(rejected, MAX_IMAGE_BYTES, "Images") : "");
    const remaining = MAX_GALLERY_PHOTOS - count;
    if (files.length && remaining > 0) update({ photos: [...form.photos, ...files.slice(0, remaining)] });
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <SectionHeading>Gallery</SectionHeading>
        <span className="font-headline text-[10px] uppercase tracking-widest text-muted">{count}/{MAX_GALLERY_PHOTOS} · Optional</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {form.photoUrls.map((url, i) => (
          <GalleryThumb key={url} src={url} onRemove={() => update({ photoUrls: form.photoUrls.filter((_, j) => j !== i) })} />
        ))}
        {form.photos.map((file, i) => photoSrcs[i] ? (
          <GalleryThumb key={`${file.name}-${file.lastModified}-${i}`} src={photoSrcs[i]}
            onRemove={() => update({ photos: form.photos.filter((_, j) => j !== i) })} />
        ) : null)}
        {count < MAX_GALLERY_PHOTOS && (
          <label className="aspect-video rounded-xl border-2 border-dashed border-dark-lighter hover:border-primary/40 flex flex-col items-center justify-center cursor-pointer transition-colors">
            <Plus className="w-5 h-5 text-primary mb-1" />
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-light">Add photos</span>
            <span className="font-headline text-[9px] uppercase tracking-widest text-muted mt-0.5">Venue, atmosphere, past editions</span>
            <input type="file" accept={TYPE_MIMES.photo.join(",")} multiple className="sr-only" aria-label="Gallery photos"
              onChange={e => { add(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {error && <p className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

export function ReviewsPlaceholder() {
  return (
    <div>
      <SectionHeading>Reviews</SectionHeading>
      <p className="rounded-xl border border-dashed border-dark-lighter px-5 py-4 font-headline text-[11px] uppercase tracking-widest text-muted">
        Reviews of your organisation appear here automatically.
      </p>
    </div>
  );
}

/* ── Sidebar ───────────────────────────────────────────────── */

/** The register buttons as athletes see them, with how registration works beneath. */
export function RegistrationEditor({ form, update, missing }: Props & { missing?: string }) {
  const external = form.registrationType === "external";
  const freeRsvp = isFreeEvent(form.waves) && !external;
  return (
    <div className="flex flex-col gap-3">
      <Button asChild variant="machined" size="ctaLg">
        <span aria-disabled="true">
          {freeRsvp ? "I'm going" : "Register Now"}
          {external ? <ExternalLink className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
        </span>
      </Button>

      <Region id="registration" missing={missing}>
        <div className="rounded-xl border border-dashed border-dark-lighter p-4">
          <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-light mb-2.5">How athletes register</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "startline", title: "Startline",        sub: "Managed here"     },
              { value: "external",  title: "External website", sub: "Your own page"    },
            ] as const).map(({ value, title, sub }) => {
              const on = form.registrationType === value;
              return (
                <button key={value} type="button" aria-pressed={on} onClick={() => update({ registrationType: value })}
                  className={optionCard(on)}>
                  <span className={`font-headline text-[12px] font-bold uppercase tracking-widest ${on ? "text-primary" : "text-light"}`}>{title}</span>
                  <span className="font-headline text-[10px] uppercase tracking-widest text-muted">{sub}</span>
                </button>
              );
            })}
          </div>
          {external ? (
            <input value={form.registrationUrl} onChange={e => update({ registrationUrl: e.target.value })} required
              placeholder="https://yourorg.com/events/sydney-2026" aria-label="Registration URL"
              className={`${inputCls} mt-3 !py-2.5 text-[13px] ${missing ? "!border-orange-400/60" : ""}`} />
          ) : (
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted mt-2.5 leading-relaxed">
              Athlete pays the fee at checkout. Startline fee: 3.95% + A$1.45 per ticket
            </p>
          )}
          {missing && <MissingHint message={missing} />}
        </div>
      </Region>
    </div>
  );
}

export const AUS_STATES: [AusState, string, string][] = [
  ["nsw", "NSW", "New South Wales"],
  ["vic", "VIC", "Victoria"],
  ["qld", "QLD", "Queensland"],
  ["wa",  "WA",  "Western Australia"],
  ["sa",  "SA",  "South Australia"],
  ["tas", "TAS", "Tasmania"],
  ["act", "ACT", "Australian Capital Territory"],
  ["nt",  "NT",  "Northern Territory"],
];

/** The Event Details card, every row editable where it sits. */
export function DetailsEditor({ form, update, openRow, onToggle, onNext, nextLabel, missingFor }: Props & {
  openRow: RegionId | null;
  onToggle: (id: RegionId) => void;
  onNext: (id: RegionId) => void;
  nextLabel: (id: RegionId) => string | null;
  missingFor: (id: RegionId) => string | undefined;
}) {
  const row = (id: RegionId) => ({
    id, open: openRow === id, onToggle: () => onToggle(id), missing: missingFor(id),
    onNext: () => onNext(id), nextLabel: nextLabel(id),
  });
  const timeInvalid = !!(form.startTime && form.endTime && form.endTime <= form.startTime);
  const disciplineCats = DISCIPLINE_CATS[form.discipline as Discipline];
  const showDivisions = !!disciplineCats || form.categories.length > 0;

  return (
    <div className="space-y-2.5">
      <EditableDetail {...row("date")} label="Date" placeholder="Add the event date"
        value={form.date ? <DetailValue>{dateLabel(form)}</DetailValue> : null}>
        <MiniField label="Event date(s)" hint="Tap start then end for multi-day">
          <DatePicker
            value={form.date} onChange={v => update({ date: v })}
            rangeEnd={form.endDate} onChangeEnd={v => update({ endDate: v })}
            placeholder="Pick start date"
          />
        </MiniField>
        {form.endDate && form.endDate !== form.date && (
          <button type="button" onClick={() => update({ endDate: "" })}
            className="font-headline text-[10px] uppercase tracking-widest text-light hover:text-primary transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Make single-day event
          </button>
        )}
      </EditableDetail>

      <EditableDetail {...row("time")} label="Time" placeholder="Add the start time"
        value={form.startTime ? <DetailValue>{fmt24to12(form.startTime)}{form.endTime && ` — ${fmt24to12(form.endTime)}`}</DetailValue> : null}>
        <MiniField label="Start time">
          <TimePicker value={form.startTime} onChange={v => update({ startTime: v })} ariaLabel="Start time" />
        </MiniField>
        <MiniField label="Cut-off time" hint="If required">
          <TimePicker value={form.endTime} onChange={v => update({ endTime: v })} placeholder="Select end time" ariaLabel="Cut-off time" />
          {timeInvalid && (
            <p className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1.5">End time must be after start time.</p>
          )}
        </MiniField>
        <p className="font-headline text-[10px] uppercase tracking-widest text-muted">Per-wave start times are set on each ticket under Pricing.</p>
      </EditableDetail>

      <EditableDetail {...row("location")} label="Location" placeholder="Add the venue"
        value={form.address || form.venue || form.city ? (
          <>
            <DetailValue>{form.venue || form.city || "Venue"}</DetailValue>
            {form.address && <DetailSub>{form.address}</DetailSub>}
            {(form.city || form.state) && <DetailSub>{[form.city, form.state ? STATE_LABELS[form.state] : ""].filter(Boolean).join(", ")}</DetailSub>}
          </>
        ) : null}>
        <MiniField label="Street address">
          <AddressAutocomplete
            value={form.address} onChange={raw => update({ address: raw })}
            onSelect={({ address, city, state, venue, latitude, longitude }) => {
              update({
                ...(address && { address }),
                ...(city    && { city }),
                ...(state   && { state: state as AusState }),
                ...(venue   && { venue }),
                ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
              });
            }}
            placeholder="Start typing an address…"
            className={inputCls}
          />
        </MiniField>
        <LocationPreviewMap
          latitude={form.latitude}
          longitude={form.longitude}
          label={[form.venue, form.city, form.state?.toUpperCase()].filter(Boolean).join(", ") || undefined}
        />
        <MiniField label="Venue name" hint="Optional">
          <input value={form.venue} onChange={e => update({ venue: e.target.value })}
            placeholder="Sydney Olympic Park" className={inputCls} />
        </MiniField>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
          <MiniField label="City">
            <SuburbAutocomplete
              value={form.city}
              onChange={city => update({ city })}
              onStateChange={state => { if (!form.state) update({ state: state as AusState }); }}
              placeholder="e.g. Melbourne"
              className={inputCls}
            />
          </MiniField>
          <MiniField label="State">
            <SelectMenu
              value={form.state}
              onChange={v => update({ state: v as AusState })}
              placeholder="Select state…"
              ariaLabel="State"
              options={AUS_STATES.map(([v, abbr, full]) => ({ value: v, label: abbr, hint: full }))}
            />
          </MiniField>
        </div>
      </EditableDetail>

      <EditableDetail {...row("format")} label="Format" placeholder="Choose a format"
        value={form.format ? <DetailValue>{formatCompetitionFormat(form.format)}</DetailValue> : null}>
        <div className="grid grid-cols-1 gap-2">
          {FORMATS.map(f => {
            const on = form.format === f.v;
            return (
              <button key={f.v} type="button" aria-pressed={on} onClick={() => update({ format: f.v })} className={optionCard(on)}>
                <span className={`font-headline text-[14px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{f.l}</span>
                <span className="font-headline text-[10px] uppercase tracking-widest text-muted">{f.d}</span>
              </button>
            );
          })}
        </div>
      </EditableDetail>

      {showDivisions && (
        <EditableDetail {...row("divisions")} label="Divisions" placeholder="Choose the divisions" required={!!disciplineCats}
          value={form.categories.length ? (
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {form.categories.map(c => (
                <span key={c} className="font-headline text-[11px] font-bold uppercase tracking-widest text-light border border-dark-lighter px-2.5 py-1 rounded-full">{c}</span>
              ))}
            </div>
          ) : null}>
          <DivisionsPicker form={form} update={update} />
        </EditableDetail>
      )}

      <EditableDetail {...row("intensity")} label="Intensity" placeholder="Choose an intensity"
        value={form.level ? <DetailValue>{formatLevel(form.level)}</DetailValue> : null}>
        <div className="grid grid-cols-2 gap-2">
          {INTENSITY_LEVELS.map(l => {
            const on = form.level === l.v;
            return (
              <button key={l.v} type="button" aria-pressed={on} onClick={() => update({ level: l.v })} className={optionCard(on)}>
                <span className={`font-headline text-[14px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{l.l}</span>
                <span className="font-headline text-[10px] uppercase tracking-widest text-muted">{l.d}</span>
              </button>
            );
          })}
        </div>
      </EditableDetail>

    </div>
  );
}

function DivisionsPicker({ form, update }: Props) {
  const [custom, setCustom] = useState<string | null>(null);
  const presets = DISCIPLINE_CATS[form.discipline as Discipline] ?? [];
  const toggle = (c: string) => {
    const s = new Set(form.categories); if (s.has(c)) s.delete(c); else s.add(c);
    update({ categories: [...s] });
  };
  const commit = () => {
    const val = (custom ?? "").trim();
    if (val && !form.categories.includes(val)) update({ categories: [...form.categories, val] });
    setCustom(null);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map(c => (
        <button key={c} type="button" aria-pressed={form.categories.includes(c)} onClick={() => toggle(c)} className={chip(form.categories.includes(c))}>
          {form.categories.includes(c) && <Check className="w-3 h-3 inline mr-1" />}{formatDivisionLabel(c)}
        </button>
      ))}
      {form.categories.filter(c => !presets.includes(c)).map(c => (
        <button key={c} type="button" aria-pressed onClick={() => toggle(c)} className={chip(true)}>
          <Check className="w-3 h-3 inline mr-1" />{formatDivisionLabel(c)}
        </button>
      ))}
      {custom !== null ? (
        <div className="flex items-center gap-2">
          <input autoFocus type="text" value={custom} onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") setCustom(null); }}
            placeholder="e.g. Masters 45+" aria-label="Custom division" className={`${inputCls} !py-2 w-36 text-[12px]`} />
          <button type="button" onClick={commit} className={chip(true)}>Add</button>
        </div>
      ) : (
        <button type="button" onClick={() => setCustom("")} className={chip(false)}>
          <Plus className="w-3 h-3 inline mr-1" /> Custom…
        </button>
      )}
    </div>
  );
}

/** Event information PDFs, as the downloads card athletes see. */
export function InformationEditor({ form, update }: Props) {
  const [error, setError] = useState("");
  const pdfs = form.informationPdfs;
  const add = (list: FileList | null) => {
    const picked = Array.from(list ?? []).filter(f => f.type === "application/pdf");
    const files = picked.filter(f => f.size <= MAX_PDF_BYTES);
    const rejected = picked.filter(f => f.size > MAX_PDF_BYTES);
    setError(rejected.length ? oversizedMessage(rejected, MAX_PDF_BYTES, "PDFs") : "");
    const remaining = MAX_INFO_PDFS - pdfs.length;
    if (files.length && remaining > 0) {
      update({ informationPdfs: [...pdfs, ...files.slice(0, remaining).map(f => ({ file: f, url: "", label: "", name: f.name }))] });
    }
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pdfs.length) return;
    const next = [...pdfs]; [next[i], next[j]] = [next[j], next[i]];
    update({ informationPdfs: next });
  };
  const picker = (label: string) => (
    <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-dark-lighter hover:border-primary/40 px-4 py-3 cursor-pointer transition-colors">
      <Plus className="w-4 h-4 text-primary" />
      <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-light">{label}</span>
      <input type="file" accept="application/pdf" multiple className="sr-only" aria-label="Event information PDFs"
        onChange={e => { add(e.target.files); e.target.value = ""; }} />
    </label>
  );

  return (
    <SidebarCard title="Event information">
      {pdfs.length === 0 && (
        <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">Optional. Course maps, info packs, athlete guides, up to 15 MB each</p>
      )}
      <ul className="space-y-2.5">
        {pdfs.map((pdf, i) => (
          <li key={pdf.file ? `${pdf.file.name}-${pdf.file.lastModified}-${i}` : `${pdf.url}-${i}`} className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-primary shrink-0 mt-1.5" />
            <div className="min-w-0 flex-1">
              <input type="text" value={pdf.label} placeholder="Label (e.g. Course Map)" aria-label={`Label for ${pdf.file?.name ?? pdf.name ?? "PDF"}`}
                onChange={e => update({ informationPdfs: pdfs.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)) })}
                className={`${ghostInput} w-full py-1 font-headline text-[12px] font-bold uppercase tracking-widest text-primary`} />
              <p className="font-headline text-[10px] uppercase tracking-widest text-muted truncate mt-0.5">{pdf.file?.name ?? pdf.name ?? "Event information PDF"}</p>
            </div>
            <div className="flex items-center shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                className="w-7 h-7 rounded text-muted hover:text-primary disabled:opacity-30 flex items-center justify-center"><ChevronUp className="w-4 h-4" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === pdfs.length - 1} aria-label="Move down"
                className="w-7 h-7 rounded text-muted hover:text-primary disabled:opacity-30 flex items-center justify-center"><ChevronDown className="w-4 h-4" /></button>
              <button type="button" onClick={() => update({ informationPdfs: pdfs.filter((_, j) => j !== i) })} aria-label="Remove PDF"
                className="w-7 h-7 rounded text-muted hover:text-primary flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
          </li>
        ))}
      </ul>
      {pdfs.length < MAX_INFO_PDFS && <div className={pdfs.length ? "mt-3" : ""}>{picker(pdfs.length ? "Add another PDF" : "Add PDFs")}</div>}
      {error && <p className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1.5">{error}</p>}
    </SidebarCard>
  );
}

/** The refund card. The policy belongs to the organisation, so it only shows here. */
export function RefundCard({ form, missing }: { form: FormState; missing?: string }) {
  return (
    <Region id="refund" missing={missing}>
      <SidebarCard title="Refund & Transfer Policy">
        {isFreeEvent(form.waves) ? (
          <p className="text-sm font-medium text-muted leading-relaxed">
            Not shown: every ticket is free, so there is nothing to refund.
          </p>
        ) : (
          <>
            <ul className="space-y-1">
              {describeTiers(form.refundTiers).map((line, i) => (
                <li key={i} className="text-sm font-medium text-muted leading-relaxed">{line}</li>
              ))}
            </ul>
            {form.refundPolicy.trim() && <p className="text-sm font-medium text-muted leading-relaxed mt-2">{form.refundPolicy}</p>}
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark leading-relaxed mt-3">
              Set once for your organisation in Settings → Refunds.
            </p>
          </>
        )}
        {missing && <MissingHint message={missing} />}
      </SidebarCard>
    </Region>
  );
}

/** Object URLs for picked files, revoked when the files change. */
export function useObjectUrls(cover: File | null, coverUrl: string, photos: File[]) {
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  useEffect(() => {
    // Keyed on the file, not minted during render: a fresh URL per keystroke
    // used to revoke the one the committed <img> was still loading.
    const url = cover ? URL.createObjectURL(cover) : coverUrl || null;
    startTransition(() => setCoverSrc(url));
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [cover, coverUrl]);

  const [photoSrcs, setPhotoSrcs] = useState<string[]>([]);
  useEffect(() => {
    const urls = photos.map(f => URL.createObjectURL(f));
    startTransition(() => setPhotoSrcs(urls));
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [photos]);

  return { coverSrc, photoSrcs };
}
