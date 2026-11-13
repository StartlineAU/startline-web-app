"use client";

import { useRef, useEffect } from "react";
import { Bold, Italic, Underline, AlignLeft } from "lucide-react";
import { DEFAULT_REFUND_TIERS, tiersAreValid, type RefundTier } from "@/lib/refund-policy";
import { isFreeEvent } from "@/lib/event-types";

/**
 * The parts of the listing page an organiser fills in. Each is an element id
 * (`region-<id>`) on the editor, so the checklist can take them straight to it.
 */
export type RegionId =
  | "cover" | "discipline" | "title"
  | "description" | "tickets"
  | "registration" | "date" | "time" | "location"
  | "format" | "divisions" | "intensity" | "refund";

/**
 * One required thing the organiser has not finished: a short name for it, the
 * region of the page that fixes it, and what to tell them.
 */
export type Requirement = { row: string; region: RegionId; message: string };

/**
 * A ticket category needs a name and a price before the event can be published.
 * The free toggle writes "0", and a hand-typed "0.00" means the same thing, so
 * anything that parses to a number at or above zero counts as priced. A bare "."
 * or an empty box does not.
 */
export function waveIsComplete(w: { label: string; price: string }): boolean {
  const price = parseFloat(w.price);
  return w.label.trim().length > 0 && Number.isFinite(price) && price >= 0;
}

/** One required check on the listing, and whether it is met. */
export type RequirementCheck = Requirement & { done: boolean };

/**
 * Every check that applies to this listing, met or not, in the order the page
 * reads. The editor's progress count and checklist come from here, and
 * `missingRequirements` is the unmet ones, so none of them can disagree.
 */
export function requirementChecks(form: FormState): RequirementCheck[] {
  const checks: RequirementCheck[] = [];
  const check = (row: string, region: RegionId, done: boolean, message: string) =>
    checks.push({ row, region, done, message });
  const timeOrderBad = !!(form.startTime && form.endTime && form.endTime <= form.startTime);

  check("Cover image", "cover", !!(form.coverImage || form.coverImageUrl), "Upload a cover image");
  check("Discipline", "discipline", !!form.discipline, "Choose a discipline");
  check("Event title", "title", form.title.trim().length > 2, "Add an event name of at least 3 characters");
  check("Description", "description", stripHtml(form.description).length > 0, "Write the event description");
  check("Tickets & prices", "tickets", form.waves.length > 0 && form.waves.every(waveIsComplete),
    "Every ticket category needs a name and a price");
  if (form.registrationType !== "startline") {
    check("Registration link", "registration", !!form.registrationUrl.trim(), "Add your registration link");
  }
  check("Date", "date", !!form.date, "Choose the event date");
  check("Start time", "time", !!form.startTime && !timeOrderBad,
    timeOrderBad ? "Cut-off time must be after the start time" : "Set a start time");
  check("Venue address", "location", !!(form.address.trim() && form.city.trim() && form.state),
    "Add the street address, city and state");
  check("Format", "format", !!form.format, "Choose a format");
  if (DISCIPLINE_CATS[form.discipline as Discipline]) {
    check("Divisions", "divisions", form.categories.length > 0, "Choose at least one division");
  }
  check("Intensity", "intensity", !!form.level, "Choose an intensity level");
  // A free event takes no money, so it has no refund policy to finish.
  if (!isFreeEvent(form.waves)) {
    check("Refund policy", "refund", tiersAreValid(form.refundTiers), "Finish the refund policy");
  }
  return checks;
}

/** Everything still standing between this form and publishing. */
export function missingRequirements(form: FormState): Requirement[] {
  return requirementChecks(form).filter((c) => !c.done).map(({ row, region, message }) => ({ row, region, message }));
}

export type Discipline = "crossfit" | "running" | "hybrid" | "cycling" | "swimming" | "other" | "";
export type Format     = "individual" | "team" | "both" | "";
export type Intensity  = "low" | "moderate" | "high" | "extreme" | "";
export type AusState   = "nsw" | "vic" | "qld" | "wa" | "sa" | "tas" | "act" | "nt" | "";

/**
 * One ticket category. `qty` is how many tickets it has ("" for no limit). The
 * organiser sets it and athletes never see it: checkout stops selling at it and
 * the register page shows the tier as sold out (#528).
 */
export interface Wave { label: string; price: string; closes: string; startTime: string; qty: string; }

export const EMPTY_WAVE: Wave = { label: "", price: "", closes: "", startTime: "", qty: "" };

/** A ticket category's quantity as a number, or null when it has no limit. */
export function waveQty(w: Pick<Wave, "qty">): number | null {
  const n = parseInt(w.qty, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The event's overall cap, which checkout, the register page and the
 * organiser dashboards read. When every ticket category has a quantity it is
 * their total; otherwise it is whatever overall limit the event carried from
 * before ticket quantities (`cap`), which the organiser can remove.
 */
export function eventCap(form: Pick<FormState, "waves" | "cap">): number | null {
  const quantities = form.waves.map(waveQty);
  if (quantities.length > 0 && quantities.every((q): q is number => q !== null)) {
    return quantities.reduce((sum, q) => sum + q, 0);
  }
  const legacy = parseInt(form.cap, 10);
  return Number.isFinite(legacy) && legacy > 0 ? legacy : null;
}

export interface InfoPdf {
  file: File | null;
  url: string;
  label: string;
  name: string;
}

export interface FormState {
  title: string;
  discipline: Discipline;
  description: string;
  format: Format;
  level: Intensity;
  categories: string[];
  /** An overall entry limit from before ticket quantities; "" for none. See `eventCap`. */
  cap: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  address: string;
  city: string;
  state: AusState;
  latitude: number | null;
  longitude: number | null;
  waves: Wave[];
  prizeMoney: boolean;
  prizeMoneyAmount: string;
  prizeMoneyDetails: string;
  refundTiers: RefundTier[];
  refundPolicy: string;
  registrationType: "startline" | "external";
  feeStructure: "athlete" | "organiser";
  registrationUrl: string;
  coverImage: File | null;
  coverImageUrl: string;
  informationPdfs: InfoPdf[];
  photos: File[];
  photoUrls: string[];
}

export const INITIAL: FormState = {
  title: "", discipline: "", description: "",
  format: "", level: "", categories: [], cap: "",
  date: "", endDate: "", startTime: "", endTime: "",
  venue: "", address: "", city: "", state: "", latitude: null, longitude: null,
  waves: [EMPTY_WAVE],
  prizeMoney: false, prizeMoneyAmount: "", prizeMoneyDetails: "",
  refundTiers: DEFAULT_REFUND_TIERS, refundPolicy: "",
  registrationType: "startline", feeStructure: "athlete", registrationUrl: "",
  coverImage: null, coverImageUrl: "",
  informationPdfs: [],
  photos: [], photoUrls: [],
};

/* ── Shared field primitive ─────────────────────────────────── */
export function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
          {label}{required && <span className="text-primary font-black text-[15px] leading-none ml-1">*</span>}
        </label>
        {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-light">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export const inputCls    = "w-full bg-dark-light border border-dark-lighter rounded-md px-4 py-3 font-headline text-[15px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors";
export const textareaCls = "w-full bg-dark-light border border-dark-lighter rounded-md px-4 py-3 font-headline text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none resize-none transition-colors";

/* ═══════════════════════════════════════════════════════════════
   TIME PICKER
   ══════════════════════════════════════════════════════════════ */
export function fmt24to12(t: string): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/* ═══════════════════════════════════════════════════════════════
   RICH TEXT EDITOR
   ══════════════════════════════════════════════════════════════ */
export function RichTextEditor({ value, onChange, invalid = false }: { value: string; onChange: (html: string) => void; invalid?: boolean }) {
  const editorRef     = useRef<HTMLDivElement>(null);
  const userHasTyped  = useRef(false);

  useEffect(() => {
    if (editorRef.current && !userHasTyped.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val ?? undefined);
    editorRef.current?.focus();
  };

  const setBlock = (tag: string) => {
    document.execCommand("formatBlock", false, tag);
    editorRef.current?.focus();
  };

  const toolbarBtn = "w-8 h-8 rounded flex items-center justify-center text-light hover:bg-white/5 hover:text-light transition-colors font-headline font-bold text-[13px]";

  return (
    <div className={`border rounded-md overflow-hidden focus-within:border-primary transition-colors ${invalid ? "border-orange-400/50" : "border-dark-lighter"}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-dark-lighter bg-white/[0.02] flex-wrap">
        <button type="button" title="Bold (Ctrl+B)"      onClick={() => exec("bold")}      className={toolbarBtn}><Bold      className="w-3.5 h-3.5" /></button>
        <button type="button" title="Italic (Ctrl+I)"    onClick={() => exec("italic")}    className={toolbarBtn}><Italic    className="w-3.5 h-3.5" /></button>
        <button type="button" title="Underline (Ctrl+U)" onClick={() => exec("underline")} className={toolbarBtn}><Underline className="w-3.5 h-3.5" /></button>
        <div className="w-px h-5 bg-dark-lighter mx-1" />
        <button type="button" title="Heading"   onClick={() => setBlock("h3")} className={`${toolbarBtn} text-[11px] font-black uppercase tracking-widest`}>H</button>
        <button type="button" title="Subheading" onClick={() => setBlock("h4")} className={`${toolbarBtn} text-[10px] font-black uppercase tracking-widest`}>H2</button>
        <button type="button" title="Normal text" onClick={() => setBlock("p")} className={toolbarBtn}><AlignLeft className="w-3.5 h-3.5" /></button>
        <div className="w-px h-5 bg-dark-lighter mx-1" />
        <button type="button" title="Bullet list" onClick={() => exec("insertUnorderedList")} className={`${toolbarBtn} text-[11px]`}>• List</button>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Event description"
        onInput={() => {
          userHasTyped.current = true;
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        onKeyDown={e => {
          if (e.ctrlKey || e.metaKey) {
            if (e.key === "b") { e.preventDefault(); exec("bold"); }
            if (e.key === "i") { e.preventDefault(); exec("italic"); }
            if (e.key === "u") { e.preventDefault(); exec("underline"); }
          }
        }}
        data-placeholder="Tell athletes what makes this event unmissable: course details, atmosphere, divisions, what to bring…"
        className="min-h-[220px] px-4 py-3 font-headline text-[14px] text-light focus:outline-none prose prose-sm max-w-none
          [&_h3]:font-headline [&_h3]:font-black [&_h3]:text-[16px] [&_h3]:text-light [&_h3]:mt-3 [&_h3]:mb-1
          [&_h4]:font-headline [&_h4]:font-bold [&_h4]:text-[14px] [&_h4]:text-light [&_h4]:mt-2 [&_h4]:mb-1
          [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-0.5
          empty:before:content-[attr(data-placeholder)] empty:before:text-placeholder empty:before:pointer-events-none"
      />
    </div>
  );
}

/* ── Option lists ───────────────────────────────────────────── */
export const DISCIPLINES: { v: Discipline; l: string; d: string }[] = [
  { v: "crossfit",  l: "CrossFit",  d: "Functional fitness comp"    },
  { v: "running",   l: "Running",   d: "5km · 10km · Half · Marathon" },
  { v: "hybrid",    l: "Hybrid",    d: "Multi-discipline / OCR"     },
  { v: "cycling",   l: "Cycling",   d: "Road · Criterium · Gravel"  },
  { v: "swimming",  l: "Swimming",  d: "Pool · Open water events"   },
  { v: "other",     l: "Other",     d: "Another discipline"         },
];

export const DISCIPLINE_CATS: Partial<Record<Discipline, string[]>> = {
  running:  ["5K", "10K", "Half Marathon", "Marathon", "Ultra"],
  cycling:  ["Road Race", "Criterium", "Time Trial", "Gran Fondo", "Mountain Bike", "Gravel"],
  swimming: ["50m", "100m", "200m", "400m", "800m", "1500m", "Open Water"],
};

export const FORMATS: { v: Format; l: string; d: string }[] = [
  { v: "individual", l: "Individual",   d: "Solo athletes"     },
  { v: "team",       l: "Team / Pairs", d: "Doubles or relay"  },
  { v: "both",       l: "Both",         d: "Individual & team" },
];

export const INTENSITY_LEVELS: { v: Intensity; l: string; d: string }[] = [
  { v: "low",      l: "Low",      d: "Beginner / fun runs"      },
  { v: "moderate", l: "Moderate", d: "Intermediate fitness"     },
  { v: "high",     l: "High",     d: "Competitive & challenging" },
  { v: "extreme",  l: "Extreme",  d: "Elite / pro level"        },
];

export const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[^;\s]+;/g, " ").replace(/\s+/g, " ").trim();
