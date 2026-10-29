"use client";

import { useState, useRef, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2,
  Upload, X, MapPin, Calendar, Users,
  ChevronDown, ChevronUp, Clock, Eye,
  Ticket, ExternalLink, DollarSign, Bold, Italic, Underline,
  AlignLeft, Trophy, FileText, AlertTriangle,
} from "lucide-react";
import { encodePrizePool, parsePrizePool, normalisePrizeAmount } from "@/lib/prize-pool";
import { UPLOAD_LIMITS, TYPE_MIMES } from "@/lib/upload-limits";
import { uploadFile, UploadError } from "@/lib/upload-client";
import { formatDivisionLabel } from "@/lib/divisions";
import { DEFAULT_REFUND_TIERS, REFUND_PRESETS, describeTiers, matchRefundPreset, parseTiers, tiersAreValid, type RefundTier } from "@/lib/refund-policy";
import { isFreeEvent } from "@/lib/event-types";
import { takesPayments } from "@/lib/event-approval";
import { customerHref } from "@/lib/portal-domains";
import { usePortalHost } from "@/lib/use-portal-host";
import AddressAutocomplete  from "@/components/ui/AddressAutocomplete";
import SuburbAutocomplete   from "@/components/ui/SuburbAutocomplete";
import LocationPreviewMap   from "@/components/organiser/LocationPreviewMap";
import DatePicker           from "@/components/ui/DatePicker";
import SelectMenu           from "@/components/ui/SelectMenu";
import TimePicker           from "@/components/ui/TimePicker";

/* ── Step definitions ───────────────────────────────────────── */

import {
  Field, RichTextEditor, fmt24to12, inputCls, textareaCls, stripHtml, waveIsComplete,
  DISCIPLINES, DISCIPLINE_CATS, FORMATS, INTENSITY_LEVELS,
  type FormState, type Wave, type InfoPdf, type Discipline, type Format,
  type Intensity, type AusState, type Requirement,
} from "./shared";

export const AGE_PRESETS = ["18"];
export const CAP_PRESETS = ["250", "500", "1000", "5000"];

export function BasicsStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const [ageMode, setAgeMode] = useState<"open" | "preset" | "custom" | "none">(
    form.minAge === "" ? "none" : form.minAge === "0" ? "open" : AGE_PRESETS.includes(form.minAge) ? "preset" : "custom"
  );
  // "0" is the open cap — no limit — and mirrors how minAge stores "open to all".
  // It is saved as a null cap, which is what the rest of the app already reads as
  // unlimited (capacity checks, the capacity bar, the organiser dashboard).
  const [capMode, setCapMode] = useState<"open" | "preset" | "custom" | "none">(
    form.cap === "" ? "none" : form.cap === "0" ? "open" : CAP_PRESETS.includes(form.cap) ? "preset" : "custom"
  );
  const [showCustomCat,  setShowCustomCat]  = useState(false);
  const [customCatInput, setCustomCatInput] = useState("");

  const toggle = (c: string) => {
    const s = new Set(form.categories); s.has(c) ? s.delete(c) : s.add(c);
    update({ categories: [...s] });
  };
  const commitCustomCat = () => {
    const val = customCatInput.trim();
    if (val && !form.categories.includes(val)) update({ categories: [...form.categories, val] });
    setCustomCatInput(""); setShowCustomCat(false);
  };

  const hasDisciplineCats = !!DISCIPLINE_CATS[form.discipline as Discipline];

  return (
    <div>
      <Field label="Event title" required hint={`${form.title.length}/80`}>
        <input maxLength={80} value={form.title} onChange={e => update({ title: e.target.value })}
          placeholder="e.g. Apex Throwdown Sydney 2026" className={inputCls} />
      </Field>

      <Field label="Competition format" required>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {FORMATS.map(f => {
            const on = form.format === f.v;
            return (
              <button key={f.v} type="button" onClick={() => update({ format: f.v })}
                className={`flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1 text-left p-3 sm:p-4 rounded-md border transition-all
                  ${on ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"}`}>
                <div className={`font-headline text-[14px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{f.l}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-light">{f.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Discipline" required>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DISCIPLINES.map(d => {
            const on = form.discipline === d.v;
            return (
              <button key={d.v} type="button" onClick={() => update({ discipline: d.v, categories: [] })}
                className={`text-left p-4 rounded-md border transition-all ${on ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"}`}>
                <div className={`font-headline text-[15px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{d.l}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-light mt-1">{d.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      {hasDisciplineCats && (
        <Field label="Divisions & categories" required hint={`${form.categories.length} selected`}>
          <div className="flex flex-wrap gap-2">
            {(DISCIPLINE_CATS[form.discipline as Discipline] ?? []).map(c => (
              <button key={c} type="button" onClick={() => toggle(c)}
                className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border transition-colors
                  ${form.categories.includes(c) ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-light hover:border-primary/40 hover:text-light"}`}>
                {form.categories.includes(c) && <Check className="w-3 h-3 inline mr-1" />}{formatDivisionLabel(c)}
              </button>
            ))}
            {form.categories.filter(c => !(DISCIPLINE_CATS[form.discipline as Discipline] ?? []).includes(c)).map(c => (
              <button key={c} type="button" onClick={() => toggle(c)}
                className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border border-primary bg-primary/10 text-primary">
                <Check className="w-3 h-3 inline mr-1" />{formatDivisionLabel(c)}
              </button>
            ))}
            {showCustomCat ? (
              <div className="flex items-center gap-2">
                <input autoFocus type="text" value={customCatInput}
                  onChange={e => setCustomCatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitCustomCat(); } if (e.key === "Escape") { setShowCustomCat(false); setCustomCatInput(""); } }}
                  placeholder="e.g. Masters 45+" className={`${inputCls} !py-2 w-36 text-[12px]`} />
                <button type="button" onClick={commitCustomCat}
                  className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors">Add</button>
                <button type="button" onClick={() => { setShowCustomCat(false); setCustomCatInput(""); }} className="text-light hover:text-light transition-colors"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowCustomCat(true)}
                className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md border border-dark-lighter text-light hover:border-primary hover:bg-primary/10 hover:text-primary transition-colors">
                <Plus className="w-3 h-3 inline mr-1" /> Custom…
              </button>
            )}
          </div>
        </Field>
      )}

      <Field label="Intensity level" required>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {INTENSITY_LEVELS.map(l => {
            const on = form.level === l.v;
            return (
              <button key={l.v} type="button" onClick={() => update({ level: l.v })}
                className={`flex flex-col items-start text-left p-3 sm:p-4 rounded-md border transition-all
                  ${on ? "border-primary bg-primary/10" : "border-dark-lighter hover:border-primary/40"}`}>
                <div className={`font-headline text-[14px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{l.l}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-light mt-0.5">{l.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Participant cap" required hint="Max registrations">
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => { update({ cap: "0" }); setCapMode("open"); }}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors
              ${capMode === "open" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-light hover:border-primary/40 hover:text-light"}`}>
            Open
          </button>
          {CAP_PRESETS.map(c => {
            const active = capMode === "preset" && form.cap === c;
            return (
              <button key={c} type="button" onClick={() => { update({ cap: c }); setCapMode("preset"); }}
                className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors
                  ${active ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-light hover:border-primary/40 hover:text-light"}`}>
                {parseInt(c).toLocaleString()}
              </button>
            );
          })}
          <button type="button" onClick={() => { if (form.cap === "0") update({ cap: "" }); setCapMode("custom"); }}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors
              ${capMode === "custom" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-light hover:border-primary/40 hover:text-light"}`}>
            Custom
          </button>
        </div>
        {capMode === "custom" && (
          <input type="number" value={form.cap} onChange={e => update({ cap: e.target.value })}
            placeholder="e.g. 4200" className={`${inputCls} w-40`} />
        )}
        {capMode === "open" && (
          <p className="font-headline text-[11px] uppercase tracking-widest text-muted">No limit on registrations</p>
        )}
      </Field>

      <Field label="Minimum age" required>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => { update({ minAge: "0" }); setAgeMode("open"); }}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors
              ${ageMode === "open" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-light hover:border-primary/40 hover:text-light"}`}>
            Open to all
          </button>
          {AGE_PRESETS.map(a => (
            <button key={a} type="button" onClick={() => { update({ minAge: a }); setAgeMode("preset"); }}
              className={`font-headline text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md border transition-colors
                ${ageMode === "preset" && form.minAge === a ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-light hover:border-primary/40 hover:text-light"}`}>
              {a}+
            </button>
          ))}
          <button type="button" onClick={() => { update({ minAge: "" }); setAgeMode("custom"); }}
            className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md border transition-colors
              ${ageMode === "custom" ? "border-primary bg-primary/10 text-primary" : "border-dark-lighter text-light hover:border-primary/40 hover:text-light"}`}>
            Custom
          </button>
        </div>
        {ageMode === "custom" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-dark-lighter rounded-md overflow-hidden">
              <button type="button" onClick={() => update({ minAge: String(Math.max(0, (parseInt(form.minAge) || 0) - 1)) })}
                className="w-9 h-11 flex items-center justify-center text-light hover:text-light hover:bg-white/5 transition-colors font-headline text-lg select-none">−</button>
              <input type="number" value={form.minAge} onChange={e => update({ minAge: e.target.value })} placeholder="0"
                className="w-16 bg-dark-light px-2 py-3 font-headline text-[15px] text-light text-center placeholder:text-placeholder focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" onClick={() => update({ minAge: String((parseInt(form.minAge) || 0) + 1) })}
                className="w-9 h-11 flex items-center justify-center text-light hover:text-light hover:bg-white/5 transition-colors font-headline text-lg select-none">+</button>
            </div>
            <span className="font-headline text-[13px] text-light">years old minimum</span>
          </div>
        )}
        {ageMode === "open" && (
          <p className="font-headline text-[11px] uppercase tracking-widest text-light">No age restriction. Open to all ages.</p>
        )}
      </Field>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 2 — DATE & LOCATION
   ══════════════════════════════════════════════════════════════ */
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

export function StateSelect({ value, onChange }: { value: AusState; onChange: (v: AusState) => void }) {
  return (
    <SelectMenu
      value={value}
      onChange={v => onChange(v as AusState)}
      placeholder="Select state…"
      ariaLabel="State"
      options={AUS_STATES.map(([v, abbr, full]) => ({ value: v, label: abbr, hint: full }))}
    />
  );
}

export function WhenStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const timeInvalid = !!(form.startTime && form.endTime && form.endTime <= form.startTime);

  return (
    <div>
      <Field label="Event date(s)" required hint="Tap start then end for multi-day">
        <DatePicker
          value={form.date} onChange={v => update({ date: v })}
          rangeEnd={form.endDate} onChangeEnd={v => update({ endDate: v })}
          placeholder="Pick start date"
        />
        {form.endDate && form.endDate !== form.date && (
          <button type="button" onClick={() => update({ endDate: "" })}
            className="mt-1.5 font-headline text-[10px] uppercase tracking-widest text-light hover:text-primary transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Make single-day event
          </button>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <Field label="Start time" required>
          <TimePicker value={form.startTime} onChange={v => update({ startTime: v })} ariaLabel="Start time" />
          <p className="font-headline text-[10px] uppercase tracking-widest text-light mt-1.5">
            Overall start. Per-wave start times can be set in Tickets & Pricing.
          </p>
        </Field>
        <Field label="Cut-off time (if required)">
          <TimePicker value={form.endTime} onChange={v => update({ endTime: v })} placeholder="Select end time" ariaLabel="Cut-off time" />
          {timeInvalid && (
            <p className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1.5">
              End time must be after start time.
            </p>
          )}
        </Field>
      </div>

      <div className="my-6 border-t border-dark-lighter" />

      <Field label="Street address" required>
        <AddressAutocomplete
          value={form.address} onChange={raw => update({ address: raw })}
          onSelect={({ address, city, state, venue, latitude, longitude }) => {
            update({
              ...(address && { address }),
              ...(city    && { city }),
              ...(state   && { state: state as typeof form.state }),
              ...(venue   && { venue }),
              ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
            });
          }}
          placeholder="Start typing an address…"
          className={inputCls}
        />
      </Field>

      <Field label="Location preview" hint="Updates when you select an address">
        <LocationPreviewMap
          latitude={form.latitude}
          longitude={form.longitude}
          label={[form.venue, form.city, form.state?.toUpperCase()].filter(Boolean).join(", ") || undefined}
        />
      </Field>

      <Field label="Venue name" hint="Optional">
        <input value={form.venue} onChange={e => update({ venue: e.target.value })}
          placeholder="Sydney Olympic Park" className={inputCls} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <Field label="City" required>
          <SuburbAutocomplete
            value={form.city}
            onChange={city  => update({ city })}
            onStateChange={state => { if (!form.state) update({ state: state as AusState }); }}
            placeholder="e.g. Melbourne"
            className={inputCls}
          />
        </Field>
        <Field label="State" required>
          <StateSelect value={form.state} onChange={v => update({ state: v })} />
        </Field>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 3 — TICKETS & PRICING
   ══════════════════════════════════════════════════════════════ */
/**
 * A ticket category needs a name and a price before the event can be published.
 * The free toggle writes "0", and a hand-typed "0.00" means the same thing, so
 * anything that parses to a number at or above zero counts as priced. A bare "."
 * or an empty box does not.
 */


export const STARTLINE_PCT  = 0.0395;
export const STARTLINE_FLAT = 1.45;
export const STRIPE_PCT     = 0.0175;
export const STRIPE_FLAT    = 0.30;

export function TicketsStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const updateWave = (i: number, patch: Partial<Wave>) => {
    const waves = [...form.waves]; waves[i] = { ...waves[i], ...patch }; update({ waves });
  };
  const removeWave = (i: number) => update({ waves: form.waves.filter((_, j) => j !== i) });
  const addWave    = () => update({ waves: [...form.waves, { label: "", price: "", closes: "", startTime: "" }] });

  // One policy, picked from a list. An event saved before the presets existed can
  // carry bespoke tiers, so it keeps a "Custom" card of its own rather than being
  // snapped onto whichever preset happens to be closest.
  const activePreset = matchRefundPreset(form.refundTiers);
  const isCustom     = activePreset === null;

  // Nothing is paid for a free event, so there is nothing to refund. The policy
  // picker is replaced with a note rather than making the organiser answer a
  // question that cannot apply to their event (issue #304).
  const allTicketsFree = isFreeEvent(form.waves);

  return (
    <div>
      {/* Registration platform */}
      <Field label="Registration platform" required>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { value: "startline", title: "Startline",        sub: "Managed on this platform"      },
            { value: "external",  title: "External website", sub: "Link to your own registration" },
          ] as const).map(({ value, title, sub }) => {
            const active = form.registrationType === value;
            return (
              <button key={value} type="button" onClick={() => update({ registrationType: value })}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 px-5 py-4 text-left transition-colors
                  ${active ? "border-primary bg-primary/10" : "border-dark-lighter bg-dark-light hover:border-primary/40"}`}
              >
                <div className={`font-headline text-[13px] font-bold uppercase tracking-widest ${active ? "text-primary" : "text-light"}`}>{title}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-light">{sub}</div>
              </button>
            );
          })}
        </div>

        {form.registrationType === "startline" && (
          <div className="mt-3 flex items-center justify-between">
            <div className="font-headline text-[10px] uppercase tracking-widest text-light">Athlete pays the fee at checkout</div>
            <div className="font-headline text-[10px] uppercase tracking-widest text-light">Startline fee: 3.95% + A$1.45 per ticket</div>
          </div>
        )}

        {form.registrationType === "external" && (
          <div className="mt-5">
            <Field label="Registration URL" required>
              <input value={form.registrationUrl} onChange={e => update({ registrationUrl: e.target.value })}
                placeholder="https://yourorg.com/events/sydney-2026" className={inputCls} />
            </Field>
          </div>
        )}
      </Field>

      {/* Ticket categories */}
      <Field label="Ticket categories" required>
        <div className="space-y-3">
          {form.waves.map((w, i) => (
            <div key={i} className="bg-dark-light border border-dark-lighter rounded-lg p-4 space-y-3">
              <div className="flex items-end gap-3">
                <div className="w-7 h-7 mb-[10px] rounded-md bg-dark-lighter flex items-center justify-center font-headline font-black italic text-primary text-[13px] shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-headline text-[10px] uppercase tracking-widest text-light mb-1.5">Category name<span className="text-primary font-black text-[15px] leading-none ml-1">*</span></div>
                  <input value={w.label} onChange={e => updateWave(i, { label: e.target.value })}
                    placeholder="General admission" className={inputCls} aria-label="Ticket category name" />
                </div>
                <button onClick={() => removeWave(i)} aria-label="Remove this ticket category"
                  className="w-9 h-9 mb-1.5 rounded text-light hover:text-primary hover:bg-white/5 flex items-center justify-center transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Price + close date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-headline text-[10px] uppercase tracking-widest text-light">Price (A$)<span className="text-primary font-black text-[15px] leading-none ml-1">*</span></div>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <span className="font-headline text-[10px] uppercase tracking-widest text-light">Free</span>
                      <div onClick={() => updateWave(i, { price: w.price === "0" ? "" : "0" })}
                        className={`relative w-8 h-4 rounded-full transition-colors duration-200 cursor-pointer ${w.price === "0" ? "bg-primary/100" : "bg-dark-lighter"}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${w.price === "0" ? "translate-x-4" : "translate-x-0.5"}`} />
                      </div>
                    </label>
                  </div>
                  {w.price === "0" ? (
                    <div className="w-full bg-primary/10 border border-primary/30 rounded-md px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-primary">Free</div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-headline text-[13px] text-light">A$</span>
                      <input value={w.price} inputMode="decimal"
                        onChange={e => updateWave(i, { price: e.target.value.replace(/[^\d.]/g, "") })}
                        placeholder="129" className={`${inputCls} pl-9`} />
                    </div>
                  )}
                  {form.registrationType === "startline" && (() => {
                    const p = parseFloat(w.price);
                    if (!w.price || w.price === "0" || isNaN(p) || p <= 0) return null;
                    const startlineFee = p * STARTLINE_PCT + STARTLINE_FLAT;
                    const stripeFee    = p * STRIPE_PCT + STRIPE_FLAT;
                    const athletePays  = form.feeStructure === "athlete" ? p + startlineFee : p;
                    const youReceive   = form.feeStructure === "athlete" ? p - stripeFee : p - startlineFee - stripeFee;
                    const fmt = (n: number) => `A$${n.toFixed(2)}`;
                    return (
                      <div className="mt-2 rounded-md bg-dark px-3 py-2.5 space-y-1">
                        {([
                          { label: "Athlete pays",  value: fmt(athletePays),  muted: false, sub: null              },
                          { label: "You receive",   value: fmt(youReceive),   muted: false, sub: "after Stripe fee" },
                          { label: "Startline fee", value: fmt(startlineFee), muted: true,  sub: null              },
                        ] as const).map(r => (
                          <div key={r.label} className="flex items-baseline justify-between">
                            <span className="font-headline text-[13px] uppercase tracking-widest text-light">
                              {r.label}{r.sub && <span className="ml-1.5 normal-case text-[11px] text-light">({r.sub})</span>}
                            </span>
                            <span className={`font-headline text-[14px] font-bold ${r.muted ? "text-light" : "text-light"}`}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <div className="font-headline text-[10px] uppercase tracking-widest text-light mb-1.5">Category closes <span className="text-light">(optional)</span></div>
                  <DatePicker value={w.closes} onChange={v => updateWave(i, { closes: v })} placeholder="Optional close date" disablePast={false} maxDate={form.endDate || form.date} />
                </div>
              </div>

              {/* Per-wave start time */}
              <div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-light mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Wave start time <span className="text-light">(optional)</span>
                </div>
                <TimePicker value={w.startTime} onChange={v => updateWave(i, { startTime: v })} placeholder="Same as event start" ariaLabel="Wave start time" />
              </div>
            </div>
          ))}
          <button onClick={addWave}
            className="w-full border border-dashed border-dark-lighter rounded-md py-3 font-headline text-[12px] uppercase tracking-widest text-light hover:text-primary hover:border-primary/40 flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add ticket category
          </button>
        </div>
      </Field>

      {/* Prize money toggle */}
      <div className="border border-dark-lighter rounded-xl overflow-hidden mb-6">
        <button type="button" onClick={() => update({ prizeMoney: !form.prizeMoney })}
          className="w-full flex items-center justify-between px-5 py-4 bg-dark-light hover:bg-dark-light/80 transition-colors">
          <div>
            <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-light text-left flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> Prize money
            </div>
            <div className="font-headline text-[10px] uppercase tracking-widest text-light mt-0.5 text-left">This event offers a cash prize pool</div>
          </div>
          <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${form.prizeMoney ? "bg-primary/100" : "bg-dark-lighter"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.prizeMoney ? "translate-x-5" : "translate-x-0"}`} />
          </div>
        </button>
        {form.prizeMoney && (
          <div className="px-5 pb-5 pt-3 bg-white/[0.02] border-t border-dark-lighter space-y-3">
            <div>
              <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-light mb-1.5">Total prize pool</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-headline text-[13px] text-light">A$</span>
                <input value={form.prizeMoneyAmount} onChange={e => update({ prizeMoneyAmount: e.target.value })}
                  placeholder="e.g. 2,000"
                  className={`${inputCls} pl-9`} />
              </div>
            </div>
            <div>
              <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-light mb-1.5">How it&apos;s awarded</div>
              <input value={form.prizeMoneyDetails} onChange={e => update({ prizeMoneyDetails: e.target.value })}
                placeholder="e.g. Awarded to podium finishers per division"
                className={inputCls} />
            </div>
            {normalisePrizeAmount(form.prizeMoneyAmount) && (
              <div className="bg-dark border border-dark-lighter rounded-xl px-5 py-4 flex items-center gap-4">
                <Trophy className="w-6 h-6 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-headline text-[17px] font-bold text-primary leading-tight">
                    ${normalisePrizeAmount(form.prizeMoneyAmount)} prize pool
                  </p>
                  <p className="font-headline text-[11px] font-medium uppercase tracking-widest text-light mt-0.5 truncate">
                    {form.prizeMoneyDetails.trim() || "Cash prizes up for grabs"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Refund policy — priced events only */}
      {allTicketsFree ? (
        <Field label="Refund & transfer policy">
          <div className="rounded-xl border border-dark-lighter bg-dark-light px-5 py-4">
            <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Not needed</div>
            <p className="text-[11.5px] text-muted leading-relaxed mt-1">
              Every ticket category on this event is free, so there is nothing to refund. Add a price to a
              category if you need a refund policy.
            </p>
          </div>
        </Field>
      ) : (
      <Field label="Refund & transfer policy" required>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REFUND_PRESETS.map(preset => {
            const active = activePreset?.id === preset.id;
            return (
              <button key={preset.id} type="button" onClick={() => update({ refundTiers: preset.tiers })}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 px-5 py-4 text-left transition-colors
                  ${active ? "border-primary bg-primary/10" : "border-dark-lighter bg-dark-light hover:border-primary/40"}`}
              >
                <div className={`font-headline text-[13px] font-bold uppercase tracking-widest ${active ? "text-primary" : "text-light"}`}>{preset.label}</div>
                {/* The athlete-facing wording, so what you pick is what they read. */}
                <div className="text-[11.5px] text-light leading-relaxed">{describeTiers(preset.tiers).join(" ")}</div>
              </button>
            );
          })}
          {isCustom && (
            <div className="flex flex-col items-start gap-1 rounded-xl border-2 border-primary bg-primary/10 px-5 py-4 sm:col-span-2">
              <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-primary">Custom policy</div>
              <div className="text-[11.5px] text-light leading-relaxed">{describeTiers(form.refundTiers).join(" ")}</div>
              <button type="button" onClick={() => update({ refundTiers: DEFAULT_REFUND_TIERS })}
                className="font-headline text-[10px] font-bold uppercase tracking-widest text-light hover:text-primary transition-colors mt-1">
                Replace with a standard policy
              </button>
            </div>
          )}
        </div>

        <textarea rows={2} value={form.refundPolicy} onChange={e => update({ refundPolicy: e.target.value })}
          placeholder="Exceptions or extra notes, e.g. transfers to another athlete…" className={`${textareaCls} mt-4`} />
      </Field>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 4 — MEDIA & DESCRIPTION
   ══════════════════════════════════════════════════════════════ */
export const MAX_GALLERY_PHOTOS = 8;
export const MAX_INFO_PDFS = 10;
// Same caps the /api/upload route enforces. Checking at pick time matters
// because uploads are deferred to submit: without this, an oversized file is
// accepted silently and only fails five steps later (issue #300).
export const MAX_PDF_BYTES   = UPLOAD_LIMITS.document.bytes;
export const MAX_IMAGE_BYTES = UPLOAD_LIMITS.cover.bytes;
export const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// Shown when an upload or the event save comes back 401. submitToApi refreshes
// the token first, so landing here means the refresh token itself is gone.
export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired and nothing was saved. Please sign in again, then retry. Keep this tab open so you don't lose your event details.";

export function GalleryThumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative aspect-square rounded-md overflow-hidden border border-dark-lighter">
      <Image src={src} alt="" fill unoptimized className="object-cover" />
      <button type="button" onClick={onRemove}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-dark/70 text-light hover:text-white flex items-center justify-center transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function GalleryFileThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    startTransition(() => setSrc(url));
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return src ? <GalleryThumb src={src} onRemove={onRemove} /> : null;
}

export function MediaStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  // Keyed on the file rather than on the URL, matching the preview panels below.
  // Minting the object URL during render produced a fresh one on every keystroke,
  // so the cleanup kept revoking the URL the committed <img> was still loading and
  // the cover went blank as soon as the step re-rendered.
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = form.coverImage ? URL.createObjectURL(form.coverImage) : form.coverImageUrl || null;
    startTransition(() => setCoverSrc(url));
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [form.coverImage, form.coverImageUrl]);

  const [coverError,   setCoverError]   = useState("");
  const [galleryError, setGalleryError] = useState("");
  const [pdfError,     setPdfError]     = useState("");

  const oversizedMessage = (rejected: File[], maxBytes: number, kind: string) => {
    const first = rejected[0];
    const others = rejected.length > 1 ? ` (and ${rejected.length - 1} more)` : "";
    return `"${first.name}" is ${formatMb(first.size)}${others}. ${kind} must be ${formatMb(maxBytes)} or smaller.`;
  };

  const pickCover = (file: File | null) => {
    if (file && file.size > MAX_IMAGE_BYTES) {
      setCoverError(oversizedMessage([file], MAX_IMAGE_BYTES, "Images"));
      return;
    }
    setCoverError("");
    update({ coverImage: file });
  };

  const galleryCount = form.photoUrls.length + form.photos.length;
  const addGalleryFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []).filter(f => f.type.startsWith("image/"));
    const files = picked.filter(f => f.size <= MAX_IMAGE_BYTES);
    const rejected = picked.filter(f => f.size > MAX_IMAGE_BYTES);
    setGalleryError(rejected.length ? oversizedMessage(rejected, MAX_IMAGE_BYTES, "Images") : "");
    const remaining = MAX_GALLERY_PHOTOS - galleryCount;
    if (files.length && remaining > 0) update({ photos: [...form.photos, ...files.slice(0, remaining)] });
  };

  const addInfoPdfs = (list: FileList | null) => {
    const picked = Array.from(list ?? []).filter(f => f.type === "application/pdf");
    const files = picked.filter(f => f.size <= MAX_PDF_BYTES);
    const rejected = picked.filter(f => f.size > MAX_PDF_BYTES);
    setPdfError(rejected.length ? oversizedMessage(rejected, MAX_PDF_BYTES, "PDFs") : "");
    const remaining = MAX_INFO_PDFS - form.informationPdfs.length;
    if (files.length && remaining > 0) {
      update({
        informationPdfs: [
          ...form.informationPdfs,
          ...files.slice(0, remaining).map(f => ({ file: f, url: "", label: "", name: f.name })),
        ],
      });
    }
  };
  const updateInfoPdfLabel = (i: number, label: string) =>
    update({ informationPdfs: form.informationPdfs.map((p, j) => (j === i ? { ...p, label } : p)) });
  const moveInfoPdf = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.informationPdfs.length) return;
    const next = [...form.informationPdfs];
    [next[i], next[j]] = [next[j], next[i]];
    update({ informationPdfs: next });
  };
  const removeInfoPdf = (i: number) =>
    update({ informationPdfs: form.informationPdfs.filter((_, j) => j !== i) });

  return (
    <div>
      <Field label="Cover image" required>
        <label className="block cursor-pointer">
          {coverSrc ? (
            <div className="relative rounded-md overflow-hidden border border-primary/40 aspect-video">
              <Image src={coverSrc} alt="Cover preview" fill unoptimized className="object-cover" />
              <button type="button" onClick={e => { e.preventDefault(); update({ coverImage: null, coverImageUrl: "" }); }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-dark/70 text-light hover:text-white flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative rounded-md border-2 border-dashed border-dark-lighter hover:border-primary/40 bg-dark-light aspect-video flex flex-col items-center justify-center transition-colors">
              <Upload className="w-6 h-6 text-primary mb-2" />
              <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">Upload cover image</span>
              <span className="font-headline text-[10px] uppercase tracking-widest text-light mt-1">JPG · PNG · WEBP · 1920×1080</span>
            </div>
          )}
          <input type="file" accept={TYPE_MIMES.cover.join(",")} className="sr-only"
            onChange={e => { pickCover(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </label>
        {coverError && (
          <p className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1.5">{coverError}</p>
        )}
      </Field>

      <Field label="Gallery photos" hint={`${galleryCount}/${MAX_GALLERY_PHOTOS} · Optional`}>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {form.photoUrls.map((url, i) => (
            <GalleryThumb key={url} src={url}
              onRemove={() => update({ photoUrls: form.photoUrls.filter((_, j) => j !== i) })} />
          ))}
          {form.photos.map((file, i) => (
            <GalleryFileThumb key={`${file.name}-${file.lastModified}-${i}`} file={file}
              onRemove={() => update({ photos: form.photos.filter((_, j) => j !== i) })} />
          ))}
          {galleryCount < MAX_GALLERY_PHOTOS && (
            <label className="aspect-square rounded-md border-2 border-dashed border-dark-lighter hover:border-primary/40 bg-dark-light flex flex-col items-center justify-center cursor-pointer transition-colors">
              <Plus className="w-5 h-5 text-primary mb-1" />
              <span className="font-headline text-[9px] font-bold uppercase tracking-widest text-light">Add photos</span>
              <input type="file" accept={TYPE_MIMES.photo.join(",")} multiple className="sr-only"
                onChange={e => { addGalleryFiles(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
        {galleryError && (
          <p className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1.5">{galleryError}</p>
        )}
        <p className="font-headline text-[10px] uppercase tracking-widest text-light mt-2">
          Shown as a gallery on your event page: venue, atmosphere, past editions. Up to 10 MB each.
        </p>
      </Field>

      <Field label="Event information PDFs" hint={`${form.informationPdfs.length}/${MAX_INFO_PDFS} · Optional`}>
        {form.informationPdfs.length === 0 ? (
          <label className="block cursor-pointer">
            <div className="rounded-md border-2 border-dashed border-dark-lighter hover:border-primary/40 bg-dark-light px-5 py-8 flex flex-col items-center justify-center transition-colors">
              <Upload className="w-6 h-6 text-primary mb-2" />
              <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">Add PDFs</span>
              <span className="font-headline text-[10px] uppercase tracking-widest text-light mt-1">Course maps, info packs, athlete guides</span>
            </div>
            <input type="file" accept="application/pdf" multiple className="sr-only"
              onChange={e => { addInfoPdfs(e.target.files); e.target.value = ""; }} />
          </label>
        ) : (
          <div className="space-y-3">
            {form.informationPdfs.map((pdf, i) => (
              <div key={pdf.file ? `${pdf.file.name}-${pdf.file.lastModified}-${i}` : `${pdf.url}-${i}`}
                className="rounded-md border border-dark-lighter bg-dark-light px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-light truncate">
                      {pdf.file?.name ?? pdf.name ?? "Event information PDF"}
                    </div>
                    <input
                      type="text"
                      value={pdf.label}
                      placeholder="Label (e.g. Course Map)"
                      onChange={e => updateInfoPdfLabel(i, e.target.value)}
                      className="w-full bg-dark border border-dark-lighter rounded-md px-3 py-2 mt-1.5 font-headline text-[12px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button type="button" onClick={() => moveInfoPdf(i, -1)} disabled={i === 0}
                      className="w-7 h-7 rounded-full bg-dark/70 text-light hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors" aria-label="Move up">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => moveInfoPdf(i, 1)} disabled={i === form.informationPdfs.length - 1}
                      className="w-7 h-7 rounded-full bg-dark/70 text-light hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors" aria-label="Move down">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <button type="button" onClick={() => removeInfoPdf(i)}
                    className="w-8 h-8 rounded-full bg-dark/70 text-light hover:text-white flex items-center justify-center transition-colors shrink-0" aria-label="Remove PDF">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {form.informationPdfs.length < MAX_INFO_PDFS && (
              <label className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-dark-lighter hover:border-primary/40 bg-dark-light px-4 py-3 cursor-pointer transition-colors">
                <Plus className="w-4 h-4 text-primary" />
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-light">Add another PDF</span>
                <input type="file" accept="application/pdf" multiple className="sr-only"
                  onChange={e => { addInfoPdfs(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        )}
        {pdfError && (
          <p className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1.5">{pdfError}</p>
        )}
        <p className="font-headline text-[10px] uppercase tracking-widest text-light mt-2">
          Shown as downloads on your event page, up to 15 MB each
        </p>
      </Field>

      <Field label="Full description" required hint={`${stripHtml(form.description).length} chars`}>
        <RichTextEditor value={form.description} onChange={html => update({ description: html })} />
      </Field>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 5 — REVIEW
   ══════════════════════════════════════════════════════════════ */
export const INTENSITY_LABELS: Record<string, string> = {
  low: "Low", moderate: "Moderate", high: "High", extreme: "Extreme",
};

export function ReviewStep({ form, setStep, confirmed, onConfirm, onLeave, showAbnNotice, missing }: {
  form: FormState; setStep: (n: number) => void; confirmed: boolean; onConfirm: (v: boolean) => void;
  onLeave: (destination: string) => void;
  showAbnNotice: boolean;
  missing: Requirement[];
}) {
  const termsHref = customerHref("/terms#organisers", usePortalHost());
  const hasCategories = !!DISCIPLINE_CATS[form.discipline as Discipline];
  const allRows: { k: string; v: string; step: number }[] = [
    { k: "Title",          v: form.title || "—",                                                                   step: 0 },
    { k: "Discipline",     v: form.discipline ? form.discipline.toUpperCase() : "—",                               step: 0 },
    { k: "Format",         v: form.format || "—",                                                                  step: 0 },
    { k: "Intensity",      v: form.level ? INTENSITY_LABELS[form.level] : "—",                                    step: 0 },
    { k: "Cap / Min age",  v: `${form.cap === "0" ? "Open" : form.cap ? parseInt(form.cap).toLocaleString() : "—"} · ${form.minAge === "0" ? "Open to all" : form.minAge ? `${form.minAge}+` : "—"}`, step: 0 },
    { k: "Categories",     v: form.categories.length ? form.categories.join(", ") : "—",                           step: 0 },
    { k: "Date",           v: form.date
        ? form.endDate && form.endDate !== form.date
          ? `${new Date(form.date + "T00:00:00").toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" })} — ${new Date(form.endDate + "T00:00:00").toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" })}`
          : new Date(form.date + "T00:00:00").toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" })
        : "—",                                                                                                      step: 1 },
    { k: "Start / End",    v: form.startTime ? `${fmt24to12(form.startTime)}${form.endTime ? ` → ${fmt24to12(form.endTime)}` : ""}` : "—", step: 1 },
    { k: "Venue",          v: `${form.venue || "—"}, ${form.city || "—"}, ${form.state ? form.state.toUpperCase() : "—"}`, step: 1 },
    { k: "Tickets",        v: `${form.waves.length} categor${form.waves.length !== 1 ? "ies" : "y"}, from ${form.waves[0]?.price === "0" ? "Free" : form.waves[0]?.price ? `A$${form.waves[0].price}` : "—"}`, step: 2 },
    { k: "Registration",   v: form.registrationType === "startline" ? "Startline" : form.registrationUrl || "—",  step: 2 },
    { k: "Refund policy",  v: isFreeEvent(form.waves) ? "Not needed for a free event" : describeTiers(form.refundTiers).join(" "), step: 2 },
    { k: "Prize money",    v: form.prizeMoney ? (normalisePrizeAmount(form.prizeMoneyAmount) ? `$${normalisePrizeAmount(form.prizeMoneyAmount)} prize pool` : "Yes") : "No", step: 2 },
    { k: "Cover image",    v: form.coverImage || form.coverImageUrl ? "Uploaded" : "No image",                    step: 3 },
    { k: "Info PDFs",      v: (() => { const n = form.informationPdfs.length; return n ? `${n} PDF${n !== 1 ? "s" : ""}` : "None"; })(), step: 3 },
    { k: "Gallery",        v: (() => { const n = form.photoUrls.length + form.photos.length; return n ? `${n} photo${n !== 1 ? "s" : ""}` : "None"; })(), step: 3 },
    { k: "Description",    v: form.description ? `${stripHtml(form.description).slice(0, 60)}…` : "—", step: 3 },
  ];

  const missingByRow = new Map(missing.map((m) => [m.row, m.message]));

  // The table shows what is required by default. A row for something optional,
  // or for a requirement that does not apply to this event, only appears once
  // there is something in it to review. A flagged row always shows.
  const hasContent: Record<string, boolean> = {
    // Saved categories count too: an event from before the picker only offered
    // running/cycling/swimming divisions still has them on the record, and the
    // summary must show what the event will publish.
    "Categories":    hasCategories || form.categories.length > 0,
    "Refund policy": !isFreeEvent(form.waves),
    "Prize money":   form.prizeMoney,
    "Info PDFs":     form.informationPdfs.length > 0,
    "Gallery":       form.photoUrls.length + form.photos.length > 0,
  };
  const rows = allRows.filter((r) => missingByRow.has(r.k) || (hasContent[r.k] ?? true));

  return (
    <div>
      <div className="bg-dark border border-dark-lighter rounded-lg overflow-hidden mb-6">
        {rows.map((r, i) => {
          // A row with something required still missing says so in place of its
          // value, so the table is where the organiser finds out, before they
          // try to publish, rather than a warning that appears afterwards.
          const problem = missingByRow.get(r.k);
          return (
            // On a phone the label sits above its value and the value wraps; from
            // sm up they share a line and a long value truncates. min-w-0 is what
            // lets either happen: without it a long value widened the whole step.
            <div key={r.k} data-missing={problem ? "true" : undefined}
              className={`flex items-start sm:items-center gap-4 px-4 sm:px-5 py-4 ${problem ? "bg-orange-500/[0.07]" : ""} ${i === rows.length - 1 ? "" : "border-b border-white/5"}`}>
              <div className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-4">
                <div className={`font-headline text-[11px] uppercase tracking-widest mb-1 sm:mb-0 sm:w-32 sm:flex-shrink-0 ${problem ? "text-orange-400" : "text-muted-dark sm:text-light"}`}>{r.k}</div>
                {problem ? (
                  <div className="min-w-0 sm:flex-1 flex items-start sm:items-center gap-2 font-headline text-[14px] text-orange-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
                    <span className="break-words">{problem}</span>
                  </div>
                ) : (
                  <div className="min-w-0 sm:flex-1 font-headline text-[14px] text-light break-words sm:truncate">{r.v}</div>
                )}
              </div>
              <button onClick={() => setStep(r.step)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-headline text-[11px] font-bold uppercase tracking-widest transition-colors ${problem
                  ? "border-orange-400/50 bg-orange-400/10 text-orange-300 hover:bg-orange-400/20 hover:border-orange-400"
                  : "border-dark-lighter text-light hover:border-primary/50 hover:text-primary"}`}>
                {problem ? "Fix" : "Edit"} <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {missing.length > 0 ? (
        <div className="bg-orange-500/[0.07] border border-orange-500/30 rounded-md p-5 mb-6">
          <div className="font-headline text-[14px] font-black italic tracking-tighter text-orange-300 mb-1">
            {missing.length === 1 ? "1 required item still needs fixing." : `${missing.length} required items still need fixing.`}
          </div>
          <p className="font-headline text-[13px] text-light leading-relaxed">
            They are highlighted in the table above. Fix each one and you can publish.
          </p>
        </div>
      ) : (
        <div className="bg-primary/5 border border-primary/30 rounded-md p-5 mb-6">
          <div className="font-headline text-[14px] font-black italic tracking-tighter text-light mb-1">Your listing is ready to publish.</div>
          <p className="font-headline text-[13px] text-light leading-relaxed">
            Once published, athletes will be able to find your event in search and carousels.
            You&apos;ll receive a notification each time someone registers.
          </p>
        </div>
      )}

      {/* Deliberately advisory, not a block. Submitting still works; the event
          waits for review instead of going live, and the organiser is told
          again on the confirmation screen once the work is safely saved. */}
      {showAbnNotice && (
        <div data-testid="abn-notice" className="flex items-start gap-3 bg-amber-400/[0.08] border border-amber-400/20 rounded-md p-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="font-headline text-[13px] text-amber-200 leading-relaxed">
            <span className="font-bold">Your organiser profile isn&apos;t finished.</span>{" "}
            You can publish this listing now, but without an ABN it goes to Startline for review
            instead of straight to live. Add yours in{" "}
            <Link href="/organiser/payments" className="underline hover:text-amber-100"
              onClick={(e) => { e.preventDefault(); onLeave("/organiser/payments"); }}>Payments</Link>{" "}
            to publish immediately.
          </div>
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={confirmed} onChange={e => onConfirm(e.target.checked)}
          className="accent-primary w-4 h-4 mt-1 cursor-pointer" />
        <span className="font-headline text-[13px] text-light leading-relaxed">
          I confirm I have the right to run this event, that it has the insurance and permits it
          needs, and that these details are accurate. I agree to the organiser terms in the{" "}
          <a href={termsHref} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>.
        </span>
      </label>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIVE PREVIEW SIDEBAR
   ══════════════════════════════════════════════════════════════ */
