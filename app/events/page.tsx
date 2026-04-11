"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
  formatShortDate, formatTime, formatEventDate,
} from "@/lib/utils";

// ── Image pool ───────────────────────────────────────────────────────────────
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

// ── Filter chip ───────────────────────────────────────────────────────────
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
import { Suspense } from "react";

function EventsPageInner() {
  const allEvents = useMemo(() => eventsData.events as FitnessEvent[], []);
  const [liveEvents, setLiveEvents] = useState<FitnessEvent[]>(allEvents);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data: FitnessEvent[]) => { if (Array.isArray(data)) setLiveEvents(data); })
      .catch(() => {});
  }, []);

  const searchParams = useSearchParams();
  const [whatQuery, setWhatQuery] = useState(searchParams.get("what") ?? "");
  const [whereQuery, setWhereQuery] = useState(searchParams.get("where") ?? "");
  const [typeFilter, setTypeFilter] = useState<EventType | "">("");
  const [stateFilter, setStateFilter] = useState<AustralianState | "">("");
  const [formatFilter, setFormatFilter] = useState<CompetitionFormat | "">("");
  const [dateFilter, setDateFilter] = useState<FilterState["dateRange"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const filterState: FilterState = useMemo(() => ({
    types: typeFilter ? [typeFilter as EventType] : [],
    states: stateFilter ? [stateFilter as AustralianState] : [],
    format: formatFilter ? (formatFilter as CompetitionFormat) : null,
    dateRange: dateFilter,
    searchQuery: whatQuery,
  }), [typeFilter, stateFilter, formatFilter, dateFilter, whatQuery]);

  const displayEvents = useMemo(() => {
    let results = filterEvents(liveEvents, filterState);
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
  }, [liveEvents, filterState, whereQuery]);

  const selectedEvent = useMemo(
    () => liveEvents.find((e) => e.id === selectedId) ?? null,
    [liveEvents, selectedId]
  );

  useEffect(() => {
    if (!selectedId && displayEvents.length > 0) {
      setSelectedId(displayEvents[0].id);
    }
  }, [displayEvents, selectedId]);

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
        <div className="max-w-[1440px] mx-auto px-6 pt-6 pb-3 flex items-stretch border-b border-dark-lighter gap-0.5 bg-dark-darker">
          <div className="flex-1 bg-dark px-5 py-3 border-r border-dark-lighter min-w-0">
            <label className="font-headline text-xs font-black uppercase tracking-widest text-primary block mb-2">
              Event
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Event name, type or keyword"
                value={whatQuery}
                onChange={(e) => setWhatQuery(e.target.value)}
                className="w-full bg-transparent text-light font-headline text-xl placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none"
              />
              {whatQuery && (
                <button onClick={() => setWhatQuery("")} className="text-muted hover:text-light flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 bg-dark px-5 py-3 border-r border-dark-lighter min-w-0">
            <label className="font-headline text-xs font-black uppercase tracking-widest text-primary block mb-2">
              Where
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="State, city, or suburb"
                value={whereQuery}
                onChange={(e) => setWhereQuery(e.target.value)}
                className="w-full bg-transparent text-light font-headline text-xl placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none"
              />
              {whereQuery && (
                <button onClick={() => setWhereQuery("")} className="text-muted hover:text-light flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <button className="flex items-center gap-2 bg-machined text-dark font-headline text-base font-bold uppercase tracking-widest px-10 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 flex-shrink-0">
            <Search className="w-5 h-5" />
            Search
          </button>
        </div>

        {/* Row 2: Filter chips */}
        <div className="max-w-[1440px] mx-auto px-6 pt-3 pb-6 flex items-center gap-2.5 flex-wrap">
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

          <span className="ml-auto font-headline text-base font-medium uppercase tracking-widest text-muted">
            {displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Two-panel content area ── */}
      <div className="flex flex-1 overflow-hidden max-w-[1440px] w-full mx-auto">

        {/* LEFT: event list */}
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

                    <h3 className={`font-headline text-lg font-black italic tracking-tighter leading-tight mb-3 ${
                      isSelected ? "text-primary" : "text-light"
                    }`}>
                      {event.title}
                    </h3>

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

                    <p className="text-sm text-muted leading-relaxed line-clamp-2">
                      {event.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: event detail */}
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
              {/* ── Hero banner ── */}
              <div className="relative h-80 overflow-hidden flex-shrink-0">
                <img
                  src={bannerUrl}
                  alt={selectedEvent.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-transparent to-transparent" />

                {/* Status + type badges */}
                <div className="absolute top-5 left-6 flex items-center gap-3 flex-wrap">
                  <span className={`font-headline text-xs font-medium uppercase tracking-widest px-3 py-1.5 ${status?.style}`}>
                    {status?.label}
                  </span>
                  <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                    {EVENT_TYPE_LABELS[selectedEvent.type]}
                  </span>
                  {selectedEvent.isOfficial && (
                    <span className="font-headline text-xs font-medium uppercase tracking-widest text-primary border border-primary/40 px-2 py-1">
                      Official
                    </span>
                  )}
                </div>

                {/* Title + location overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <Link href={`/events/${selectedEvent.id}`} className="group">
                    <h2 className="font-headline text-4xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors duration-150 leading-none mb-3 inline-block">
                      {selectedEvent.title}
                    </h2>
                  </Link>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1.5 font-headline text-sm font-medium uppercase tracking-widest text-muted">
                      <MapPin className="w-4 h-4 text-primary" />
                      {selectedEvent.location}, {STATE_LABELS[selectedEvent.state]}
                    </span>
                    <span className="flex items-center gap-1.5 font-headline text-sm font-medium uppercase tracking-widest text-muted">
                      <Calendar className="w-4 h-4 text-primary" />
                      {formatEventDate(selectedEvent.date)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Bento specs grid ── */}
              <div className="p-0.5 bg-dark-darker">
                <div className="grid grid-cols-2 gap-0.5 bg-dark-darker">

                  {/* Schedule tile */}
                  <div className="bg-dark p-8">
                    <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted mb-3">
                      Schedule
                    </p>
                    <p className="font-headline text-5xl font-black text-primary leading-none mb-1">{day}</p>
                    <p className="font-headline text-base font-bold uppercase tracking-wider text-light">{month}</p>
                    <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted mt-2">
                      {formatTime(selectedEvent.time)}
                      {selectedEvent.endTime && ` — ${formatTime(selectedEvent.endTime)}`}
                    </p>
                  </div>

                  {/* Race config tile */}
                  <div className="bg-dark p-8">
                    <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted mb-3">
                      Race Config
                    </p>
                    <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-2 leading-tight">
                      {selectedEvent.format === "team"
                        ? "Team"
                        : selectedEvent.format === "both"
                        ? "Individual & Team"
                        : "Individual"}
                    </p>
                    {selectedEvent.distance && (
                      <p className="font-headline text-sm uppercase tracking-widest text-primary mb-2">
                        {selectedEvent.distance}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-headline text-sm font-medium uppercase tracking-widest text-muted">
                        {selectedEvent.level === "elite" ? "Elite" : selectedEvent.level === "beginner" ? "Beginner" : "Open"}
                      </span>
                    </div>
                  </div>

                  {/* Location tile – full width */}
                  <div className="col-span-2 bg-dark p-8 border-l-4 border-primary">
                    <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted mb-3">
                      Location
                    </p>
                    <h3 className="font-headline text-2xl font-black italic tracking-tighter text-light mb-1 leading-tight">
                      {selectedEvent.location}
                    </h3>
                    <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted mb-4">
                      {selectedEvent.city}, {STATE_LABELS[selectedEvent.state]}
                    </p>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(
                          selectedEvent.location + ", " + selectedEvent.city + ", Australia"
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-headline text-sm uppercase tracking-widest text-primary hover:underline"
                      >
                        View on Maps
                      </a>
                    </div>
                  </div>

                  {/* Description tile */}
                  <div className="col-span-2 bg-dark p-8">
                    <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted mb-3">
                      Event Overview
                    </p>
                    <p className="text-base font-medium text-muted leading-relaxed mb-5">
                      {selectedEvent.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="font-headline text-sm font-medium uppercase tracking-widest text-dark bg-primary px-3 py-1">
                        {EVENT_TYPE_LABELS[selectedEvent.type]}
                      </span>
                      <span className="font-headline text-sm font-medium uppercase tracking-widest text-muted border border-dark-lighter px-3 py-1">
                        {selectedEvent.format === "team" ? "Team" : selectedEvent.format === "both" ? "Individual & Team" : "Individual"}
                      </span>
                      {selectedEvent.isOfficial && (
                        <span className="font-headline text-sm uppercase tracking-widest text-primary border border-primary/40 px-3 py-1">
                          Official Event
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Registration tile */}
                  <div className="col-span-2 bg-dark border-l-4 border-primary p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted mb-2">
                        Registration
                      </p>
                      {selectedEvent.organizer && (
                        <p className="font-headline text-base font-medium uppercase tracking-widest text-light">
                          By {selectedEvent.organizer}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <a
                        href={selectedEvent.registrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 bg-machined text-dark font-headline text-base font-bold uppercase tracking-widest px-10 py-4 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
                      >
                        Register Now
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense>
      <EventsPageInner />
    </Suspense>
  );
}
