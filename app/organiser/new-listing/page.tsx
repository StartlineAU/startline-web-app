"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2,
  Upload, Info, X, MapPin, Calendar, Users,
} from "lucide-react";
import OrganiserSidebar from "@/components/organiser/Sidebar";
import OrganiserTopBar  from "@/components/organiser/TopBar";

/* ── Step definitions ───────────────────────────────────────── */
const STEPS = [
  { k: "basics",   n: "01", label: "The Basics",          sub: "Name, discipline, summary"   },
  { k: "when",     n: "02", label: "Date & Location",     sub: "When and where it happens"   },
  { k: "format",   n: "03", label: "Format & Categories", sub: "How athletes compete"        },
  { k: "tickets",  n: "04", label: "Tickets & Pricing",   sub: "Waves, fees, inclusions"     },
  { k: "extras",   n: "05", label: "Details & Media",     sub: "Cover image, logistics"      },
  { k: "review",   n: "06", label: "Review & Publish",    sub: "Check and go live"           },
] as const;

type Discipline = "hyrox" | "crossfit" | "running" | "hybrid";
type Format     = "individual" | "team" | "both";
type Level      = "beginner" | "open" | "elite";
type AusState   = "nsw" | "vic" | "qld" | "wa" | "sa" | "tas" | "act" | "nt";

interface Wave { label: string; price: string; closes: string; }

interface FormState {
  title: string; discipline: Discipline; tagline: string; description: string;
  date: string; startTime: string; endTime: string;
  venue: string; address: string; city: string; state: AusState;
  format: Format; level: Level; categories: string[]; cap: string; minAge: string;
  waves: Wave[];
  inclusions: string; extras: string; refundPolicy: string;
  coverImage: File | null; registrationUrl: string; accessibilityInfo: string;
}

const INITIAL: FormState = {
  title: "", discipline: "hyrox", tagline: "", description: "",
  date: "", startTime: "07:00", endTime: "18:00",
  venue: "", address: "", city: "", state: "nsw",
  format: "both", level: "open",
  categories: ["Individual", "Doubles Mixed"],
  cap: "", minAge: "16",
  waves: [
    { label: "Early Bird", price: "129", closes: "" },
    { label: "Standard",   price: "149", closes: "" },
    { label: "Late Entry", price: "169", closes: "" },
  ],
  inclusions: "", extras: "", refundPolicy: "",
  coverImage: null, registrationUrl: "", accessibilityInfo: "",
};

/* ── Shared field primitives ────────────────────────────────── */
function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
          {label} {required && <span className="text-primary ml-0.5">*</span>}
        </label>
        {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors";
const textareaCls = "w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none resize-none transition-colors";
const selectCls = "w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[15px] text-light focus:border-primary focus:outline-none appearance-none cursor-pointer transition-colors";

/* ── Step 1: Basics ─────────────────────────────────────────── */
const DISCIPLINES: { v: Discipline; l: string; d: string }[] = [
  { v: "hyrox",    l: "HYROX",    d: "8 stations × 1km runs"     },
  { v: "crossfit", l: "CrossFit", d: "Functional fitness comp"   },
  { v: "running",  l: "Running",  d: "5K · 10K · Half · Marathon"},
  { v: "hybrid",   l: "Hybrid",   d: "Multi-discipline / OCR"    },
];

function BasicsStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  return (
    <div>
      <Field label="Event title" required hint={`${form.title.length}/60`}>
        <input maxLength={60} value={form.title} onChange={(e) => update({ title: e.target.value })}
          placeholder="e.g. HYROX Sydney 2026" className={inputCls} />
      </Field>

      <Field label="Discipline" required>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DISCIPLINES.map((d) => {
            const on = form.discipline === d.v;
            return (
              <button key={d.v} type="button" onClick={() => update({ discipline: d.v })}
                className={`text-left p-4 rounded-md border transition-all ${on ? "border-primary bg-primary/5" : "border-dark-lighter hover:border-muted"}`}>
                <div className={`font-headline text-[15px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{d.l}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted mt-1">{d.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Tagline" required hint={`${form.tagline.length}/80 · shown in cards`}>
        <input maxLength={80} value={form.tagline} onChange={(e) => update({ tagline: e.target.value })}
          placeholder="One sentence that sells it. e.g. 'The World Series of Fitness Racing returns to Sydney.'"
          className={inputCls} />
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

/* ── Step 2: When & Where ───────────────────────────────────── */
const AUS_STATES: [AusState, string][] = [
  ["nsw","NSW"],["vic","VIC"],["qld","QLD"],["wa","WA"],["sa","SA"],["tas","TAS"],["act","ACT"],["nt","NT"],
];

function WhenStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  return (
    <div>
      <Field label="Event date" required>
        <input type="date" value={form.date} onChange={(e) => update({ date: e.target.value })} className={inputCls} />
      </Field>

      <div className="grid grid-cols-2 gap-5">
        <Field label="Start time" required>
          <input type="time" value={form.startTime} onChange={(e) => update({ startTime: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Cut-off time" hint="Last finisher">
          <input type="time" value={form.endTime} onChange={(e) => update({ endTime: e.target.value })} className={inputCls} />
        </Field>
      </div>

      <div className="my-6 border-t border-dark-lighter" />

      <Field label="Venue name" required>
        <input value={form.venue} onChange={(e) => update({ venue: e.target.value })}
          placeholder="Sydney Olympic Park" className={inputCls} />
      </Field>
      <Field label="Street address">
        <input value={form.address} onChange={(e) => update({ address: e.target.value })}
          placeholder="Olympic Boulevard, Sydney Olympic Park" className={inputCls} />
      </Field>
      <div className="grid grid-cols-[1fr_160px] gap-5">
        <Field label="City" required>
          <input value={form.city} onChange={(e) => update({ city: e.target.value })}
            placeholder="Sydney" className={inputCls} />
        </Field>
        <Field label="State" required>
          <select value={form.state} onChange={(e) => update({ state: e.target.value as AusState })} className={selectCls}>
            {AUS_STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>

      {/* Venue placeholder */}
      <Field label="Venue preview" hint="A map will appear here once address is valid">
        <div className="relative rounded-md border border-dark-lighter overflow-hidden placeholder-stripes scan-grid h-48 flex items-center justify-center">
          <div className="absolute top-2 left-2 w-4 h-4 hud-corner-tl" />
          <div className="absolute top-2 right-2 w-4 h-4 hud-corner-tr" />
          <div className="absolute bottom-2 left-2 w-4 h-4 hud-corner-bl" />
          <div className="absolute bottom-2 right-2 w-4 h-4 hud-corner-br" />
          <div className="text-center">
            <MapPin className="w-5 h-5 text-primary mx-auto mb-2" />
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted">{form.venue || "Venue preview"}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-dark mt-1">{form.city || "—"}, {form.state.toUpperCase()}</div>
          </div>
        </div>
      </Field>
    </div>
  );
}

/* ── Step 3: Format ─────────────────────────────────────────── */
const FORMATS: { v: Format; l: string; d: string }[] = [
  { v: "individual", l: "Individual",   d: "Solo athletes"         },
  { v: "team",       l: "Team / Pairs", d: "Doubles or relay"      },
  { v: "both",       l: "Both",         d: "Individual & team"     },
];
const LEVELS: { v: Level; l: string }[] = [
  { v: "beginner", l: "Beginner friendly" },
  { v: "open",     l: "Open (all levels)" },
  { v: "elite",    l: "Elite / Pro"       },
];
const ALL_CATS = [
  "Individual","Doubles Mixed","Doubles Women","Doubles Men",
  "Relay 4-Person","Pro","Rx","Scaled","5K","10K","Half Marathon","Marathon","Ultra",
];

function FormatStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const toggle = (c: string) => {
    const s = new Set(form.categories);
    s.has(c) ? s.delete(c) : s.add(c);
    update({ categories: [...s] });
  };

  return (
    <div>
      <Field label="Competition format" required>
        <div className="grid grid-cols-3 gap-3">
          {FORMATS.map((f) => {
            const on = form.format === f.v;
            return (
              <button key={f.v} type="button" onClick={() => update({ format: f.v })}
                className={`text-left p-4 rounded-md border transition-all ${on ? "border-primary bg-primary/5" : "border-dark-lighter hover:border-muted"}`}>
                <div className={`font-headline text-[14px] font-black italic tracking-tighter ${on ? "text-primary" : "text-light"}`}>{f.l}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted mt-1">{f.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Experience level" required>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l.v} type="button" onClick={() => update({ level: l.v })}
              className={`font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md chip ${form.level === l.v ? "chip-active" : ""}`}>
              {l.l}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Divisions & categories" hint={`${form.categories.length} selected`}>
        <div className="flex flex-wrap gap-2">
          {ALL_CATS.map((c) => (
            <button key={c} type="button" onClick={() => toggle(c)}
              className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md chip ${form.categories.includes(c) ? "chip-active" : ""}`}>
              {form.categories.includes(c) && <Check className="w-3 h-3 inline mr-1" />}
              {c}
            </button>
          ))}
          <button type="button"
            className="font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md chip hover:chip-active">
            <Plus className="w-3 h-3 inline mr-1" /> Custom…
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-5">
        <Field label="Participant cap" hint="Leave blank for unlimited">
          <input type="number" value={form.cap} onChange={(e) => update({ cap: e.target.value })}
            placeholder="3500" className={inputCls} />
        </Field>
        <Field label="Minimum age" required>
          <input type="number" value={form.minAge} onChange={(e) => update({ minAge: e.target.value })}
            className={inputCls} />
        </Field>
      </div>
    </div>
  );
}

/* ── Step 4: Tickets ────────────────────────────────────────── */
function TicketsStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const updateWave = (i: number, patch: Partial<Wave>) => {
    const waves = [...form.waves];
    waves[i] = { ...waves[i], ...patch };
    update({ waves });
  };
  const removeWave = (i: number) => update({ waves: form.waves.filter((_, j) => j !== i) });
  const addWave    = () => update({ waves: [...form.waves, { label: "New wave", price: "", closes: "" }] });

  return (
    <div>
      <Field label="Ticket waves" hint="Staggered pricing (early bird → late entry)">
        <div className="space-y-3">
          {form.waves.map((w, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_140px_180px_auto] gap-3 items-center bg-dark border border-dark-lighter rounded-md p-3">
              <div className="w-8 h-8 rounded-md bg-dark-light flex items-center justify-center font-headline font-black italic text-primary">
                {i + 1}
              </div>
              <input value={w.label} onChange={(e) => updateWave(i, { label: e.target.value })}
                placeholder="Wave name" className={inputCls} />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-headline text-[13px] text-muted">A$</span>
                <input value={w.price} onChange={(e) => updateWave(i, { price: e.target.value })}
                  placeholder="129" className={`${inputCls} pl-9`} />
              </div>
              <input type="date" value={w.closes} onChange={(e) => updateWave(i, { closes: e.target.value })}
                className={inputCls} />
              <button onClick={() => removeWave(i)}
                className="w-10 h-10 rounded text-muted-dark hover:text-primary hover:bg-dark-lighter flex items-center justify-center transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={addWave}
            className="w-full border border-dashed border-dark-lighter rounded-md py-3 font-headline text-[12px] uppercase tracking-widest text-muted hover:text-primary hover:border-primary/50 flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add ticket wave
          </button>
        </div>
      </Field>

      <Field label="What's included in the entry fee" hint="Shown on the event page">
        <textarea rows={3} value={form.inclusions} onChange={(e) => update({ inclusions: e.target.value })}
          placeholder="Finisher medal, timing chip, race bib, post-race recovery bag, expo access."
          className={textareaCls} />
      </Field>

      <Field label="Optional extras" hint="Add-ons at checkout">
        <textarea rows={2} value={form.extras} onChange={(e) => update({ extras: e.target.value })}
          placeholder="Race kit ($65), official photos ($45), merch bundle ($89)."
          className={textareaCls} />
      </Field>

      <Field label="Refund & transfer policy">
        <textarea rows={3} value={form.refundPolicy} onChange={(e) => update({ refundPolicy: e.target.value })}
          placeholder="No refunds. Deferrals to next year's event up to 30 days before race day for $25."
          className={textareaCls} />
      </Field>

      <div className="bg-primary/5 border border-primary/30 rounded-md p-4 flex gap-3">
        <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-primary mb-1">Startline fee</div>
          <p className="text-[13px] text-muted-light leading-relaxed">
            A 3.5% platform fee + A$0.50 per registration is deducted at checkout. All prices shown to athletes are inclusive.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Step 5: Extras / Media ─────────────────────────────────── */
function ExtrasStep({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  return (
    <div>
      <Field label="Cover image" required hint="Recommended 1920×1080 · max 5MB">
        <label className="block cursor-pointer">
          <div className="relative rounded-md border-2 border-dashed border-dark-lighter hover:border-primary/60 placeholder-stripes scan-grid aspect-video flex flex-col items-center justify-center transition-colors">
            <div className="absolute top-3 left-3 w-5 h-5 hud-corner-tl" />
            <div className="absolute top-3 right-3 w-5 h-5 hud-corner-tr" />
            <div className="absolute bottom-3 left-3 w-5 h-5 hud-corner-bl" />
            <div className="absolute bottom-3 right-3 w-5 h-5 hud-corner-br" />
            <div className="w-12 h-12 rounded-full bg-dark-light border border-dark-lighter flex items-center justify-center mb-3">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div className="font-headline text-sm font-bold uppercase tracking-widest text-light">Drop cover image here</div>
            <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark mt-1">or click to browse</div>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-dark">JPG · PNG · WEBP</div>
          </div>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => update({ coverImage: e.target.files?.[0] ?? null })}
          />
        </label>
      </Field>

      <Field label="Registration URL" required hint="Where athletes sign up">
        <input value={form.registrationUrl} onChange={(e) => update({ registrationUrl: e.target.value })}
          placeholder="https://hyrox.com/sydney-2026" className={inputCls} />
      </Field>

      <div className="grid grid-cols-2 gap-5">
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

/* ── Step 6: Review ─────────────────────────────────────────── */
function ReviewStep({ form, setStep }: { form: FormState; setStep: (n: number) => void }) {
  const rows: { k: string; v: string; step: number }[] = [
    { k: "Title",         v: form.title || "—",                                               step: 0 },
    { k: "Discipline",    v: form.discipline.toUpperCase(),                                    step: 0 },
    { k: "Tagline",       v: form.tagline || "—",                                             step: 0 },
    { k: "Date",          v: form.date || "—",                                                step: 1 },
    { k: "Start / End",   v: `${form.startTime} → ${form.endTime}`,                           step: 1 },
    { k: "Venue",         v: `${form.venue || "—"}, ${form.city || "—"}, ${form.state.toUpperCase()}`, step: 1 },
    { k: "Format",        v: form.format,                                                      step: 2 },
    { k: "Level",         v: form.level,                                                       step: 2 },
    { k: "Categories",    v: form.categories.join(", ") || "—",                               step: 2 },
    { k: "Cap / Min age", v: `${form.cap || "∞"} · ${form.minAge}+`,                         step: 2 },
    { k: "Ticket waves",  v: `${form.waves.length} wave${form.waves.length !== 1 ? "s" : ""}, from A$${form.waves[0]?.price || "—"}`, step: 3 },
    { k: "Cover image",   v: form.coverImage ? "Uploaded" : "Using placeholder",              step: 4 },
    { k: "Reg. URL",      v: form.registrationUrl || "—",                                     step: 4 },
  ];

  return (
    <div>
      <div className="bg-dark border border-dark-lighter rounded-lg overflow-hidden mb-6">
        {rows.map((r, i) => (
          <div key={r.k} className={`flex items-center gap-4 px-5 py-4 ${i === rows.length - 1 ? "" : "border-b border-dark-lighter"}`}>
            <div className="font-headline text-[11px] uppercase tracking-widest text-muted w-32 flex-shrink-0">{r.k}</div>
            <div className="flex-1 text-[14px] text-light truncate">{r.v}</div>
            <button onClick={() => setStep(r.step)}
              className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary flex items-center gap-1 transition-colors">
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
            <p className="text-[13px] text-muted-light leading-relaxed">
              Once published, athletes will be able to find your event in search and carousels.
              You&apos;ll receive a notification each time someone registers.
            </p>
          </div>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" defaultChecked className="accent-primary w-4 h-4 mt-1" />
        <span className="text-[13px] text-muted-light leading-relaxed">
          I confirm I have the rights to host this event and the information provided is accurate.
          I agree to the{" "}
          <span className="text-primary hover:underline cursor-pointer">Organiser Terms</span> and{" "}
          <span className="text-primary hover:underline cursor-pointer">Event Listing Policy</span>.
        </span>
      </label>
    </div>
  );
}

/* ── Live preview ────────────────────────────────────────────── */
const DISC_LABEL: Record<Discipline, string> = {
  hyrox: "HYROX", crossfit: "CrossFit", running: "Running", hybrid: "Hybrid",
};
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function LivePreview({ form }: { form: FormState }) {
  const parts  = (form.date || "").split("-");
  const day    = parts[2] || "—";
  const month  = parts[1] ? MONTHS[parseInt(parts[1]) - 1] : "—";
  const price  = form.waves[0]?.price;
  const pct    = 0; // new listing, no regs yet

  const checks = [
    { l: "Title",        ok: form.title.length > 2     },
    { l: "Tagline",      ok: form.tagline.length > 2   },
    { l: "Date & time",  ok: !!form.date               },
    { l: "Venue",        ok: !!form.venue && !!form.city },
    { l: "Categories",   ok: form.categories.length > 0 },
    { l: "Ticket waves", ok: form.waves.length > 0 && !!form.waves[0].price },
    { l: "Cover image",  ok: !!form.coverImage         },
    { l: "Reg. URL",     ok: !!form.registrationUrl    },
  ];
  const done = checks.filter((c) => c.ok).length;
  const completePct = Math.round((done / checks.length) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-dot" /> Live preview
        </div>
        <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">How it appears in search</div>
      </div>

      {/* Preview card */}
      <div className="bg-dark-darker rounded-xl border border-dark-lighter overflow-hidden">
        <div className="relative h-40 placeholder-stripes scan-grid flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/40 to-transparent" />
          <div className="absolute top-3 left-3">
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-2 py-1 rounded-full">DRAFT</span>
          </div>
          <div className="absolute top-3 right-3 bg-dark/80 backdrop-blur-sm px-3 py-1.5 text-right">
            <div className="font-headline text-[9px] font-medium uppercase tracking-widest text-muted leading-none mb-0.5">{month}</div>
            <div className="font-headline text-xl font-black text-light leading-none">{day}</div>
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <div className="font-headline text-[10px] uppercase tracking-widest text-primary mb-0.5">{DISC_LABEL[form.discipline]}</div>
            <div className="font-headline text-lg font-black italic tracking-tighter text-light leading-tight line-clamp-2">
              {form.title || <span className="text-muted-dark">Event title…</span>}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-1.5">
          <div className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted">
            <MapPin className="w-3 h-3 text-primary" />
            <span className="truncate">{form.venue ? `${form.venue}, ${form.state.toUpperCase()}` : "Venue, STATE"}</span>
          </div>
          <div className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted">
            <Calendar className="w-3 h-3 text-primary" />
            {form.date || "Date pending"} · {form.startTime}
          </div>
          <div className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted">
            <Users className="w-3 h-3 text-primary" />
            {form.format === "both" ? "Individual & Team" : form.format === "individual" ? "Individual" : "Team / Pairs"}
          </div>
          <p className="text-[12px] text-muted border-l-2 border-dark-lighter pl-3 mt-3 line-clamp-2">
            {form.tagline || <span className="text-muted-dark italic">Tagline will appear here…</span>}
          </p>
          {price && (
            <div className="pt-3 mt-3 border-t border-dark-lighter flex items-center justify-between">
              <span className="font-headline text-[10px] uppercase tracking-widest text-muted">From</span>
              <span className="font-headline text-lg font-black italic tracking-tighter text-primary">A${price}</span>
            </div>
          )}
        </div>
      </div>

      {/* Completeness */}
      <div className="mt-6">
        <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Listing completeness</div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[11px] text-light">{done}/{checks.length} complete</span>
          <span className="font-headline text-[11px] font-bold text-primary">{completePct}%</span>
        </div>
        <div className="h-1 bg-dark-lighter rounded-full overflow-hidden mb-4">
          <div className="h-full bg-primary transition-all" style={{ width: `${completePct}%` }} />
        </div>
        <ul className="space-y-1.5">
          {checks.map((c) => (
            <li key={c.l} className="flex items-center gap-2 text-[12px]">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center ${c.ok ? "bg-primary/20 text-primary" : "bg-dark-lighter text-muted-dark"}`}>
                {c.ok ? <Check className="w-3 h-3" /> : <X className="w-2.5 h-2.5" />}
              </span>
              <span className={c.ok ? "text-light" : "text-muted"}>{c.l}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Main wizard page ───────────────────────────────────────── */
export default function NewListingPage() {
  const router = useRouter();
  const [step,     setStep]     = useState(0);
  const [form,     setForm]     = useState<FormState>(INITIAL);
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState("");

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const canProceed = useMemo(() => {
    if (step === 0) return form.title.length > 2 && form.tagline.length > 2;
    if (step === 1) return !!form.date && !!form.venue && !!form.city;
    return true;
  }, [step, form]);

  const submitToApi = async (asDraft: boolean) => {
    setSaving(true);
    setApiError("");
    try {
      const payload = {
        title:            form.title,
        discipline:       form.discipline,
        tagline:          form.tagline,
        description:      form.description,
        eventDate:        form.date,
        startTime:        form.startTime,
        endTime:          form.endTime,
        venue:            form.venue,
        address:          form.address,
        city:             form.city,
        state:            form.state,
        format:           form.format,
        level:            form.level,
        categories:       form.categories,
        cap:              form.cap ? parseInt(form.cap) : null,
        minAge:           parseInt(form.minAge),
        waves:            form.waves,
        inclusions:       form.inclusions,
        extras:           form.extras,
        refundPolicy:     form.refundPolicy,
        registrationUrl:  form.registrationUrl,
        accessibilityInfo: form.accessibilityInfo,
        submit:           !asDraft,
      };
      const res  = await fetch("/api/organiser/events", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setApiError(data.error ?? "Something went wrong."); return; }
      router.push("/organiser/dashboard");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else submitToApi(false);
  };
  const prev = () => {
    if (step > 0) setStep(step - 1);
    else router.push("/organiser/dashboard");
  };

  const now = new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-dark-darker">
      <OrganiserTopBar />
      <div className="flex pt-16 min-h-[calc(100vh-64px)]">
      <OrganiserSidebar />

      <div className="flex-1 min-w-0 anim-fade-slide">
        {/* Sticky header bar */}
        <div className="sticky top-16 z-30 bg-dark-darker/95 backdrop-blur border-b border-dark-lighter">
          <div className="px-6 lg:px-10 pt-5 pb-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => router.push("/organiser/dashboard")}
                className="flex items-center gap-1.5 text-muted hover:text-primary font-headline text-[11px] uppercase tracking-widest transition-colors">
                <ArrowLeft className="w-4 h-4" /> Event Listings
              </button>
              <span className="text-muted-dark">/</span>
              <span className="font-headline text-[11px] uppercase tracking-widest text-light">Create new listing</span>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-dark">
                Draft · Autosaved {now}
              </span>
            </div>

            {/* Step rail */}
            <div className="flex items-center gap-0">
              {STEPS.map((s, i) => {
                const done = i < step;
                const cur  = i === step;
                return (
                  <div key={s.k} className="flex items-center flex-1 last:flex-none">
                    <button
                      onClick={() => i <= step + 1 && setStep(i)}
                      className={`flex items-center gap-2.5 text-left transition-opacity ${cur ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
                    >
                      <div className={`w-8 h-8 rounded-md border flex items-center justify-center font-headline font-black italic text-[13px] flex-shrink-0
                        ${cur  ? "bg-primary text-dark border-primary"
                        : done ? "bg-dark-lighter text-primary border-primary/40"
                        :        "bg-dark border-dark-lighter text-muted-dark"}`}>
                        {done ? <Check className="w-4 h-4" /> : s.n}
                      </div>
                      <div className="hidden xl:block">
                        <div className={`font-headline text-[11px] font-bold uppercase tracking-widest whitespace-nowrap ${cur ? "text-light" : "text-muted"}`}>{s.label}</div>
                        <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark whitespace-nowrap">{s.sub}</div>
                      </div>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-px mx-3 ${done ? "bg-primary/50" : "step-line"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-[1fr_360px]">
          {/* Form area */}
          <div className="p-6 lg:p-10 max-w-[820px]">
            <div className="mb-8">
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary flex items-center gap-3 mb-3">
                <span className="w-8 h-px bg-primary" /> STEP {STEPS[step].n} / {STEPS[STEPS.length - 1].n}
              </div>
              <h1 className="font-headline text-[44px] font-black italic tracking-tighter leading-none">
                {step === 0 && <>Let&apos;s start with<br /><span className="text-primary">the basics.</span></>}
                {step === 1 && <>When and where<br /><span className="text-primary">do athletes race?</span></>}
                {step === 2 && <>Pick the<br /><span className="text-primary">race format.</span></>}
                {step === 3 && <>Tickets, waves<br /><span className="text-primary">and pricing.</span></>}
                {step === 4 && <>Final details<br /><span className="text-primary">and cover image.</span></>}
                {step === 5 && <>Review, then<br /><span className="text-primary">hit publish.</span></>}
              </h1>
              <p className="text-muted mt-4 max-w-lg text-[15px]">
                {step === 0 && "Keep it short and sharp — this is what athletes will see first."}
                {step === 1 && "Athletes will search your event by city, state and date."}
                {step === 2 && "You can enable multiple formats. Most HYROX events select Individual + Doubles."}
                {step === 3 && "Add up to 6 ticket waves. You can edit dates and prices anytime before opening sales."}
                {step === 4 && "Polish your listing with a cover image, logistics info and your registration link."}
                {step === 5 && "Nothing's live yet. You can always come back to edit after publishing."}
              </p>
            </div>

            {step === 0 && <BasicsStep  form={form} update={update} />}
            {step === 1 && <WhenStep    form={form} update={update} />}
            {step === 2 && <FormatStep  form={form} update={update} />}
            {step === 3 && <TicketsStep form={form} update={update} />}
            {step === 4 && <ExtrasStep  form={form} update={update} />}
            {step === 5 && <ReviewStep  form={form} setStep={setStep} />}

            {/* Navigation */}
            {apiError && (
              <div className="mt-4 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">
                {apiError}
              </div>
            )}
            <div className="mt-8 flex items-center justify-between pt-6 border-t border-dark-lighter">
              <button onClick={prev}
                className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-2 transition-colors">
                <ArrowLeft className="w-4 h-4" /> {step === 0 ? "Cancel" : "Back"}
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => submitToApi(true)} disabled={saving}
                  className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light px-5 py-3 transition-colors disabled:opacity-40">
                  Save draft
                </button>
                <button onClick={next} disabled={!canProceed || saving}
                  className="bg-machined shadow-machined disabled:opacity-40 disabled:cursor-not-allowed text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform">
                  {saving
                    ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Saving…</>
                    : step === STEPS.length - 1
                      ? <><Check className="w-4 h-4" /> Submit for review</>
                      : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          </div>

          {/* Live preview (sticky) */}
          <aside className="hidden lg:block border-l border-dark-lighter bg-dark p-6 sticky top-[152px] h-[calc(100vh-152px)] overflow-y-auto">
            <LivePreview form={form} />
          </aside>
        </div>
      </div>
    </div>
    </div>
  );
}
