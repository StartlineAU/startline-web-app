"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Calendar, X, SlidersHorizontal, Map } from "lucide-react";
import type { UserEvent, FilterState, EventType, AustralianState, CompetitionFormat } from "@/types";
import {
  EVENT_TYPE_LABELS, STATE_LABELS, STATE_OPTIONS, EVENT_TYPE_OPTIONS,
  FORMAT_OPTIONS, DATE_RANGE_OPTIONS,
} from "@/types";
import {
  filterEvents, sortEventsByDate, formatShortDate,
} from "@/lib/utils";
import { getEventImage } from "@/lib/images";
import { toUserEvents } from "@/lib/user-events";

const DISCIPLINE_OPTIONS = EVENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const STATE_CHIP_OPTIONS  = STATE_OPTIONS.map((o) => ({ value: o.value, label: o.shortLabel }));
const FORMAT_CHIP_OPTIONS = FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const DATE_CHIP_OPTIONS   = DATE_RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

// ── Shared event card ────────────────────────────────────────────────────────

function EventCard({ event }: { event: UserEvent }) {
  const [eDay, eMonth] = formatShortDate(event.date).split(" ");
  const img = getEventImage(event.type, event.id, 800, 80);

  return (
    <Link href={`/events/${event.id}`} className="group block">
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-dark mb-3 rounded-2xl sm:rounded-3xl">
        <img
          src={img}
          alt={event.title}
          className="w-full h-full object-cover brightness-75 group-hover:brightness-90 transition-all duration-500"
        />
        <div className="absolute top-2.5 left-2.5">
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-2 py-1 rounded-full">
            {EVENT_TYPE_LABELS[event.type]}
          </span>
        </div>
      </div>
      <div className="px-0.5">
        <h3 className="font-headline text-sm font-black italic tracking-tighter text-light group-hover:text-primary transition-colors leading-tight mb-1">
          {event.title}
        </h3>
        <div className="flex items-center gap-1.5 font-headline text-xs text-muted uppercase tracking-widest mb-0.5">
          <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
          {event.city}, {STATE_LABELS[event.state]}
        </div>
        <div className="flex items-center gap-1.5 font-headline text-xs text-muted uppercase tracking-widest">
          <Calendar className="w-3 h-3 text-primary flex-shrink-0" />
          {eDay} {eMonth}
        </div>
        {event.ticketDrops && event.ticketDrops.length > 0 && (
          <p className="font-headline text-xs font-bold text-light mt-1.5">
            From {event.ticketDrops[0].price}
          </p>
        )}
      </div>
    </Link>
  );
}

// ── Filters overlay (bottom sheet on mobile, centred modal on desktop) ───────

interface FiltersPanelProps {
  typeFilter:   string;
  stateFilter:  string;
  formatFilter: string;
  dateFilter:   FilterState["dateRange"];
  setTypeFilter:   (v: EventType | "")         => void;
  setStateFilter:  (v: AustralianState | "")   => void;
  setFormatFilter: (v: CompetitionFormat | "") => void;
  setDateFilter:   (v: FilterState["dateRange"]) => void;
  onClose:          () => void;
  clearFilters:     () => void;
  hasActiveFilters: boolean;
  displayCount:     number;
}

function FiltersPanel({
  typeFilter, stateFilter, formatFilter, dateFilter,
  setTypeFilter, setStateFilter, setFormatFilter, setDateFilter,
  onClose, clearFilters, hasActiveFilters, displayCount,
}: FiltersPanelProps) {
  const [sheetDragY, setSheetDragY] = useState(0);
  const dragStart   = useRef(0);
  const isDragging  = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    dragStart.current  = e.touches[0].clientY;
    isDragging.current = true;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - dragStart.current;
    if (delta > 0) setSheetDragY(delta);
  }
  function onTouchEnd() {
    if (sheetDragY > 120) { onClose(); setSheetDragY(0); }
    else setSheetDragY(0);
    isDragging.current = false;
  }

  const header = (
    <div className="flex items-center justify-between px-6 py-4 border-b border-dark-lighter flex-shrink-0">
      <h2 className="font-headline text-sm font-black uppercase tracking-widest text-light">Filters</h2>
      <div className="flex items-center gap-4">
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="font-headline text-xs font-medium uppercase tracking-widest text-primary hover:text-primary/70 transition-colors"
          >
            Clear all
          </button>
        )}
        <button onClick={onClose}>
          <X className="w-5 h-5 text-muted hover:text-light transition-colors" />
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="overflow-y-auto flex-1 px-6 py-6 space-y-7">
      <div>
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Discipline</p>
        <div className="flex flex-wrap gap-2">
          {DISCIPLINE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(typeFilter === opt.value ? "" : opt.value as EventType)}
              className={`px-4 py-2 rounded-full font-headline text-xs font-medium uppercase tracking-widest border transition-colors ${
                typeFilter === opt.value
                  ? "border-primary bg-primary text-dark"
                  : "border-dark-lighter text-muted hover:border-primary/50 hover:text-light"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-3">State</p>
        <div className="flex flex-wrap gap-2">
          {STATE_CHIP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStateFilter(stateFilter === opt.value ? "" : opt.value as AustralianState)}
              className={`px-4 py-2 rounded-full font-headline text-xs font-medium uppercase tracking-widest border transition-colors ${
                stateFilter === opt.value
                  ? "border-primary bg-primary text-dark"
                  : "border-dark-lighter text-muted hover:border-primary/50 hover:text-light"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Format</p>
        <div className="flex flex-wrap gap-2">
          {FORMAT_CHIP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFormatFilter(formatFilter === opt.value ? "" : opt.value as CompetitionFormat)}
              className={`px-4 py-2 rounded-full font-headline text-xs font-medium uppercase tracking-widest border transition-colors ${
                formatFilter === opt.value
                  ? "border-primary bg-primary text-dark"
                  : "border-dark-lighter text-muted hover:border-primary/50 hover:text-light"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Date</p>
        <div className="flex flex-wrap gap-2">
          {DATE_CHIP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateFilter(opt.value as FilterState["dateRange"])}
              className={`px-4 py-2 rounded-full font-headline text-xs font-medium uppercase tracking-widest border transition-colors ${
                dateFilter === opt.value
                  ? "border-primary bg-primary text-dark"
                  : "border-dark-lighter text-muted hover:border-primary/50 hover:text-light"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="flex-shrink-0 px-6 pb-6 pt-4 border-t border-dark-lighter">
      <button
        onClick={onClose}
        className="w-full bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-xl machined-button-shadow hover:-translate-y-0.5 transition-transform duration-100"
      >
        Show {displayCount} event{displayCount !== 1 ? "s" : ""}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-dark-darker/80 backdrop-blur-sm" onClick={onClose} />

      {/* Mobile: bottom sheet */}
      <div
        className="lg:hidden absolute bottom-0 left-0 right-0 bg-dark rounded-t-2xl max-h-[85dvh] flex flex-col"
        style={{
          transform:  `translateY(${sheetDragY}px)`,
          transition: sheetDragY === 0 ? "transform 0.3s ease" : "none",
        }}
      >
        <div
          className="flex justify-center pt-3 pb-1 flex-shrink-0 touch-none cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-dark-lighter" />
        </div>
        {header}
        {body}
        {footer}
      </div>

      {/* Desktop: centred modal */}
      <div className="hidden lg:flex absolute inset-0 items-center justify-center p-8">
        <div className="relative bg-dark rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-dark-lighter shadow-2xl">
          {header}
          {body}
          {footer}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function EventsPageInner() {
  const [allEvents, setAllEvents] = useState<UserEvent[]>([]);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllEvents(toUserEvents(data)); })
      .catch(() => {});
  }, []);

  const searchParams = useSearchParams();
  const [whatQuery,    setWhatQuery]    = useState(searchParams.get("what")  ?? "");
  const [whereQuery,   setWhereQuery]   = useState(searchParams.get("where") ?? "");
  const [typeFilter,   setTypeFilter]   = useState<EventType | "">((searchParams.get("type") as EventType) ?? "");
  const [stateFilter,  setStateFilter]  = useState<AustralianState | "">("");
  const [formatFilter, setFormatFilter] = useState<CompetitionFormat | "">("");
  const [dateFilter,   setDateFilter]   = useState<FilterState["dateRange"]>("all");
  const [filtersOpen,  setFiltersOpen]  = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const filterState: FilterState = useMemo(() => ({
    types:       typeFilter   ? [typeFilter as EventType]          : [],
    states:      stateFilter  ? [stateFilter as AustralianState]   : [],
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

  function clearFilters() {
    setWhatQuery(""); setWhereQuery("");
    setTypeFilter(""); setStateFilter(""); setFormatFilter(""); setDateFilter("all");
  }

  const hasActiveFilters  = !!(typeFilter || stateFilter || formatFilter || dateFilter !== "all" || whatQuery || whereQuery);
  const activeFilterCount = [typeFilter, stateFilter, formatFilter, dateFilter !== "all" ? dateFilter : ""].filter(Boolean).length;

  const emptyState = (
    <div className="p-10 text-center">
      <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-4">No events found.</p>
      <button
        onClick={clearFilters}
        className="font-headline text-sm font-medium uppercase tracking-widest border border-primary text-primary px-5 py-2.5 hover:bg-primary hover:text-dark transition-colors rounded-full"
      >
        Clear Filters
      </button>
    </div>
  );

  return (
    <div className="bg-dark-darker flex flex-col" style={{ minHeight: "100dvh" }}>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 bg-dark-darker border-b border-dark-lighter flex-shrink-0 pt-14">

        {/* Desktop: search bar + filters button on same row */}
        <div className="hidden lg:block max-w-[1440px] mx-auto px-6 pt-5 pb-3">
          <div className="flex items-stretch gap-3">

            {/* Search bar */}
            <div className="flex flex-1 items-stretch bg-dark rounded-2xl overflow-hidden border border-dark-lighter">

              {/* Event */}
              <div className="flex-1 px-5 py-3 border-r border-dark-lighter min-w-0">
                <label className="font-headline text-xs font-black uppercase tracking-widest text-primary block mb-1">
                  Event
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

              {/* Where */}
              <div className="flex-1 px-5 py-3 border-r border-dark-lighter min-w-0">
                <label className="font-headline text-xs font-black uppercase tracking-widest text-primary block mb-1">
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

              {/* Search button */}
              <button
                onClick={() => {}}
                className="flex items-center gap-2 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-7 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 flex-shrink-0"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>

            {/* Filters button — sits beside the search bar */}
            <button
              onClick={() => setFiltersOpen(true)}
              className={`flex items-center gap-2 px-5 rounded-2xl font-headline text-sm font-bold uppercase tracking-widest border transition-colors duration-100 flex-shrink-0 ${
                activeFilterCount > 0
                  ? "border-primary text-primary bg-primary/5"
                  : "border-dark-lighter text-muted bg-dark hover:border-primary/50 hover:text-light"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-dark font-headline text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Event count row */}
          <div className="flex items-center justify-between mt-2.5 px-1">
            <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
              {displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="font-headline text-xs font-medium uppercase tracking-widest text-primary hover:text-primary/70 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Mobile search bar */}
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
                {whatQuery && <button onClick={() => setWhatQuery("")} className="text-muted"><X className="w-4 h-4" /></button>}
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
                {whereQuery && <button onClick={() => setWhereQuery("")} className="text-muted"><X className="w-4 h-4" /></button>}
              </div>
              <button
                onClick={() => setMobileSearch(false)}
                className="text-center font-headline text-xs uppercase tracking-widest text-muted py-1"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileSearch(true)}
                className="flex-1 flex items-center gap-3 bg-dark rounded-xl px-4 h-11 text-left min-w-0"
              >
                <Search className="w-4 h-4 text-muted flex-shrink-0" />
                <span className="flex-1 font-headline text-sm text-muted/60 truncate">
                  {whatQuery || whereQuery
                    ? [whatQuery, whereQuery].filter(Boolean).join(" · ")
                    : "Search events…"}
                </span>
              </button>
              <button
                onClick={() => setFiltersOpen(true)}
                className={`flex items-center gap-1.5 px-3 h-11 rounded-xl font-headline text-xs font-medium uppercase tracking-widest border transition-colors flex-shrink-0 ${
                  activeFilterCount > 0
                    ? "border-primary text-primary bg-primary/5"
                    : "border-dark-lighter text-muted bg-dark hover:border-primary/50"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary text-dark font-headline text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Mobile event count */}
        <div className="lg:hidden px-4 pb-2.5 flex items-center justify-between">
          <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
            {displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="font-headline text-xs font-medium uppercase tracking-widest text-primary"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Mobile: full-width list */}
        <div className="flex-1 overflow-y-auto lg:hidden">
          {displayEvents.length === 0 ? emptyState : (
            <div className="p-3 flex flex-col gap-3 pb-8">
              {displayEvents.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          )}
        </div>

        {/* Desktop left panel: scrollable event list */}
        <div className="hidden lg:flex flex-col w-[564px] flex-shrink-0 border-r border-dark-lighter overflow-y-auto">
          {displayEvents.length === 0 ? emptyState : (
            <div className="p-4 grid grid-cols-2 gap-3">
              {displayEvents.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          )}
        </div>

        {/* Desktop right panel: Mapbox placeholder */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[#0d0d0f]">
          {/* Subtle grid texture */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(#B3E153 1px, transparent 1px), linear-gradient(90deg, #B3E153 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative z-10 flex flex-col items-center justify-center gap-3 w-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-dark border border-dark-lighter flex items-center justify-center mb-1">
              <Map className="w-6 h-6 text-primary/50" />
            </div>
            <p className="font-headline text-xs font-bold uppercase tracking-widest text-muted/50">
              Map view
            </p>
          </div>
        </div>

      </div>

      {/* ── Filters overlay ── */}
      {filtersOpen && (
        <FiltersPanel
          typeFilter={typeFilter}
          stateFilter={stateFilter}
          formatFilter={formatFilter}
          dateFilter={dateFilter}
          setTypeFilter={setTypeFilter}
          setStateFilter={setStateFilter}
          setFormatFilter={setFormatFilter}
          setDateFilter={setDateFilter}
          onClose={() => setFiltersOpen(false)}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          displayCount={displayEvents.length}
        />
      )}

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
