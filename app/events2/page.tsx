"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, ChevronDown, MapPin, Clock, Users, Calendar,
  ExternalLink, ArrowRight, X,
} from "lucide-react";
import eventsData from "@/data/events.json";
import {
  FitnessEvent, FilterState, EventType, AustralianState,
  CompetitionFormat, EVENT_TYPE_LABELS, STATE_LABELS,
  STATE_OPTIONS, EVENT_TYPE_OPTIONS, FORMAT_OPTIONS, DATE_RANGE_OPTIONS,
} from "@/types";
import {
  filterEvents, sortEventsByDate,
  formatMediumDate, formatShortDate, formatTime, formatEventDate,
} from "@/lib/utils";

// ── Image pool (same as event cards) ────────────────────────────────────────
const TYPE_IMAGES: Record<string, string[]> = {
  hyrox: [
    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=1200&q=80",
    "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=1200&q=80",
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1200&q=80",
  ],
  crossfit: [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80",
    "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=1200&q=80",
  ],
  running: [
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200&q=80",
    "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1200&q=80",
    "https://images.unsplash.com/photo-1544717305-2782549b5136?w=1200&q=80",
  ],
  hybrid: [
    "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80",
    "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1200&q=80",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1200&q=80",
  ],
};

function getBannerImage(type: string, id: string): string {
  const pool = TYPE_IMAGES[type] ?? TYPE_IMAGES.running;
  return pool[id.charCodeAt(id.length - 1) % pool.length];
}

// ── Status helper ─────────────────────────────────────────────────────────
function getStatus(event: FitnessEvent): { label: string; style: string } {
  const daysUntil = Math.ceil(
    (new Date(event.date).getTime() - Date.now()) / 86400000
  );
  if (daysUntil < 0) return { label: "Registration Closed", style: "border border-dark-lighter text-muted" };
  if (daysUntil <= 14) return { label: "Selling Fast", style: "bg-primary text-dark" };
  return { label: "Confirmed", style: "border border-primary text-primary" };
}

// ── Reusable filter chip dropdown ─────────────────────────────────────────
interface ChipProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (v: string) => void;
}

function FilterChip({ label, value, options, isOpen, onOpen, onClose, onChange }: ChipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== "";

  useEffect(() => {
    if (!isOpen) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen, onClose]);

  const currentLabel = options.find((o) => o.value === value)?.label ?? label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={isOpen ? onClose : onOpen}
        className={`flex items-center gap-2 px-4 py-2 font-headline text-sm font-medium uppercase tracking-widest border transition-colors duration-100 ${
          active
            ? "border-primary text-primary bg-primary/5"
            : "border-dark-lighter text-muted bg-dark hover:border-primary/50 hover:text-light"
        }`}
      >
        {currentLabel}
        {active && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(""); onClose(); }}
            className="ml-1 text-primary hover:text-light"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-dark border border-dark-lighter min-w-[200px] shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); onClose(); }}
              className={`w-full text-left px-4 py-3 font-headline text-sm font-medium uppercase tracking-widest transition-colors ${
                value === opt.value
                  ? "bg-primary text-dark"
                  : "text-muted hover:bg-dark-light hover:text-light"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Events2Page() {
  const allEvents = useMemo(() => eventsData.events as FitnessEvent[], []);

  // Search bar state
  const [whatQuery, setWhatQuery] = useState("");
  const [whereQuery, setWhereQuery] = useState("");

  // Filter chip state
  const [typeFilter, setTypeFilter] = useState<EventType | "">("");
  const [stateFilter, setStateFilter] = useState<AustralianState | "">("");
  const [formatFilter, setFormatFilter] = useState<CompetitionFormat | "">("");
  const [dateFilter, setDateFilter] = useState<FilterState["dateRange"]>("all");

  // UI state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Build FilterState for reuse of existing utils
  const filterState: FilterState = useMemo(() => ({
    types: typeFilter ? [typeFilter as EventType] : [],
    states: stateFilter ? [stateFilter as AustralianState] : [],
    format: formatFilter ? (formatFilter as CompetitionFormat) : null,
    dateRange: dateFilter,
    searchQuery: whatQuery,
  }), [typeFilter, stateFilter, formatFilter, dateFilter, whatQuery]);

  // Apply filters then where query
  const displayEvents = useMemo(() => {
    let results = filterEvents(allEvents, filterState);
    results = sortEventsByDate(results);
    if (whereQuery.trim()) {
      const q = whereQuery.toLowerCase();
      results = results.filter(
        (e) =>
          e.city.toLowerCase().includes(q) ||
          e.state.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q)
      );
    }
    return results;
  }, [allEvents, filterState, whereQuery]);

  const selectedEvent = useMemo(
    () => allEvents.find((e) => e.id === selectedId) ?? null,
    [allEvents, selectedId]
  );

  // Auto-select first event when list changes and nothing is selected
  useEffect(() => {
    if (!selectedId && displayEvents.length > 0) {
      setSelectedId(displayEvents[0].id);
    }
  }, [displayEvents, selectedId]);

  // Chip option lists
  const disciplineOptions = [
    { value: "", label: "Discipline" },
    ...EVENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const stateOptions = [
    { value: "", label: "State" },
    ...STATE_OPTIONS.map((o) => ({ value: o.value, label: o.shortLabel })),
  ];
  const formatOptions = [
    { value: "", label: "Format" },
    ...FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const dateOptions = [
    { value: "all", label: "All Upcoming" },
    ...DATE_RANGE_OPTIONS.filter((o) => o.value !== "all").map((o) => ({
      value: o.value,
      label: o.label,
    })),
  ];

  const [day, month] = selectedEvent
    ? formatShortDate(selectedEvent.date).split(" ")
    : ["", ""];
  const status = selectedEvent ? getStatus(selectedEvent) : null;
  const bannerUrl = selectedEvent
    ? getBannerImage(selectedEvent.type, selectedEvent.id)
    : "";

  return (
    <div className="bg-dark-darker flex flex-col" style={{ height: "100dvh" }}>

      {/* ── Sticky search + filter bar ── */}
      <div className="sticky top-0 z-40 bg-dark border-b border-dark-lighter flex-shrink-0 pt-16">
        {/* Row 1: What / Where / Search */}
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-stretch border-b border-dark-lighter gap-0.5 bg-dark-darker">
          {/* WHAT */}
          <div className="flex-1 bg-dark px-5 py-3 border-r border-dark-lighter min-w-0">
            <label className="font-headline text-xs font-medium uppercase tracking-widest text-muted block mb-1">
              What
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Event name, type or keyword"
                value={whatQuery}
                onChange={(e) => setWhatQuery(e.target.value)}
                className="w-full bg-transparent text-light font-headline text-base placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none"
              />
              {whatQuery && (
                <button onClick={() => setWhatQuery("")} className="text-muted hover:text-light flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* WHERE */}
          <div className="flex-1 bg-dark px-5 py-3 border-r border-dark-lighter min-w-0">
            <label className="font-headline text-xs font-medium uppercase tracking-widest text-muted block mb-1">
              Where
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="State, city, or suburb"
                value={whereQuery}
                onChange={(e) => setWhereQuery(e.target.value)}
                className="w-full bg-transparent text-light font-headline text-base placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none"
              />
              {whereQuery && (
                <button onClick={() => setWhereQuery("")} className="text-muted hover:text-light flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* SEARCH */}
          <button className="flex items-center gap-2 bg-machined text-dark font-headline text-base font-bold uppercase tracking-widest px-10 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 flex-shrink-0">
            <Search className="w-5 h-5" />
            Search
          </button>
        </div>

        {/* Row 2: Filter chips */}
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center gap-2.5 flex-wrap">
          <FilterChip
            label="Discipline"
            value={typeFilter}
            options={disciplineOptions}
            isOpen={openDropdown === "discipline"}
            onOpen={() => setOpenDropdown("discipline")}
            onClose={() => setOpenDropdown(null)}
            onChange={(v) => { setTypeFilter(v as EventType | ""); setSelectedId(null); }}
          />
          <FilterChip
            label="State"
            value={stateFilter}
            options={stateOptions}
            isOpen={openDropdown === "state"}
            onOpen={() => setOpenDropdown("state")}
            onClose={() => setOpenDropdown(null)}
            onChange={(v) => { setStateFilter(v as AustralianState | ""); setSelectedId(null); }}
          />
          <FilterChip
            label="Format"
            value={formatFilter}
            options={formatOptions}
            isOpen={openDropdown === "format"}
            onOpen={() => setOpenDropdown("format")}
            onClose={() => setOpenDropdown(null)}
            onChange={(v) => { setFormatFilter(v as CompetitionFormat | ""); setSelectedId(null); }}
          />
          <FilterChip
            label="All Upcoming"
            value={dateFilter === "all" ? "" : dateFilter}
            options={dateOptions.map((o) => ({ ...o, value: o.value === "all" ? "" : o.value }))}
            isOpen={openDropdown === "date"}
            onOpen={() => setOpenDropdown("date")}
            onClose={() => setOpenDropdown(null)}
            onChange={(v) => { setDateFilter((v || "all") as FilterState["dateRange"]); setSelectedId(null); }}
          />

          {/* Results count */}
          <span className="ml-auto font-headline text-base font-medium uppercase tracking-widest text-muted">
            {displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Two-panel content area ── */}
      <div className="flex flex-1 overflow-hidden max-w-[1440px] w-full mx-auto">

        {/* ── LEFT: event list ── */}
        <div className="w-[500px] flex-shrink-0 overflow-y-auto border-r border-dark-lighter bg-dark-darker">
          {displayEvents.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted mb-3">No Results</p>
              <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-4">No events found.</p>
              <button
                onClick={() => {
                  setWhatQuery(""); setWhereQuery("");
                  setTypeFilter(""); setStateFilter(""); setFormatFilter(""); setDateFilter("all");
                  setSelectedId(null);
                }}
                className="font-headline text-sm font-medium uppercase tracking-widest border border-primary text-primary px-5 py-2.5 hover:bg-primary hover:text-dark transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 bg-dark-darker">
              {displayEvents.map((event) => {
                const isSelected = event.id === selectedId;
                const [eDay, eMonth] = formatShortDate(event.date).split(" ");
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedId(event.id)}
                    className={`w-full text-left p-6 transition-colors duration-100 border-l-4 ${
                      isSelected
                        ? "bg-dark-light border-primary"
                        : "bg-dark border-transparent hover:bg-dark-light hover:border-primary/40"
                    }`}
                  >
                    {/* Top row: type badge + date */}
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-headline text-sm font-medium uppercase tracking-widest text-dark bg-primary px-2.5 py-1">
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                      <div className="text-right flex-shrink-0 ml-3">
                        <span className="font-headline text-sm font-medium uppercase tracking-widest text-muted">
                          {eMonth}
                        </span>
                        <span className="font-headline text-2xl font-black text-light leading-none block">
                          {eDay}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className={`font-headline text-lg font-black italic tracking-tighter leading-tight mb-3 ${
                      isSelected ? "text-primary" : "text-light"
                    }`}>
                      {event.title}
                    </h3>

                    {/* Meta */}
                    <div className="flex items-center gap-3 font-headline text-sm font-medium uppercase tracking-widest text-muted mb-3">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        {event.city}, {STATE_LABELS[event.state]}
                      </span>
                      <span className="text-dark-lighter">·</span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        {formatTime(event.time)}
                      </span>
                    </div>

                    {/* Description snippet */}
                    <p className="text-sm text-muted leading-relaxed line-clamp-2">
                      {event.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: event detail ── */}
        <div className="flex-1 overflow-y-auto bg-dark-darker">
          {!selectedEvent ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-12">
              <ArrowRight className="w-10 h-10 text-muted rotate-180" />
              <p className="font-headline text-xl font-medium uppercase tracking-widest text-muted">
                Select an event to view details
              </p>
            </div>
          ) : (
            <div>
              {/* Banner image */}
              <div className="relative h-56 overflow-hidden flex-shrink-0">
                <img
                  src={bannerUrl}
                  alt={selectedEvent.title}
                  className="absolute inset-0 w-full h-full object-cover brightness-50"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-dark-darker/80 to-transparent" />

                {/* Status + type overlaid on image */}
                <div className="absolute top-5 left-6 flex items-center gap-3">
                  <span className={`font-headline text-sm font-medium uppercase tracking-widest px-3 py-1 ${status?.style}`}>
                    {status?.label}
                  </span>
                  <span className="font-headline text-sm font-medium uppercase tracking-widest text-muted">
                    {EVENT_TYPE_LABELS[selectedEvent.type]}
                  </span>
                </div>

                {/* Date block overlaid bottom-right */}
                <div className="absolute bottom-5 right-6 bg-dark/80 px-4 py-2 text-right">
                  <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted leading-none mb-1">{month}</p>
                  <p className="font-headline text-4xl font-black text-light leading-none">{day}</p>
                </div>
              </div>

              {/* Detail content */}
              <div className="p-8">
                <h2 className="font-headline text-4xl font-black italic tracking-tighter text-light leading-none mb-6">
                  {selectedEvent.title}
                </h2>

                {/* Meta rows */}
                <div className="space-y-3.5 mb-6">
                  <div className="flex items-center gap-3 font-headline text-sm font-medium uppercase tracking-widest text-muted">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{selectedEvent.location}, {STATE_LABELS[selectedEvent.state]}</span>
                  </div>
                  <div className="flex items-center gap-3 font-headline text-sm font-medium uppercase tracking-widest text-muted">
                    <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{formatEventDate(selectedEvent.date)}</span>
                  </div>
                  <div className="flex items-center gap-3 font-headline text-sm font-medium uppercase tracking-widest text-muted">
                    <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>
                      {formatTime(selectedEvent.time)}
                      {selectedEvent.endTime && ` — ${formatTime(selectedEvent.endTime)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-headline text-sm font-medium uppercase tracking-widest text-muted">
                    <Users className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>
                      {selectedEvent.format === "team"
                        ? "Team"
                        : selectedEvent.format === "both"
                        ? "Individual & Team"
                        : "Individual"}
                      {selectedEvent.distance && ` · ${selectedEvent.distance}`}
                      {" · "}
                      {selectedEvent.level === "elite"
                        ? "Elite"
                        : selectedEvent.level === "beginner"
                        ? "Beginner"
                        : "Open"}
                    </span>
                  </div>
                  {selectedEvent.organizer && (
                    <div className="flex items-center gap-3 font-headline text-sm font-medium uppercase tracking-widest text-muted">
                      <span className="w-4 h-4 flex-shrink-0" />
                      <span>By {selectedEvent.organizer}</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-dark-lighter mb-6" />

                {/* Description */}
                <p className="text-base font-medium text-muted leading-relaxed mb-8 border-l-2 border-dark-lighter pl-4">
                  {selectedEvent.description}
                </p>

                {/* Register button */}
                <div className="flex items-center gap-4">
                  <a
                    href={selectedEvent.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 bg-machined text-dark font-headline text-base font-bold uppercase tracking-widest px-8 py-4 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
                  >
                    Register Now
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <a
                    href={`/events/${selectedEvent.id}`}
                    className="font-headline text-sm font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    Full details
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
