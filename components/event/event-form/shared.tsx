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
import AddressAutocomplete  from "@/components/ui/AddressAutocomplete";
import SuburbAutocomplete   from "@/components/ui/SuburbAutocomplete";
import LocationPreviewMap   from "@/components/organiser/LocationPreviewMap";
import DatePicker           from "@/components/ui/DatePicker";
import SelectMenu           from "@/components/ui/SelectMenu";
import TimePicker           from "@/components/ui/TimePicker";
import AddOnEditor, {
  uploadAddOnImages,
  publishAddOnsToProfile,
  PublishToProfileError,
} from "@/components/organiser/AddOnEditor";
import {
  type AddOnDraft,
  draftsFromCatalogue,
  draftsToPayload,
  draftValidationError,
} from "@/lib/add-on-drafts";


export const STEPS = [
  { k: "basics",   n: "01", label: "The Basics",          sub: "Name & Discipline"      },
  { k: "when",     n: "02", label: "Date & Location",     sub: "When & Where"           },
  { k: "tickets",  n: "03", label: "Tickets & Pricing",   sub: "Cost & Entry Options"   },
  { k: "media",    n: "04", label: "Media & Description", sub: "Images & Event Details" },
  { k: "review",   n: "05", label: "Final Review",        sub: "Review & Publish"       },
] as const;

export const STEP_ERRORS: Record<number, string> = {
  0: "Event name, format, discipline, intensity level, participant cap and minimum age are required.",
  1: "Date, start time, street address, city and state are required.",
  2: "Registration platform, a name and price for every ticket category, and refund policy are required.",
  3: "A cover image and full description are required.",
};

export type Discipline = "crossfit" | "running" | "hybrid" | "cycling" | "swimming" | "other" | "";
export type Format     = "individual" | "team" | "both" | "";
export type Intensity  = "low" | "moderate" | "high" | "extreme" | "";
export type AusState   = "nsw" | "vic" | "qld" | "wa" | "sa" | "tas" | "act" | "nt" | "";

export interface Wave { label: string; price: string; closes: string; startTime: string; }

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
  cap: string;
  minAge: string;
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
  format: "", level: "", categories: [], cap: "", minAge: "",
  date: "", endDate: "", startTime: "", endTime: "",
  venue: "", address: "", city: "", state: "", latitude: null, longitude: null,
  waves: [{ label: "", price: "", closes: "", startTime: "" }],
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
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
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
    <div className="border border-dark-lighter rounded-md overflow-hidden focus-within:border-primary transition-colors">
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

/* ═══════════════════════════════════════════════════════════════
   STEP 1 — THE BASICS
   ══════════════════════════════════════════════════════════════ */
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
