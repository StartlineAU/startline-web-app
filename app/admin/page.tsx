"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit2, Trash2, Save, X, Lock,
  AlertCircle, Check, CheckCircle, XCircle, ChevronDown, RefreshCw, Database,
  Eye, EyeOff, Calendar, Clock, MapPin, Tag, Ticket,
  Package, Trophy, Camera, Info, Zap, Users, FileText,
} from "lucide-react";
import {
  FitnessEvent, EventType, AustralianState, CompetitionFormat, ExperienceLevel,
  EVENT_TYPE_OPTIONS, STATE_OPTIONS, TicketDrop,
} from "@/types";
import { formatMediumDate } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
interface EventFormData {
  // Basic Info
  title: string;
  description: string;
  fullDescription: string;
  type: EventType | "";
  level: ExperienceLevel | "";
  format: CompetitionFormat | "";
  distance: string;
  organizer: string;
  registrationUrl: string;
  isOfficial: boolean;
  image: string;
  // Date & Time
  date: string;
  time: string;
  endTime: string;
  cutOffTime: string;
  dates: string[];
  // Location
  location: string;
  streetAddress: string;
  city: string;
  state: AustralianState | "";
  country: string;
  courseMapUrl: string;
  // Categories & Distances
  categories: string[];
  workoutDescription: string;
  soloAvailable: boolean | undefined;
  partnerAvailable: boolean | undefined;
  teamAvailable: boolean | undefined;
  // Registration & Tickets
  ticketDrops: TicketDrop[];
  registrationCloseDate: string;
  transferPolicy: string;
  refundPolicy: string;
  waitlistAvailable: boolean | undefined;
  // Cost & Pricing
  entryFeeInclusions: string;
  optionalExtras: string;
  groupDiscount: string;
  charityComponent: string;
  // Prizes & Awards
  prizeStructure: string;
  prizePoolTotal: string;
  ageGroupCategories: string;
  ceremonyDate: string;
  ceremonyLocation: string;
  specialAwards: string;
  // Expo & Race Day
  hasExpo: boolean | undefined;
  expoDetails: string;
  vendorOpportunities: boolean | undefined;
  bibCollectionInfo: string;
  athleteBriefing: string;
  // Additional Info
  participantCap: string;
  minAge: string;
  accessibilityInfo: string;
  parkingInfo: string;
  bagDropInfo: string;
  resultsProvider: string;
  resultsLink: string;
  additionalNotes: string;
}

const EMPTY_FORM: EventFormData = {
  title: "", description: "", fullDescription: "",
  type: "", level: "", format: "", distance: "",
  organizer: "", registrationUrl: "", isOfficial: false, image: "",
  date: "", time: "", endTime: "", cutOffTime: "", dates: [],
  location: "", streetAddress: "", city: "", state: "", country: "", courseMapUrl: "",
  categories: [], workoutDescription: "",
  soloAvailable: undefined, partnerAvailable: undefined, teamAvailable: undefined,
  ticketDrops: [], registrationCloseDate: "",
  transferPolicy: "", refundPolicy: "", waitlistAvailable: undefined,
  entryFeeInclusions: "", optionalExtras: "", groupDiscount: "", charityComponent: "",
  prizeStructure: "", prizePoolTotal: "", ageGroupCategories: "",
  ceremonyDate: "", ceremonyLocation: "", specialAwards: "",
  hasExpo: undefined, expoDetails: "", vendorOpportunities: undefined,
  bibCollectionInfo: "", athleteBriefing: "",
  participantCap: "", minAge: "", accessibilityInfo: "",
  parkingInfo: "", bagDropInfo: "",
  resultsProvider: "", resultsLink: "", additionalNotes: "",
};

// ── Reusable field components ──────────────────────────────────────────────
function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-1.5 flex items-center gap-1">
      {children}
      {required && <span className="text-primary text-base font-black leading-none">*</span>}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text", required = false,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-transparent text-light font-headline text-sm border-b border-dark-lighter focus:border-primary focus:outline-none pb-2 placeholder:text-muted/30 transition-colors"
    />
  );
}

function TextArea({
  value, onChange, placeholder, rows = 3, required = false,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; required?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      rows={rows}
      className="w-full bg-transparent text-light font-headline text-sm border border-dark-lighter focus:border-primary focus:outline-none p-3 placeholder:text-muted/30 resize-y transition-colors leading-relaxed"
    />
  );
}

function SelectInput({
  value, onChange, options, required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full appearance-none bg-transparent text-light font-headline text-sm border-b border-dark-lighter focus:border-primary focus:outline-none pb-2 cursor-pointer transition-colors"
      >
        <option value="" disabled className="bg-dark text-muted">— Select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-dark text-light">{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-0 bottom-2.5 w-3.5 h-3.5 text-muted pointer-events-none" />
    </div>
  );
}

function TriStateSelect({
  value, onChange,
}: {
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value === undefined ? "" : value ? "true" : "false"}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : v === "true");
        }}
        className="w-full appearance-none bg-transparent text-light font-headline text-sm border-b border-dark-lighter focus:border-primary focus:outline-none pb-2 cursor-pointer transition-colors"
      >
        <option value="" className="bg-dark text-muted">— Not Specified —</option>
        <option value="true" className="bg-dark text-light">Yes</option>
        <option value="false" className="bg-dark text-light">No</option>
      </select>
      <ChevronDown className="absolute right-0 bottom-2.5 w-3.5 h-3.5 text-muted pointer-events-none" />
    </div>
  );
}

function CheckboxField({
  checked, onChange, label,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 border flex items-center justify-center flex-shrink-0 transition-colors ${
          checked ? "bg-primary border-primary" : "border-dark-lighter group-hover:border-primary/50"
        }`}
      >
        {checked && <Check className="w-3 h-3 text-dark" />}
      </div>
      <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted group-hover:text-light transition-colors">
        {label}
      </span>
    </label>
  );
}

function FormSection({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Dynamic list editors ──────────────────────────────────────────────────
function TicketDropsEditor({ drops, onChange }: { drops: TicketDrop[]; onChange: (d: TicketDrop[]) => void }) {
  function update(i: number, key: keyof TicketDrop, value: string) {
    onChange(drops.map((d, idx) => idx === i ? { ...d, [key]: value } : d));
  }
  return (
    <div className="space-y-3">
      {drops.map((drop, i) => (
        <div key={i} className="grid grid-cols-3 gap-3 items-end">
          <div>
            <FieldLabel>Label</FieldLabel>
            <TextInput value={drop.label} onChange={(v) => update(i, "label", v)} placeholder="e.g. Early Bird" />
          </div>
          <div>
            <FieldLabel>Price</FieldLabel>
            <TextInput value={drop.price} onChange={(v) => update(i, "price", v)} placeholder="e.g. $149" />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <FieldLabel>Closes</FieldLabel>
              <TextInput value={drop.date} onChange={(v) => update(i, "date", v)} placeholder="e.g. 1 Mar 2025" />
            </div>
            <button
              type="button"
              onClick={() => onChange(drops.filter((_, idx) => idx !== i))}
              className="text-muted hover:text-red-400 pb-2 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...drops, { label: "", price: "", date: "" }])}
        className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-primary border border-dashed border-dark-lighter hover:border-primary/50 px-4 py-2 w-full justify-center transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add Ticket Tier
      </button>
    </div>
  );
}

function DatesEditor({ dates, onChange }: { dates: string[]; onChange: (d: string[]) => void }) {
  return (
    <div className="space-y-2">
      {dates.map((d, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <FieldLabel>Day {i + 1}</FieldLabel>
            <TextInput
              value={d}
              onChange={(v) => onChange(dates.map((x, idx) => idx === i ? v : x))}
              type="date"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(dates.filter((_, idx) => idx !== i))}
            className="text-muted hover:text-red-400 pb-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...dates, ""])}
        className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-primary border border-dashed border-dark-lighter hover:border-primary/50 px-4 py-2 w-full justify-center transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add Day
      </button>
    </div>
  );
}

// ── Category picker ───────────────────────────────────────────────────────
const PRESET_CATEGORY_GROUPS = [
  {
    label: "Open",
    options: ["Open Men", "Open Women", "Pro Men", "Pro Women", "Recreational Men", "Recreational Women"],
  },
  {
    label: "Masters",
    options: [
      "Masters Men 35+", "Masters Women 35+",
      "Masters Men 40+", "Masters Women 40+",
      "Masters Men 45+", "Masters Women 45+",
      "Masters Men 50+", "Masters Women 50+",
      "Masters Men 55+", "Masters Women 55+",
      "Masters Men 60+", "Masters Women 60+",
    ],
  },
  {
    label: "Team",
    options: ["Doubles Men", "Doubles Women", "Doubles Mixed", "Mixed Team", "Team of 4", "Team of 5+"],
  },
  {
    label: "Distance",
    options: ["5K", "10K", "Half Marathon (21.1km)", "Marathon (42.2km)", "50K Ultra", "100K Ultra"],
  },
];

const ALL_PRESETS = PRESET_CATEGORY_GROUPS.flatMap((g) => g.options);

function CategoryPicker({ categories, onChange }: { categories: string[]; onChange: (c: string[]) => void }) {
  const [custom, setCustom] = useState("");

  function toggle(cat: string) {
    onChange(categories.includes(cat) ? categories.filter((c) => c !== cat) : [...categories, cat]);
  }

  function addCustom() {
    const trimmed = custom.trim();
    if (trimmed && !categories.includes(trimmed)) onChange([...categories, trimmed]);
    setCustom("");
  }

  const customCategories = categories.filter((c) => !ALL_PRESETS.includes(c));

  return (
    <div className="space-y-4">
      {PRESET_CATEGORY_GROUPS.map((group) => (
        <div key={group.label}>
          <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted/60 block mb-2">
            {group.label}
          </span>
          <div className="flex flex-wrap gap-2">
            {group.options.map((cat) => {
              const selected = categories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggle(cat)}
                  className={`font-headline text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${
                    selected
                      ? "bg-primary text-dark border-primary"
                      : "text-muted border-dark-lighter hover:border-primary/50 hover:text-light"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      ))}


      {/* Custom categories */}
      {customCategories.length > 0 && (
        <div>
          <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted/60 block mb-2">Custom</span>
          <div className="flex flex-wrap gap-2">
            {customCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggle(cat)}
                className="font-headline text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border bg-primary text-dark border-primary flex items-center gap-1.5 transition-colors"
              >
                {cat}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add custom */}
      <div className="flex items-center gap-3 pt-1">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Add a custom category..."
          className="flex-1 bg-transparent text-light font-headline text-sm border-b border-dark-lighter focus:border-primary focus:outline-none pb-2 placeholder:text-muted/30 transition-colors"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim()}
          className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary border border-dark-lighter hover:border-primary/50 px-3 py-2 transition-colors disabled:opacity-30 flex-shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Preview helpers ───────────────────────────────────────────────────────
function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="font-headline text-sm font-black italic tracking-tight text-light">{title}</span>
        <div className="flex-1 h-px bg-dark-lighter" />
      </div>
      {children}
    </div>
  );
}

function EventPreview({ form }: { form: EventFormData }) {
  const dateObj = form.date ? new Date(form.date + "T00:00:00") : null;
  const day = dateObj ? dateObj.getDate().toString() : "—";
  const month = dateObj ? dateObj.toLocaleString("en-AU", { month: "short" }).toUpperCase() : "—";
  const typeLabel = EVENT_TYPE_OPTIONS.find((o) => o.value === form.type)?.label ?? form.type;
  const stateLabel = STATE_OPTIONS.find((o) => o.value === form.state)?.shortLabel ?? form.state.toUpperCase();
  const formatLabel = form.format === "team" ? "Team" : form.format === "both" ? "Individual & Team" : "Individual";

  function fmtTime(t: string) {
    if (!t) return "—";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  const hasCategories = !!(form.categories.length || form.workoutDescription || form.soloAvailable !== undefined || form.partnerAvailable !== undefined || form.teamAvailable !== undefined);
  const hasRegistration = !!(form.ticketDrops.length || form.registrationCloseDate || form.transferPolicy || form.refundPolicy || form.waitlistAvailable !== undefined);
  const hasPricing = !!(form.entryFeeInclusions || form.optionalExtras || form.groupDiscount || form.charityComponent);
  const hasPrizes = !!(form.prizeStructure || form.prizePoolTotal || form.ageGroupCategories || form.ceremonyDate);
  const hasExpo = !!(form.hasExpo !== undefined || form.expoDetails || form.bibCollectionInfo || form.athleteBriefing);
  const hasAdditional = !!(form.participantCap || form.minAge || form.accessibilityInfo || form.parkingInfo || form.bagDropInfo);

  return (
    <div className="h-full overflow-y-auto bg-dark-darker">
      {/* Mini hero */}
      <div className="bg-dark px-6 py-8 border-b border-dark-lighter">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {form.type && (
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-primary text-dark">{typeLabel}</span>
          )}
          {form.isOfficial && (
            <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-primary border border-primary/40 px-2 py-1 rounded-full">Official</span>
          )}
        </div>
        <h1 className="font-headline text-4xl font-black italic tracking-tighter leading-none mb-3 text-light">
          {form.title || <span className="text-muted/40">Event Title</span>}
        </h1>
        <p className="font-headline text-sm font-medium text-muted leading-relaxed max-w-xl">
          {form.description || <span className="opacity-40">Short description will appear here...</span>}
        </p>
        {form.registrationUrl && (
          <div className="mt-4">
            <span className="inline-flex items-center gap-2 bg-primary text-dark font-headline font-black text-sm uppercase tracking-tighter px-5 py-3 rounded-lg">
              Register Now
            </span>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="px-6 py-4 border-b border-dark-lighter">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Date", value: form.date ? `${day} ${month}` : "—" },
            { label: "Start Time", value: form.time ? fmtTime(form.time) : "—" },
            { label: "Location", value: form.city ? `${form.city}${stateLabel ? `, ${stateLabel}` : ""}` : "—" },
            { label: "Format", value: form.format ? formatLabel : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-dark rounded-xl px-4 py-3">
              <span className="font-headline text-[10px] tracking-widest text-muted uppercase block mb-0.5">{label}</span>
              <span className="font-headline text-sm font-black text-light">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="px-6 py-5 space-y-5">

        {/* Overview */}
        <PreviewSection title="01 — Event Overview">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-dark rounded-xl p-5">
              <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 block">About This Event</span>
              <p className="font-headline text-sm font-medium text-muted leading-relaxed">
                {form.fullDescription || form.description || <span className="opacity-40">No description yet</span>}
              </p>
              {form.organizer && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dark-lighter">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted">Organised by</span>
                  <span className="font-headline text-xs font-bold uppercase tracking-widest text-light">{form.organizer}</span>
                </div>
              )}
            </div>
            <div className="bg-dark rounded-xl p-5 border-l-4 border-primary flex flex-col gap-4">
              {form.type && (
                <div>
                  <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Discipline</span>
                  <span className="bg-primary text-dark font-headline text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">{typeLabel}</span>
                </div>
              )}
              {form.level && (
                <div>
                  <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-1 block">Level</span>
                  <span className="font-headline text-xl font-black italic text-light capitalize">{form.level}</span>
                </div>
              )}
              {form.distance && (
                <div>
                  <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-1 block">Distance</span>
                  <span className="font-headline text-xl font-black text-primary">{form.distance}</span>
                </div>
              )}
            </div>
          </div>
        </PreviewSection>

        {/* Date & Time */}
        <PreviewSection title="02 — Date, Time & Location">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-dark rounded-xl p-5">
              <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 block">Date</span>
              {form.date ? (
                <>
                  <div className="font-headline text-4xl font-black text-primary leading-none">{day}</div>
                  <div className="font-headline text-base font-bold uppercase text-light mt-1">{month}</div>
                </>
              ) : <span className="text-muted/40 font-headline text-sm">Not set</span>}
            </div>
            <div className="bg-dark rounded-xl p-5">
              <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 block">Times</span>
              {form.time && <div className="flex justify-between mb-2"><span className="font-headline text-[10px] uppercase tracking-widest text-muted">Start</span><span className="font-headline text-sm font-bold text-light">{fmtTime(form.time)}</span></div>}
              {form.endTime && <div className="flex justify-between mb-2"><span className="font-headline text-[10px] uppercase tracking-widest text-muted">Finish</span><span className="font-headline text-sm font-bold text-light">{fmtTime(form.endTime)}</span></div>}
              {form.cutOffTime && <div className="flex justify-between"><span className="font-headline text-[10px] uppercase tracking-widest text-muted">Cut-off</span><span className="font-headline text-sm font-bold text-light">{fmtTime(form.cutOffTime)}</span></div>}
              {!form.time && <span className="text-muted/40 font-headline text-sm">Not set</span>}
            </div>
            <div className="bg-dark rounded-xl p-5">
              <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 block">Venue</span>
              {form.location ? (
                <>
                  <div className="font-headline text-lg font-black italic text-light leading-tight mb-1">{form.location}</div>
                  {form.streetAddress && <p className="font-headline text-xs text-muted mb-1">{form.streetAddress}</p>}
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted">{form.city}{stateLabel ? `, ${stateLabel}` : ""}</p>
                </>
              ) : <span className="text-muted/40 font-headline text-sm">Not set</span>}
            </div>
          </div>
        </PreviewSection>

        {/* Categories */}
        {hasCategories && (
          <PreviewSection title="03 — Categories & Distances">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-dark rounded-xl p-5">
                {form.categories.length > 0 && (
                  <div className="mb-4">
                    <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 block">Categories</span>
                    <div className="flex flex-wrap gap-2">
                      {form.categories.map((cat) => (
                        <span key={cat} className="font-headline text-xs font-bold uppercase tracking-widest text-dark bg-primary px-3 py-1.5 rounded-full">{cat}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(form.soloAvailable !== undefined || form.partnerAvailable !== undefined || form.teamAvailable !== undefined) && (
                  <div className="space-y-2 pt-3 border-t border-dark-lighter">
                    {([["Solo / Individual", form.soloAvailable], ["Partner / Duo", form.partnerAvailable], ["Team Entry", form.teamAvailable]] as [string, boolean | undefined][])
                      .filter(([, v]) => v !== undefined)
                      .map(([label, v]) => (
                        <div key={label} className="flex items-center gap-2">
                          {v ? <CheckCircle className="w-3.5 h-3.5 text-primary" /> : <XCircle className="w-3.5 h-3.5 text-muted" />}
                          <span className={`font-headline text-xs font-bold uppercase tracking-widest ${v ? "text-primary" : "text-muted"}`}>{label}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              {form.workoutDescription && (
                <div className="bg-dark rounded-xl p-5">
                  <span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-3 block">The Workout</span>
                  <p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.workoutDescription}</p>
                </div>
              )}
            </div>
          </PreviewSection>
        )}

        {/* Registration */}
        {hasRegistration && (
          <PreviewSection title="04 — Registration & Tickets">
            <div className="space-y-3">
              {form.ticketDrops.length > 0 && (
                <div className={`grid gap-3 ${form.ticketDrops.length === 1 ? "grid-cols-1" : form.ticketDrops.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                  {form.ticketDrops.map((drop, i) => (
                    <div key={i} className={`bg-dark rounded-xl p-5 ${i === 0 ? "border-l-4 border-primary" : ""}`}>
                      <span className="font-headline text-xs font-bold uppercase tracking-widest text-muted mb-2 block">{drop.label || "Ticket Tier"}</span>
                      <div className="font-headline text-3xl font-black text-primary leading-none mb-1">{drop.price || "—"}</div>
                      <div className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted">{drop.date}</div>
                    </div>
                  ))}
                </div>
              )}
              {form.registrationCloseDate && (
                <div className="bg-dark rounded-xl px-5 py-3 flex items-center justify-between border-l-4 border-primary">
                  <span className="font-headline text-[10px] tracking-widest text-muted uppercase">Registration Closes</span>
                  <span className="font-headline text-base font-black italic text-light">{form.registrationCloseDate}</span>
                </div>
              )}
              {form.waitlistAvailable !== undefined && (
                <div className="bg-dark rounded-xl p-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${form.waitlistAvailable ? "border-primary/40 bg-primary/10" : "border-dark-lighter"}`}>
                    {form.waitlistAvailable ? <CheckCircle className="w-3.5 h-3.5 text-primary" /> : <XCircle className="w-3.5 h-3.5 text-muted" />}
                    <span className={`font-headline text-xs font-bold uppercase tracking-widest ${form.waitlistAvailable ? "text-primary" : "text-muted"}`}>
                      {form.waitlistAvailable ? "Waitlist Available" : "No Waitlist"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </PreviewSection>
        )}

        {/* Pricing */}
        {hasPricing && (
          <PreviewSection title="05 — Cost & Pricing">
            <div className="grid grid-cols-2 gap-4">
              {form.entryFeeInclusions && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">What&apos;s Included</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.entryFeeInclusions}</p></div>}
              {form.optionalExtras && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Optional Extras</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.optionalExtras}</p></div>}
              {form.groupDiscount && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Group Discount</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.groupDiscount}</p></div>}
              {form.charityComponent && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Charity</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.charityComponent}</p></div>}
            </div>
          </PreviewSection>
        )}

        {/* Prizes */}
        {hasPrizes && (
          <PreviewSection title="06 — Prizes & Awards">
            <div className="grid grid-cols-2 gap-4">
              {form.prizeStructure && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Prize Structure</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.prizeStructure}</p></div>}
              {form.prizePoolTotal && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Prize Pool</span><span className="font-headline text-3xl font-black text-primary">{form.prizePoolTotal}</span></div>}
              {form.ageGroupCategories && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Age Groups</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.ageGroupCategories}</p></div>}
              {(form.ceremonyDate || form.ceremonyLocation) && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Ceremony</span>{form.ceremonyDate && <p className="font-headline text-sm font-bold text-light">{form.ceremonyDate}</p>}{form.ceremonyLocation && <p className="font-headline text-xs text-muted mt-1">{form.ceremonyLocation}</p>}</div>}
            </div>
          </PreviewSection>
        )}

        {/* Expo */}
        {hasExpo && (
          <PreviewSection title="07 — Expo & Race Day">
            <div className="grid grid-cols-2 gap-4">
              {form.expoDetails && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Expo Details</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.expoDetails}</p></div>}
              {form.bibCollectionInfo && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Race Pack Collection</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.bibCollectionInfo}</p></div>}
              {form.athleteBriefing && <div className="bg-dark rounded-xl p-5 col-span-2"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Athlete Briefing</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.athleteBriefing}</p></div>}
            </div>
          </PreviewSection>
        )}

        {/* Additional */}
        {hasAdditional && (
          <PreviewSection title="08 — Additional Information">
            <div className="grid grid-cols-2 gap-4">
              {form.participantCap && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Participant Cap</span><span className="font-headline text-xl font-black text-light">{form.participantCap}</span></div>}
              {form.minAge && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Minimum Age</span><span className="font-headline text-xl font-black text-light">{form.minAge}</span></div>}
              {form.parkingInfo && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widests text-muted uppercase mb-2 block">Parking</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.parkingInfo}</p></div>}
              {form.accessibilityInfo && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Accessibility</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.accessibilityInfo}</p></div>}
              {form.bagDropInfo && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Bag Drop</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.bagDropInfo}</p></div>}
              {form.additionalNotes && <div className="bg-dark rounded-xl p-5"><span className="font-headline text-[10px] tracking-widest text-muted uppercase mb-2 block">Additional Notes</span><p className="font-headline text-sm font-medium text-muted leading-relaxed">{form.additionalNotes}</p></div>}
            </div>
          </PreviewSection>
        )}

      </div>
    </div>
  );
}

// ── Password Gate ─────────────────────────────────────────────────────────
function PasswordGate({ onAuth }: { onAuth: (pw: string) => void }) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onAuth(password);
      } else {
        setError("Incorrect password. Access denied.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 border border-dark-lighter mb-6">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">
            Restricted Access
          </p>
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light">
            Admin Portal
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="bg-dark border border-dark-lighter p-8">
          <FieldLabel>Admin Password</FieldLabel>
          <div className="relative mb-6">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-transparent text-light font-headline text-base border-b border-dark-lighter focus:border-primary focus:outline-none pb-2 placeholder:text-muted/30 pr-8 transition-colors"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-0 bottom-2 text-muted hover:text-light transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && (
            <div className="flex items-center gap-2 mb-4 text-red-400 font-headline text-xs font-medium uppercase tracking-widest">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest py-3.5 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Authenticate
          </button>
        </form>
        <p className="mt-4 text-center font-headline text-[10px] font-medium uppercase tracking-widest text-muted/50">
          This page is not publicly accessible
        </p>
      </div>
    </div>
  );
}

// ── Event Form ────────────────────────────────────────────────────────────
function EventForm({
  initial, onSave, onCancel, isSaving, saveError,
}: {
  initial: EventFormData;
  onSave: (data: EventFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
  saveError: string;
}) {
  const [form, setForm] = useState<EventFormData>(initial);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { setForm(initial); }, [initial]);

  function field<K extends keyof EventFormData>(key: K) {
    return (value: EventFormData[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-lighter flex-shrink-0">
        <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-light">
          {initial.title ? "Edit Event" : "New Event"}
        </h2>
        <div className="flex items-center gap-4">
          {/* Edit / Preview toggle */}
          <div className="flex items-center border border-dark-lighter rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className={`font-headline text-[10px] font-bold uppercase tracking-widest px-4 py-2 transition-colors ${!showPreview ? "bg-primary text-dark" : "text-muted hover:text-light"}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className={`font-headline text-[10px] font-bold uppercase tracking-widest px-4 py-2 transition-colors ${showPreview ? "bg-primary text-dark" : "text-muted hover:text-light"}`}
            >
              Preview
            </button>
          </div>
          <button type="button" onClick={onCancel} className="text-muted hover:text-light transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Preview mode */}
      {showPreview && (
        <div className="flex-1 overflow-hidden">
          <EventPreview form={form} />
        </div>
      )}

      {/* Scrollable fields — hidden when previewing */}
      <div className={`flex-1 overflow-y-auto px-6 py-6 space-y-8 ${showPreview ? "hidden" : ""}`}>

        {/* 01 Basic Info */}
        <FormSection icon={Info} title="01 — Basic Info">
          <div className="space-y-5">
            <div>
              <FieldLabel required>Title</FieldLabel>
              <TextInput value={form.title} onChange={field("title")} placeholder="e.g. HYROX Sydney" required />
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <FieldLabel required>Type</FieldLabel>
                <SelectInput
                  value={form.type}
                  onChange={field("type")}
                  options={EVENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  required
                />
              </div>
              <div>
                <FieldLabel required>Level</FieldLabel>
                <SelectInput
                  value={form.level}
                  onChange={field("level")}
                  options={[
                    { value: "open", label: "Open" },
                    { value: "beginner", label: "Beginner" },
                    { value: "elite", label: "Elite" },
                  ]}
                  required
                />
              </div>
              <div>
                <FieldLabel required>Format</FieldLabel>
                <SelectInput
                  value={form.format}
                  onChange={field("format")}
                  options={[
                    { value: "individual", label: "Individual" },
                    { value: "team", label: "Team / Pairs" },
                    { value: "both", label: "Both" },
                  ]}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Distance</FieldLabel>
                <TextInput value={form.distance} onChange={field("distance")} placeholder="e.g. 42.2km" />
              </div>
              <div>
                <FieldLabel>Organiser</FieldLabel>
                <TextInput value={form.organizer} onChange={field("organizer")} placeholder="e.g. HYROX Australia" />
              </div>
            </div>
            <div>
              <FieldLabel required>Short Description</FieldLabel>
              <TextArea
                value={form.description}
                onChange={field("description")}
                placeholder="Brief summary shown on event cards and hero..."
                rows={3}
                required
              />
            </div>
            <div>
              <FieldLabel>Full Description</FieldLabel>
              <TextArea
                value={form.fullDescription}
                onChange={field("fullDescription")}
                placeholder="Full details shown in the event overview section..."
                rows={5}
              />
            </div>
            <div>
              <FieldLabel required>Registration URL</FieldLabel>
              <TextInput value={form.registrationUrl} onChange={field("registrationUrl")} placeholder="https://" type="url" required />
            </div>
            <div className="flex items-center gap-8">
              <CheckboxField checked={form.isOfficial} onChange={field("isOfficial")} label="Official / Sanctioned Event" />
            </div>
          </div>
        </FormSection>

        <div className="border-t border-dark-lighter" />

        {/* 02 Date & Time */}
        <FormSection icon={Calendar} title="02 — Date & Time">
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <div>
                <FieldLabel required>Date</FieldLabel>
                <TextInput value={form.date} onChange={field("date")} type="date" required />
              </div>
              <div>
                <FieldLabel required>Start Time</FieldLabel>
                <TextInput value={form.time} onChange={field("time")} type="time" required />
              </div>
              <div>
                <FieldLabel>End Time</FieldLabel>
                <TextInput value={form.endTime} onChange={field("endTime")} type="time" />
              </div>
              <div>
                <FieldLabel>Cut-off Time</FieldLabel>
                <TextInput value={form.cutOffTime} onChange={field("cutOffTime")} type="time" />
              </div>
            </div>
            <div>
              <FieldLabel>Multi-Day Dates (leave empty for single-day events)</FieldLabel>
              <DatesEditor dates={form.dates} onChange={field("dates")} />
            </div>
          </div>
        </FormSection>

        <div className="border-t border-dark-lighter" />

        {/* 03 Location */}
        <FormSection icon={MapPin} title="03 — Location">
          <div className="space-y-5">
            <div>
              <FieldLabel required>Venue / Location Name</FieldLabel>
              <TextInput value={form.location} onChange={field("location")} placeholder="e.g. Sydney Olympic Park" required />
            </div>
            <div>
              <FieldLabel>Street Address</FieldLabel>
              <TextInput value={form.streetAddress} onChange={field("streetAddress")} placeholder="e.g. 1 Olympic Blvd" />
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <FieldLabel required>City</FieldLabel>
                <TextInput value={form.city} onChange={field("city")} placeholder="e.g. Sydney" required />
              </div>
              <div>
                <FieldLabel required>State</FieldLabel>
                <SelectInput
                  value={form.state}
                  onChange={field("state")}
                  options={STATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  required
                />
              </div>
              <div>
                <FieldLabel>Country</FieldLabel>
                <TextInput value={form.country} onChange={field("country")} placeholder="e.g. Australia" />
              </div>
            </div>
            <div>
              <FieldLabel>Course Map URL</FieldLabel>
              <TextInput value={form.courseMapUrl} onChange={field("courseMapUrl")} placeholder="https://" type="url" />
            </div>
          </div>
        </FormSection>

        <div className="border-t border-dark-lighter" />

        {/* 04 Categories & Distances */}
        <FormSection icon={Tag} title="04 — Categories & Distances">
          <div className="space-y-5">
            <div>
              <FieldLabel>Categories</FieldLabel>
              <CategoryPicker categories={form.categories} onChange={field("categories")} />
            </div>
            <div>
              <FieldLabel>Workout / Course Description</FieldLabel>
              <TextArea
                value={form.workoutDescription}
                onChange={field("workoutDescription")}
                placeholder="Describe the workout, course layout, or key stations..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <FieldLabel>Solo / Individual Available</FieldLabel>
                <TriStateSelect value={form.soloAvailable} onChange={field("soloAvailable")} />
              </div>
              <div>
                <FieldLabel>Partner / Duo Available</FieldLabel>
                <TriStateSelect value={form.partnerAvailable} onChange={field("partnerAvailable")} />
              </div>
              <div>
                <FieldLabel>Team Entry Available</FieldLabel>
                <TriStateSelect value={form.teamAvailable} onChange={field("teamAvailable")} />
              </div>
            </div>
          </div>
        </FormSection>

        <div className="border-t border-dark-lighter" />

        {/* 05 Registration & Tickets */}
        <FormSection icon={Ticket} title="05 — Registration & Tickets">
          <div className="space-y-5">
            <div>
              <FieldLabel>Ticket Tiers / Pricing Drops</FieldLabel>
              <TicketDropsEditor drops={form.ticketDrops} onChange={field("ticketDrops")} />
            </div>
            <div>
              <FieldLabel>Registration Close Date</FieldLabel>
              <TextInput value={form.registrationCloseDate} onChange={field("registrationCloseDate")} placeholder="e.g. 15 February 2025" />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Transfer Policy</FieldLabel>
                <TextArea value={form.transferPolicy} onChange={field("transferPolicy")} placeholder="e.g. Transfers allowed up to 30 days before event..." rows={3} />
              </div>
              <div>
                <FieldLabel>Refund Policy</FieldLabel>
                <TextArea value={form.refundPolicy} onChange={field("refundPolicy")} placeholder="e.g. No refunds after registration closes..." rows={3} />
              </div>
            </div>
            <div>
              <FieldLabel>Waitlist Available</FieldLabel>
              <TriStateSelect value={form.waitlistAvailable} onChange={field("waitlistAvailable")} />
            </div>
          </div>
        </FormSection>

        <div className="border-t border-dark-lighter" />

        {/* 06 Cost & Pricing */}
        <FormSection icon={Package} title="06 — Cost & Pricing">
          <div className="space-y-5">
            <div>
              <FieldLabel>What&apos;s Included in Entry Fee</FieldLabel>
              <TextArea value={form.entryFeeInclusions} onChange={field("entryFeeInclusions")} placeholder="e.g. Finisher medal, timing chip, event t-shirt..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Optional Extras</FieldLabel>
                <TextArea value={form.optionalExtras} onChange={field("optionalExtras")} placeholder="e.g. Spectator tickets, extra merch..." rows={3} />
              </div>
              <div>
                <FieldLabel>Group / Club Discount</FieldLabel>
                <TextArea value={form.groupDiscount} onChange={field("groupDiscount")} placeholder="e.g. 10% off for groups of 5 or more..." rows={3} />
              </div>
            </div>
            <div>
              <FieldLabel>Charity Component</FieldLabel>
              <TextArea value={form.charityComponent} onChange={field("charityComponent")} placeholder="e.g. $5 from every registration donated to..." rows={2} />
            </div>
          </div>
        </FormSection>

        <div className="border-t border-dark-lighter" />

        {/* 07 Prizes & Awards */}
        <FormSection icon={Trophy} title="07 — Prizes & Awards">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Prize Structure</FieldLabel>
                <TextArea value={form.prizeStructure} onChange={field("prizeStructure")} placeholder="e.g. Cash prizes for top 3 in each category..." rows={3} />
              </div>
              <div>
                <FieldLabel>Total Prize Pool</FieldLabel>
                <TextInput value={form.prizePoolTotal} onChange={field("prizePoolTotal")} placeholder="e.g. $10,000" />
              </div>
            </div>
            <div>
              <FieldLabel>Age Group Categories</FieldLabel>
              <TextArea value={form.ageGroupCategories} onChange={field("ageGroupCategories")} placeholder="e.g. Masters 40-49, Masters 50-59, Masters 60+..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Awards Ceremony Date</FieldLabel>
                <TextInput value={form.ceremonyDate} onChange={field("ceremonyDate")} placeholder="e.g. Same day, 4:00pm" />
              </div>
              <div>
                <FieldLabel>Ceremony Location</FieldLabel>
                <TextInput value={form.ceremonyLocation} onChange={field("ceremonyLocation")} placeholder="e.g. Main stage, finish area" />
              </div>
            </div>
            <div>
              <FieldLabel>Special Awards</FieldLabel>
              <TextArea value={form.specialAwards} onChange={field("specialAwards")} placeholder="e.g. Spirit of the event, fastest transition..." rows={2} />
            </div>
          </div>
        </FormSection>

        <div className="border-t border-dark-lighter" />

        {/* 08 Expo & Race Day */}
        <FormSection icon={Camera} title="08 — Expo & Race Day">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Event Expo</FieldLabel>
                <TriStateSelect value={form.hasExpo} onChange={field("hasExpo")} />
              </div>
              <div>
                <FieldLabel>Vendor / Stall Opportunities</FieldLabel>
                <TriStateSelect value={form.vendorOpportunities} onChange={field("vendorOpportunities")} />
              </div>
            </div>
            <div>
              <FieldLabel>Expo Details</FieldLabel>
              <TextArea value={form.expoDetails} onChange={field("expoDetails")} placeholder="e.g. Expo open Friday 3–7pm and Saturday 7–9am..." rows={3} />
            </div>
            <div>
              <FieldLabel>Bib / Race Pack Collection</FieldLabel>
              <TextArea value={form.bibCollectionInfo} onChange={field("bibCollectionInfo")} placeholder="e.g. Collect race pack at expo Friday or on race morning from 6am..." rows={3} />
            </div>
            <div>
              <FieldLabel>Athlete Briefing</FieldLabel>
              <TextArea value={form.athleteBriefing} onChange={field("athleteBriefing")} placeholder="e.g. Mandatory briefing Saturday 7:30am at start line..." rows={3} />
            </div>
          </div>
        </FormSection>

        <div className="border-t border-dark-lighter" />

        {/* 09 Additional Info */}
        <FormSection icon={Info} title="09 — Additional Information">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Participant Cap</FieldLabel>
                <TextInput value={form.participantCap} onChange={field("participantCap")} placeholder="e.g. 2,000 athletes" />
              </div>
              <div>
                <FieldLabel>Minimum Age</FieldLabel>
                <TextInput value={form.minAge} onChange={field("minAge")} placeholder="e.g. 16 years" />
              </div>
            </div>
            <div>
              <FieldLabel>Accessibility Information</FieldLabel>
              <TextArea value={form.accessibilityInfo} onChange={field("accessibilityInfo")} placeholder="e.g. Wheelchair accessible venue, companion athlete program..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Parking Information</FieldLabel>
                <TextArea value={form.parkingInfo} onChange={field("parkingInfo")} placeholder="e.g. Paid parking at P3, $15/day..." rows={2} />
              </div>
              <div>
                <FieldLabel>Bag Drop</FieldLabel>
                <TextArea value={form.bagDropInfo} onChange={field("bagDropInfo")} placeholder="e.g. Complimentary bag drop available near start..." rows={2} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Results Provider</FieldLabel>
                <TextInput value={form.resultsProvider} onChange={field("resultsProvider")} placeholder="e.g. Webscorer, Race Roster..." />
              </div>
              <div>
                <FieldLabel>Results Link</FieldLabel>
                <TextInput value={form.resultsLink} onChange={field("resultsLink")} placeholder="https://" type="url" />
              </div>
            </div>
            <div>
              <FieldLabel>Additional Notes</FieldLabel>
              <TextArea value={form.additionalNotes} onChange={field("additionalNotes")} placeholder="Anything else organisers or athletes should know..." rows={3} />
            </div>
          </div>
        </FormSection>

      </div>

      {/* Footer — hidden in preview */}
      <div className={`flex-shrink-0 border-t border-dark-lighter px-6 py-4 ${showPreview ? "hidden" : ""}`}>
        {saveError && (
          <div className="flex items-center gap-2 mb-3 text-red-400 font-headline text-xs font-medium uppercase tracking-widest">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {saveError}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Saving..." : "Save Event"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-light border border-dark-lighter px-5 py-3 hover:border-primary/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Pending approval panel ────────────────────────────────────────────────
interface PendingEvent extends FitnessEvent {
  status?: string;
  organiser_sub?: string | null;
}

function PendingApprovalPanel({ password }: { password: string }) {
  const [pending, setPending] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events/pending", {
        headers: { Authorization: `Bearer ${password}` },
      });
      const data = await res.json();
      setPending(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => { loadPending(); }, [loadPending]);

  async function handleAction(id: string, status: "approved" | "rejected") {
    await fetch(`/api/admin/events/${id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${password}`,
      },
      body: JSON.stringify({ status }),
    });
    await loadPending();
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-muted animate-spin" />
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
          No pending events
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {pending.map((event) => (
        <div key={event.id} className="bg-dark rounded-xl p-5 border-l-4 border-yellow-400">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <span className="font-headline text-[10px] font-bold uppercase tracking-widest bg-yellow-400 text-dark px-2 py-0.5 rounded-full">
                Pending
              </span>
              <h3 className="font-headline text-sm font-black italic tracking-tighter text-light mt-1">
                {event.title}
              </h3>
              <p className="font-headline text-[10px] text-muted mt-0.5">
                {event.city}, {event.state.toUpperCase()} &middot; {event.date}
              </p>
            </div>
          </div>
          <p className="text-muted text-xs mb-3 line-clamp-2">{event.description}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction(event.id, "approved")}
              className="flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-2 rounded-lg hover:bg-primary/80 transition-colors"
            >
              <CheckCircle className="w-3 h-3" /> Approve
            </button>
            <button
              onClick={() => handleAction(event.id, "rejected")}
              className="flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-red-400 border border-red-400/50 px-3 py-2 rounded-lg hover:bg-red-400/10 transition-colors"
            >
              <XCircle className="w-3 h-3" /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main admin dashboard ──────────────────────────────────────────────────
function AdminDashboard({ password }: { password: string }) {
  const [events, setEvents] = useState<FitnessEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [formData, setFormData] = useState<EventFormData>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showPending, setShowPending] = useState(false);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      showToast("Failed to load events.", "error");
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  function openNewForm() {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setSaveError("");
  }

  function openEditForm(event: FitnessEvent) {
    setFormData({
      title: event.title,
      description: event.description,
      fullDescription: event.fullDescription ?? "",
      date: event.date,
      time: event.time,
      endTime: event.endTime ?? "",
      cutOffTime: event.cutOffTime ?? "",
      dates: event.dates ?? [],
      location: event.location,
      streetAddress: event.streetAddress ?? "",
      city: event.city,
      state: event.state,
      country: event.country ?? "",
      courseMapUrl: event.courseMapUrl ?? "",
      type: event.type,
      format: event.format,
      level: event.level,
      image: event.image ?? "",
      registrationUrl: event.registrationUrl,
      registrationCloseDate: event.registrationCloseDate ?? "",
      organizer: event.organizer ?? "",
      distance: event.distance ?? "",
      isOfficial: event.isOfficial ?? false,
      categories: event.categories ?? [],
      workoutDescription: event.workoutDescription ?? "",
      soloAvailable: event.soloAvailable,
      partnerAvailable: event.partnerAvailable,
      teamAvailable: event.teamAvailable,
      ticketDrops: event.ticketDrops ?? [],
      transferPolicy: event.transferPolicy ?? "",
      refundPolicy: event.refundPolicy ?? "",
      waitlistAvailable: event.waitlistAvailable,
      entryFeeInclusions: event.entryFeeInclusions ?? "",
      optionalExtras: event.optionalExtras ?? "",
      groupDiscount: event.groupDiscount ?? "",
      charityComponent: event.charityComponent ?? "",
      prizeStructure: event.prizeStructure ?? "",
      prizePoolTotal: event.prizePoolTotal ?? "",
      ageGroupCategories: event.ageGroupCategories ?? "",
      ceremonyDate: event.ceremonyDate ?? "",
      ceremonyLocation: event.ceremonyLocation ?? "",
      specialAwards: event.specialAwards ?? "",
      hasExpo: event.hasExpo,
      expoDetails: event.expoDetails ?? "",
      vendorOpportunities: event.vendorOpportunities,
      bibCollectionInfo: event.bibCollectionInfo ?? "",
      athleteBriefing: event.athleteBriefing ?? "",
      participantCap: event.participantCap ?? "",
      minAge: event.minAge ?? "",
      accessibilityInfo: event.accessibilityInfo ?? "",
      parkingInfo: event.parkingInfo ?? "",
      bagDropInfo: event.bagDropInfo ?? "",
      resultsProvider: event.resultsProvider ?? "",
      resultsLink: event.resultsLink ?? "",
      additionalNotes: event.additionalNotes ?? "",
    });
    setEditingId(event.id);
    setShowForm(true);
    setSaveError("");
  }

  async function handleSave(data: EventFormData) {
    setIsSaving(true);
    setSaveError("");

    const payload: Partial<FitnessEvent> = {
      title: data.title,
      description: data.description,
      fullDescription: data.fullDescription || undefined,
      date: data.date,
      time: data.time,
      endTime: data.endTime || undefined,
      cutOffTime: data.cutOffTime || undefined,
      dates: data.dates.length > 0 ? data.dates : undefined,
      location: data.location,
      streetAddress: data.streetAddress || undefined,
      city: data.city,
      state: data.state as AustralianState,
      country: data.country || undefined,
      courseMapUrl: data.courseMapUrl || undefined,
      type: data.type as EventType,
      format: data.format as CompetitionFormat,
      level: data.level as ExperienceLevel,
      image: data.image || "",
      registrationUrl: data.registrationUrl,
      registrationCloseDate: data.registrationCloseDate || undefined,
      organizer: data.organizer || undefined,
      distance: data.distance || undefined,
      isOfficial: data.isOfficial,
      categories: data.categories.length > 0 ? data.categories : undefined,
      workoutDescription: data.workoutDescription || undefined,
      soloAvailable: data.soloAvailable,
      partnerAvailable: data.partnerAvailable,
      teamAvailable: data.teamAvailable,
      ticketDrops: data.ticketDrops.length > 0 ? data.ticketDrops : undefined,
      transferPolicy: data.transferPolicy || undefined,
      refundPolicy: data.refundPolicy || undefined,
      waitlistAvailable: data.waitlistAvailable,
      entryFeeInclusions: data.entryFeeInclusions || undefined,
      optionalExtras: data.optionalExtras || undefined,
      groupDiscount: data.groupDiscount || undefined,
      charityComponent: data.charityComponent || undefined,
      prizeStructure: data.prizeStructure || undefined,
      prizePoolTotal: data.prizePoolTotal || undefined,
      ageGroupCategories: data.ageGroupCategories || undefined,
      ceremonyDate: data.ceremonyDate || undefined,
      ceremonyLocation: data.ceremonyLocation || undefined,
      specialAwards: data.specialAwards || undefined,
      hasExpo: data.hasExpo,
      expoDetails: data.expoDetails || undefined,
      vendorOpportunities: data.vendorOpportunities,
      bibCollectionInfo: data.bibCollectionInfo || undefined,
      athleteBriefing: data.athleteBriefing || undefined,
      participantCap: data.participantCap || undefined,
      minAge: data.minAge || undefined,
      accessibilityInfo: data.accessibilityInfo || undefined,
      parkingInfo: data.parkingInfo || undefined,
      bagDropInfo: data.bagDropInfo || undefined,
      resultsProvider: data.resultsProvider || undefined,
      resultsLink: data.resultsLink || undefined,
      additionalNotes: data.additionalNotes || undefined,
    };

    try {
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/events/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error ?? "Save failed.");
        return;
      }

      showToast(editingId ? "Event updated." : "Event created.");
      setShowForm(false);
      await loadEvents();
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${password}` },
      });
      if (res.ok) {
        showToast("Event deleted.");
        setDeleteConfirm(null);
        if (editingId === id) setShowForm(false);
        await loadEvents();
      } else {
        showToast("Delete failed.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  }

  async function handleSeed() {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { Authorization: `Bearer ${password}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message ?? "Seeded successfully.");
        await loadEvents();
      } else {
        showToast(data.error ?? "Seed failed.", "error");
      }
    } catch {
      showToast("Seed failed.", "error");
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <div className="bg-dark-darker flex flex-col" style={{ height: "100dvh" }}>
      {/* Top bar */}
      <div className="flex-shrink-0 bg-dark border-b border-dark-lighter flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-4">
          <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">StartLine</span>
          <span className="text-dark-lighter">/</span>
          <span className="font-headline text-xs font-medium uppercase tracking-widest text-primary">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPending(!showPending)}
            className={`flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest border px-4 py-2 transition-colors ${
              showPending
                ? "text-yellow-400 border-yellow-400/50 bg-yellow-400/10"
                : "text-muted hover:text-light border-dark-lighter hover:border-primary/50"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Pending
          </button>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            title="Seed events.json into Supabase"
            className="flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-light border border-dark-lighter px-4 py-2 hover:border-primary/50 transition-colors disabled:opacity-40"
          >
            {isSeeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            Seed DB
          </button>
          <button
            onClick={loadEvents}
            className="flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-light border border-dark-lighter px-4 py-2 hover:border-primary/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={openNewForm}
            className="flex items-center gap-2 bg-machined text-dark font-headline text-xs font-bold uppercase tracking-widest px-5 py-2 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Event
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Event list */}
        <div className="w-[360px] flex-shrink-0 border-r border-dark-lighter overflow-y-auto bg-dark-darker">
          {showPending && (
            <div className="border-b border-dark-lighter">
              <div className="px-5 py-3 border-b border-dark-lighter bg-yellow-400/5">
                <span className="font-headline text-xs font-medium uppercase tracking-widest text-yellow-400">
                  Pending Approval
                </span>
              </div>
              <PendingApprovalPanel password={password} />
            </div>
          )}
          <div className="px-5 py-3 border-b border-dark-lighter">
            <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
              {loadingEvents ? "Loading…" : `${events.length} Event${events.length !== 1 ? "s" : ""}`}
            </span>
          </div>
          {loadingEvents ? (
            <div className="p-8 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-muted animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">No events found</p>
              <p className="text-xs text-muted">Click &quot;Seed DB&quot; to import existing events, or add one manually.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 bg-dark-darker">
              {events.map((event) => {
                const isEditing = editingId === event.id;
                return (
                  <div
                    key={event.id}
                    className={`p-4 border-l-4 transition-colors ${
                      isEditing ? "bg-dark-light border-primary" : "bg-dark border-transparent hover:bg-dark-light"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-dark bg-primary px-2 py-0.5 flex-shrink-0">
                        {event.type}
                      </span>
                      <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted flex-shrink-0">
                        {formatMediumDate(event.date)}
                      </span>
                    </div>
                    <h3 className={`font-headline text-sm font-black italic tracking-tighter leading-tight mb-1 ${isEditing ? "text-primary" : "text-light"}`}>
                      {event.title}
                    </h3>
                    <p className="font-headline text-[10px] text-muted mb-3 truncate">{event.city}, {event.state.toUpperCase()}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditForm(event)}
                        className="flex items-center gap-1.5 font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-primary border border-dark-lighter hover:border-primary px-3 py-1.5 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      {deleteConfirm === event.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="font-headline text-[10px] font-medium uppercase tracking-widest bg-red-600 text-white px-3 py-1.5 hover:bg-red-500 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-light px-2 py-1.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(event.id)}
                          className="flex items-center gap-1.5 font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-red-400 border border-dark-lighter hover:border-red-400/50 px-3 py-1.5 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Form or empty state */}
        <div className="flex-1 overflow-hidden bg-dark-darker">
          {showForm ? (
            <EventForm
              initial={formData}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingId(null); }}
              isSaving={isSaving}
              saveError={saveError}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-12">
              <div className="w-12 h-12 border border-dark-lighter flex items-center justify-center mb-2">
                <Plus className="w-5 h-5 text-muted" />
              </div>
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                Select an event to edit, or
              </p>
              <button
                onClick={openNewForm}
                className="flex items-center gap-2 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
              >
                <Plus className="w-4 h-4" /> Add New Event
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 font-headline text-sm font-medium uppercase tracking-widest shadow-xl ${
          toast.type === "success" ? "bg-primary text-dark" : "bg-red-600 text-white"
        }`}>
          {toast.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────
export default function AdminPage() {
  const [password, setPassword] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_token");
    if (stored) setPassword(stored);
  }, []);

  function handleAuth(pw: string) {
    sessionStorage.setItem("admin_token", pw);
    setPassword(pw);
  }

  if (!password) return <PasswordGate onAuth={handleAuth} />;
  return <AdminDashboard password={password} />;
}
