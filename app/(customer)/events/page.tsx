"use client";

import { useState, useMemo, useEffect, useRef, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, ChevronDown, MapPin, Clock, Users, Calendar,
  ExternalLink, ArrowRight, X, SlidersHorizontal,
} from "lucide-react";
import type { CustomerEvent, FilterState, EventType, AustralianState, CompetitionFormat } from "@/types";
import {
  EVENT_TYPE_LABELS, STATE_LABELS, STATE_OPTIONS, EVENT_TYPE_OPTIONS,
  FORMAT_OPTIONS, DATE_RANGE_OPTIONS,
} from "@/types";
import {
  filterEvents, sortEventsByDate,
  formatShortDate, formatTime, formatEventDate, formatCompetitionFormat,
} from "@/lib/utils";
import { getEventImage } from "@/lib/images";
import { getEventStatus } from "@/lib/event-status";
import { toCustomerEvents } from "@/lib/customer-events";

interface FilterChipProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (v: string) => void;
}

function FilterChip({ label, value, options, isOpen, onOpen, onClose, onChange }: FilterChipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== "";

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, onClose]);

  const currentLabel = options.find((o) => o.value === value)?.label ?? label;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={isOpen ? onClose : onOpen}
        className={`flex items-center gap-1.5 px-3 py-2 h-9 font-headline text-xs font-medium uppercase tracking-widest border transition-colors duration-100 rounded-full whitespace-nowrap ${
          active
            ? "border-primary text-primary bg-primary/5"
            : "border-dark-lighter text-muted bg-dark hover:border-primary/50 hover:text-light"
        }`}
      >
        {currentLabel}
        {active && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(""); onClose(); }}
            className="text-primary hover:text-light"
          >
            <X className="w-3 h-3" />
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-dark border border-dark-lighter min-w-[180px] shadow-xl rounded-xl overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); onClose(); }}
              className={`w-full text-left px-4 py-3 font-headline text-xs font-medium uppercase tracking-widest transition-colors ${
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

const DISCIPLINE_OPTIONS = [
  { value: "", label: "Discipline" },
  ...EVENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
];
const STATE_CHIP_OPTIONS = [
  { value: "", label: "State" },
  ...STATE_OPTIONS.map((o) => ({ value: o.value, label: o.shortLabel })),
];
const FORMAT_CHIP_OPTIONS = [
  { value: "", label: "Format" },
  ...FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
];
const DATE_CHIP_OPTIONS = [
  { value: "", label: "All Upcoming" },
  ...DATE_RANGE_OPTIONS
    .filter((o) => o.value !== "all")
    .map((o) => ({ value: o.value, label: o.label })),
];

function EventsPageInner() {
  const router = useRouter();
  const [allEvents, setAllEvents] = useState<CustomerEvent[]>([]);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllEvents(toCustomerEvents(data));
      })
      .catch(() => {});
  }, []);

  const searchParams = useSearchParams();
  const [whatQuery,    setWhatQuery]    = useState(searchParams.get("what")  ?? "");
  const [whereQuery,   setWhereQuery]   = useState(searchParams.get("where") ?? "");
  const [typeFilter,   setTypeFilter]   = useState<EventType | "">((searchParams.get("type") as EventType) ?? "");
  const [stateFilter,  setStateFilter]  = useState<AustralianState | "">("");
  const [formatFilter, setFormatFilter] = useState<CompetitionFormat | "">("");
  const [dateFilter,   setDateFilter]   = useState<FilterState["dateRange"]>("all");
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileSearch, setMobileSearch] = useState(false);

  const filterState: FilterState = useMemo(() => ({
    types:       typeFilter   ? [typeFilter as EventType]        : [],
    states:      stateFilter  ? [stateFilter as AustralianState] : [],
    format:      formatFilter ? (formatFilter as CompetitionFormat) : null,
    dateRange:   dateFilter,
    searchQuery: whatQuery,
  }), [typeFilter, stateFilter, formatFilter, dateFilter, whatQuery]);

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

  useEffect(() => {
    if (!selectedId && displayEvents.length > 0) {
      setSelectedId(displayEvents[0].id);
    }
  }, [displayEvents, selectedId]);

  function clearFilters() {
    setWhatQuery(""); setWhereQuery("");
    setTypeFilter(""); setStateFilter(""); setFormatFilter(""); setDateFilter("all");
    setSelectedId(null);
  }

  const hasActiveFilters = !!(typeFilter || stateFilter || formatFilter || dateFilter !== "all" || whatQuery || whereQuery);

  const [day, month] = selectedEvent ? formatShortDate(selectedEvent.date).split(" ") : ["", ""];
  const status    = selectedEvent ? getEventStatus(selectedEvent) : null;
  const bannerUrl = selectedEvent ? getEventImage(selectedEvent.type, selectedEvent.id, 1200, 80) : "";

  const activeFilterCount = [typeFilter, stateFilter, formatFilter, dateFilter !== "all" ? dateFilter : ""].filter(Boolean).length;

  return (
    <div className="bg-dark-darker flex flex-col" style={{ minHeight: "100dvh" }}>

      {/* ── Sticky header: search + filter chips ── */}
      <div className="sticky top-0 z-40 bg-dark-darker border-b border-dark-lighter flex-shrink-0 pt-14">

        {/* Desktop search bar */}
        <div className="hidden lg:block max-w-[1440px] mx-auto px-6 pt-5 pb-3">
          <div className="flex items-stretch gap-0.5 bg-dark-darker rounded-3xl overflow-hidden">
            <div className="flex-1 bg-dark px-5 py-3 border-r border-dark-lighter min-w-0">
              <label className="font-headline text-xs font-black uppercase tracking-widest text-primary block mb-1.5">Event</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Event name, type or keyword"
                  value={whatQuery}
                  onChange={(e) => setWhatQuery(e.target.value)}
                  className="w-full bg-transparent text-light font-headline text-lg placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none"
                />
                {whatQuery && (
                  <button onClick={() => setWhatQuery("")} className="text-muted hover:text-light flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 bg-dark px-5 py-3 border-r border-dark-lighter min-w-0">
              <label className="font-headline text-xs font-black uppercase tracking-widest text-primary block mb-1.5">Where</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="State, city, or suburb"
                  value={whereQuery}
                  onChange={(e) => setWhereQuery(e.target.value)}
                  className="w-full bg-transparent text-light font-headline text-lg placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none"
                />
                {whereQuery && (
                  <button onClick={() => setWhereQuery("")} className="text-muted hover:text-light flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => {}}
              className="flex items-center gap-2 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-8 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 flex-shrink-0"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
        </div>

        {/* Mobile search bar — compact single line */}
        <div className="lg:hidden px-4 pt-3 pb-2">
          {mobileSearch ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-dark rounded-xl px-4 py-2.5">
                <Search className="w-4 h-4 text-muted flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Event name, type or keyword"
                  value={whatQuery}
                  onChange={(e) => setWhatQuery(e.target.value)}
                  className="flex-1 bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:outline-none"
                />
                {whatQuery && (
                  <button onClick={() => setWhatQuery("")} className="text-muted"><X className="w-4 h-4" /></button>
                )}
              </div>
              <div className="flex items-center gap-2 bg-dark rounded-xl px-4 py-2.5">
                <MapPin className="w-4 h-4 text-muted flex-shrink-0" />
                <input
                  type="text"
                  placeholder="City or state"
                  value={whereQuery}
                  onChange={(e) => setWhereQuery(e.target.value)}
                  className="flex-1 bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:outline-none"
                />
                {whereQuery && (
                  <button onClick={() => setWhereQuery("")} className="text-muted"><X className="w-4 h-4" /></button>
                )}
              </div>
              <button
                onClick={() => setMobileSearch(false)}
                className="text-center font-headline text-xs uppercase tracking-widest text-muted py-1"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              onClick={() => setMobileSearch(true)}
              className="w-full flex items-center gap-3 bg-dark rounded-xl px-4 h-11 text-left"
            >
              <Search className="w-4 h-4 text-muted flex-shrink-0" />
              <span className="flex-1 font-headline text-sm text-muted/60 truncate">
                {whatQuery || whereQuery
                  ? [whatQuery, whereQuery].filter(Boolean).join(" · ")
                  : "Search events…"}
              </span>
              {hasActiveFilters && (
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-dark bg-primary px-2 py-0.5 rounded-full">
                  {activeFilterCount > 0 ? activeFilterCount : ""}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Filter chips — horizontally scrollable on mobile */}
        <div className="px-4 lg:px-6 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <FilterChip
            label="Discipline"
            value={typeFilter}
            options={DISCIPLINE_OPTIONS}
            isOpen={openDropdown === "discipline"}
            onOpen={() => setOpenDropdown("discipline")}
            onClose={() => setOpenDropdown(null)}
            onChange={(v) => { setTypeFilter(v as EventType | ""); setSelectedId(null); }}
          />
          <FilterChip
            label="State"
            value={stateFilter}
            options={STATE_CHIP_OPTIONS}
            isOpen={openDropdown === "state"}
            onOpen={() => setOpenDropdown("state")}
            onClose={() => setOpenDropdown(null)}
            onChange={(v) => { setStateFilter(v as AustralianState | ""); setSelectedId(null); }}
          />
          <FilterChip
            label="Format"
            value={formatFilter}
            options={FORMAT_CHIP_OPTIONS}
            isOpen={openDropdown === "format"}
            onOpen={() => setOpenDropdown("format")}
            onClose={() => setOpenDropdown(null)}
            onChange={(v) => { setFormatFilter(v as CompetitionFormat | ""); setSelectedId(null); }}
          />
          <FilterChip
            label="All Upcoming"
            value={dateFilter === "all" ? "" : dateFilter}
            options={DATE_CHIP_OPTIONS}
            isOpen={openDropdown === "date"}
            onOpen={() => setOpenDropdown("date")}
            onClose={() => setOpenDropdown(null)}
            onChange={(v) => { setDateFilter((v || "all") as FilterState["dateRange"]); setSelectedId(null); }}
          />
          <span className="flex-shrink-0 ml-auto font-headline text-xs font-medium uppercase tracking-widest text-muted pl-2">
            {displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 max-w-[1440px] w-full mx-auto overflow-hidden">

        {/* ── Mobile: full-width list (tap → detail page) ── */}
        <div className="flex-1 overflow-y-auto lg:hidden">
          {displayEvents.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-2">No events found.</p>
              <button
                onClick={clearFilters}
                className="font-headline text-sm font-medium uppercase tracking-widest border border-primary text-primary px-5 py-2.5 hover:bg-primary hover:text-dark transition-colors rounded-full"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-3 pb-8">
              {displayEvents.map((event) => {
                const [eDay, eMonth] = formatShortDate(event.date).split(" ");
                const img = getEventImage(event.type, event.id, 800, 80);
                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block rounded-2xl overflow-hidden ring-1 ring-dark-lighter active:ring-primary transition-all duration-150"
                  >
                    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/6" }}>
                      <img src={img} alt={event.title} className="w-full h-full object-cover brightness-50" />
                      <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/30 to-transparent" />
                      <div className="absolute top-2.5 left-3">
                        <span className="font-headline text-[9px] font-bold uppercase tracking-widest text-dark bg-primary px-2 py-0.5 rounded-full">
                          {EVENT_TYPE_LABELS[event.type]}
                        </span>
                      </div>
                      <div className="absolute top-2.5 right-3">
                        <span className="font-headline text-xs font-medium text-light bg-dark/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
                          {eDay} {eMonth}
                        </span>
                      </div>
                    </div>
                    <div className="bg-dark px-4 pt-3 pb-4">
                      <h3 className="font-headline text-base font-black italic tracking-tighter leading-tight text-light mb-2">
                        {event.title}
                      </h3>
                      <div className="flex items-center justify-between gap-2 font-headline text-[10px] text-muted uppercase tracking-widest">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                          {event.city}, {STATE_LABELS[event.state]}
                        </span>
                        {event.ticketDrops && event.ticketDrops.length > 0 && (
                          <span className="font-headline text-xs font-bold text-light flex-shrink-0">
                            From {event.ticketDrops[0].price}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Desktop left panel: event list ── */}
        <div className="hidden lg:block w-[400px] flex-shrink-0 overflow-y-auto bg-dark-darker border-r border-dark-lighter">
          {displayEvents.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted mb-3">No Results</p>
              <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-4">No events found.</p>
              <button
                onClick={clearFilters}
                className="font-headline text-sm font-medium uppercase tracking-widest border border-primary text-primary px-5 py-2.5 hover:bg-primary hover:text-dark transition-colors rounded-full"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-3">
              {displayEvents.map((event) => {
                const isSelected = event.id === selectedId;
                const [eDay, eMonth] = formatShortDate(event.date).split(" ");
                const img = getEventImage(event.type, event.id, 1200, 80);
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedId(event.id)}
                    className={`w-full text-left rounded-2xl overflow-hidden transition-all duration-150 ${
                      isSelected ? "ring-2 ring-primary" : "ring-1 ring-dark-lighter hover:ring-primary/50"
                    }`}
                  >
                    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/6" }}>
                      <img src={img} alt={event.title} className="w-full h-full object-cover brightness-50" />
                      <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/30 to-transparent" />
                      <div className="absolute top-3 left-3">
                        <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-dark bg-primary px-2 py-0.5 rounded-full">
                          {EVENT_TYPE_LABELS[event.type]}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="font-headline text-xs font-medium text-light bg-dark/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
                          {eDay} {eMonth}
                        </span>
                      </div>
                    </div>
                    <div className="bg-dark px-4 pt-3 pb-4">
                      <h3 className={`font-headline text-base font-black italic tracking-tighter leading-tight mb-2 ${isSelected ? "text-primary" : "text-light"}`}>
                        {event.title}
                      </h3>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 font-headline text-xs text-muted uppercase tracking-widest">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                            {event.city}, {STATE_LABELS[event.state]}
                          </span>
                        </div>
                        {event.ticketDrops && event.ticketDrops.length > 0 && (
                          <span className="font-headline text-xs font-bold text-light flex-shrink-0">
                            From {event.ticketDrops[0].price}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Desktop right panel: event detail ── */}
        <div className="hidden lg:block flex-1 overflow-y-auto bg-dark-darker">
          {!selectedEvent ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-12">
              <ArrowRight className="w-10 h-10 text-muted rotate-180" />
              <p className="font-headline text-xl font-medium uppercase tracking-widest text-muted">
                Select an event to view details
              </p>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-0">

              <div className="relative rounded-3xl overflow-hidden" style={{ aspectRatio: "16/7" }}>
                <img src={bannerUrl} alt={selectedEvent.title} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/40 to-transparent" />
                <div className="absolute top-4 left-5 flex items-center gap-2 flex-wrap">
                  <span className={`font-headline text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-full ${status?.style}`}>
                    {status?.label}
                  </span>
                  <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted bg-dark/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    {EVENT_TYPE_LABELS[selectedEvent.type]}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <Link href={`/events/${selectedEvent.id}`} className="group">
                    <h2 className="font-headline text-3xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors leading-none mb-2 inline-block">
                      {selectedEvent.title}
                    </h2>
                  </Link>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-muted">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      {selectedEvent.location}, {STATE_LABELS[selectedEvent.state]}
                    </span>
                    <span className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-muted">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      {formatEventDate(selectedEvent.date)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col divide-y divide-dark-lighter pb-6">

                <div className="grid grid-cols-2 py-7 gap-8">
                  <div>
                    <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-3">Schedule</p>
                    <p className="font-headline text-5xl font-black text-primary leading-none mb-1">{day}</p>
                    <p className="font-headline text-base font-bold uppercase tracking-wider text-light">{month}</p>
                    <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mt-2">
                      {formatTime(selectedEvent.time)}
                      {selectedEvent.endTime && ` — ${formatTime(selectedEvent.endTime)}`}
                    </p>
                  </div>
                  <div>
                    <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-3">Race Config</p>
                    <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-2 leading-tight">
                      {formatCompetitionFormat(selectedEvent.format)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                        {selectedEvent.level === "elite" ? "Elite" : selectedEvent.level === "beginner" ? "Beginner" : "Open"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="py-7">
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-3">Location</p>
                  <h3 className="font-headline text-xl font-black italic tracking-tighter text-light mb-1 leading-tight">
                    {selectedEvent.location}
                  </h3>
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-4">
                    {selectedEvent.city}, {STATE_LABELS[selectedEvent.state]}
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(
                      selectedEvent.location + ", " + selectedEvent.city + ", Australia"
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-headline text-xs uppercase tracking-widest text-primary hover:text-primary/70 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    View on Maps
                  </a>
                </div>

                <div className="py-7">
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-3">Event Overview</p>
                  <p className="text-sm font-medium text-muted leading-relaxed mb-4">{selectedEvent.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="font-headline text-xs font-medium uppercase tracking-widest text-dark bg-primary px-3 py-1 rounded-full">
                      {EVENT_TYPE_LABELS[selectedEvent.type]}
                    </span>
                    <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted border border-dark-lighter px-3 py-1 rounded-full">
                      {formatCompetitionFormat(selectedEvent.format)}
                    </span>
                  </div>
                </div>

                {selectedEvent.ticketDrops && selectedEvent.ticketDrops.length > 0 && (
                  <div className="py-7">
                    <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-3">Pricing</p>
                    <div className="space-y-2">
                      {selectedEvent.ticketDrops.map((drop, i) => (
                        <div key={i} className="flex items-center justify-between bg-dark-light rounded-lg px-5 py-3">
                          <div>
                            <p className="font-headline text-sm font-bold text-light">{drop.label}</p>
                            {drop.date && (
                              <p className="font-headline text-xs text-muted uppercase tracking-widest">{drop.date}</p>
                            )}
                          </div>
                          <span className="font-headline text-lg font-black italic text-primary">{drop.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="py-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-1">Registration</p>
                    {selectedEvent.organizer && (
                      <p className="font-headline text-base font-medium uppercase tracking-widest text-light">
                        By {selectedEvent.organizer}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Link
                      href={`/events/${selectedEvent.id}`}
                      className="inline-flex items-center gap-2 border border-dark-lighter text-muted font-headline text-sm font-bold uppercase tracking-widest px-5 py-3 rounded-xl hover:border-primary/50 hover:text-light transition-colors"
                    >
                      More Info
                    </Link>
                    {selectedEvent.registrationUrl && (
                      <a
                        href={selectedEvent.registrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-7 py-3 rounded-xl machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
                      >
                        Register Now
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
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
