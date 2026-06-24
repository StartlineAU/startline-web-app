"use client";

import { useState, useMemo, useEffect, useRef, Suspense, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, ChevronDown, MapPin, Clock, Users, Calendar,
  ExternalLink, ArrowRight, X, SlidersHorizontal, List, Map as MapIcon,
} from "lucide-react";
import type { UserEvent, FilterState, EventType, AustralianState, CompetitionFormat } from "@/types";
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
import { toUserEvents } from "@/lib/user-events";
import { filterMapEvents, hasCoordinates } from "@/lib/map-events";

const EventsMap = dynamic(() => import("@/components/EventsMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-dark">
      <p className="font-headline text-sm uppercase tracking-widest text-muted">Loading map...</p>
    </div>
  ),
});

type ViewMode = "list" | "map";

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-dark-lighter bg-dark p-0.5 flex-shrink-0">
      <button
        type="button"
        data-testid="view-mode-list"
        onClick={() => onChange("list")}
        className={`flex items-center gap-1.5 px-3 py-1.5 font-headline text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors ${
          viewMode === "list"
            ? "bg-primary text-dark"
            : "text-muted hover:text-light"
        }`}
      >
        <List className="w-3.5 h-3.5" />
        List
      </button>
      <button
        type="button"
        data-testid="view-mode-map"
        onClick={() => onChange("map")}
        className={`flex items-center gap-1.5 px-3 py-1.5 font-headline text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors ${
          viewMode === "map"
            ? "bg-primary text-dark"
            : "text-muted hover:text-light"
        }`}
      >
        <MapIcon className="w-3.5 h-3.5" />
        Map
      </button>
    </div>
  );
}

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
  const [allEvents, setAllEvents] = useState<UserEvent[]>([]);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllEvents(toUserEvents(data));
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
  const [selectedId,        setSelectedId]        = useState<string | null>(searchParams.get("event"));
  const [viewMode,          setViewMode]          = useState<ViewMode>(
    searchParams.get("view") === "map" ? "map" : "list",
  );
  const [openDropdown,      setOpenDropdown]      = useState<string | null>(null);
  const [mobileSearch,      setMobileSearch]      = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetDragStart = useRef(0);
  const sheetIsDragging = useRef(false);

  function onSheetTouchStart(e: React.TouchEvent) {
    sheetDragStart.current = e.touches[0].clientY;
    sheetIsDragging.current = true;
  }
  function onSheetTouchMove(e: React.TouchEvent) {
    if (!sheetIsDragging.current) return;
    const delta = e.touches[0].clientY - sheetDragStart.current;
    if (delta > 0) setSheetDragY(delta);
  }
  function onSheetTouchEnd() {
    if (sheetDragY > 120) {
      setMobileFiltersOpen(false);
      setSheetDragY(0);
    } else {
      setSheetDragY(0);
    }
    sheetIsDragging.current = false;
  }

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

  const mapEvents = useMemo(() => filterMapEvents(displayEvents), [displayEvents]);
  const missingCoordinateCount = displayEvents.length - mapEvents.length;

  const selectedEvent = useMemo(
    () => allEvents.find((e) => e.id === selectedId) ?? null,
    [allEvents, selectedId]
  );

  useEffect(() => {
    if (viewMode === "map") return;
    if (!selectedId && displayEvents.length > 0) {
      setSelectedId(displayEvents[0].id);
    }
  }, [displayEvents, selectedId, viewMode]);

  useEffect(() => {
    if (viewMode !== "map" || mapEvents.length === 0 || selectedId === null) return;
    const current = allEvents.find((e) => e.id === selectedId);
    if (!current || !hasCoordinates(current)) {
      setSelectedId(mapEvents[0].id);
    }
  }, [viewMode, mapEvents, selectedId, allEvents]);

  function showOnMap(eventId?: string) {
    if (eventId) setSelectedId(eventId);
    setViewMode("map");
  }

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

        {/* Mobile search bar - compact single line */}
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

        {/* Desktop filter chips */}
        <div className="hidden lg:flex px-6 pb-3 items-center gap-2">
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
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          <span className="flex-shrink-0 ml-auto font-headline text-xs font-medium uppercase tracking-widest text-muted pl-2">
            {viewMode === "map"
              ? `${displayEvents.length} event${displayEvents.length !== 1 ? "s" : ""} | ${mapEvents.length} on map`
              : `${displayEvents.length} event${displayEvents.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Mobile: filters + view toggle */}
        <div className="lg:hidden px-4 pb-3 flex items-center gap-2">
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 h-9 font-headline text-xs font-medium uppercase tracking-widest border transition-colors rounded-full ${
              activeFilterCount > 0
                ? "border-primary text-primary bg-primary/5"
                : "border-dark-lighter text-muted bg-dark hover:border-primary/50 hover:text-light"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="font-headline text-[10px] font-bold text-dark bg-primary rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <span className="ml-auto font-headline text-xs font-medium uppercase tracking-widest text-muted">
            {viewMode === "map"
              ? `${mapEvents.length} on map`
              : `${displayEvents.length} event${displayEvents.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        {viewMode === "map" && missingCoordinateCount > 0 && (
          <p className="px-4 lg:px-6 pb-2 font-headline text-[10px] uppercase tracking-widest text-muted">
            {missingCoordinateCount} event{missingCoordinateCount !== 1 ? "s" : ""} hidden until coordinates are saved.
          </p>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 max-w-[1440px] w-full mx-auto overflow-hidden">

        {/* ── Mobile: full-width list or map ── */}
        <div className="flex-1 overflow-hidden lg:hidden flex flex-col min-h-0">
          {viewMode === "map" ? (
            <div className="flex-1 min-h-[360px]" data-testid="events-map">
              <EventsMap
                events={displayEvents}
                selectedId={selectedId}
                onSelect={setSelectedId}
                className="h-full w-full"
              />
            </div>
          ) : (
          <div className="flex-1 overflow-y-auto">
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

        {/* ── Desktop right panel: event detail or map ── */}
        <div className="hidden lg:block flex-1 overflow-hidden bg-dark-darker min-h-0">
          {viewMode === "map" ? (
            <div className="h-full" data-testid="events-map">
              <EventsMap
                events={displayEvents}
                selectedId={selectedId}
                onSelect={setSelectedId}
                className="h-full w-full"
              />
            </div>
          ) : !selectedEvent ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-12">
              <ArrowRight className="w-10 h-10 text-muted rotate-180" />
              <p className="font-headline text-xl font-medium uppercase tracking-widest text-muted">
                Select an event to view details
              </p>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
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
                      {selectedEvent.endTime && ` - ${formatTime(selectedEvent.endTime)}`}
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
                  {hasCoordinates(selectedEvent) && (
                    <button
                      type="button"
                      onClick={() => showOnMap(selectedEvent.id)}
                      className="inline-flex items-center gap-2 font-headline text-xs uppercase tracking-widest text-primary hover:text-primary/70 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      View on Map
                    </button>
                  )}
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
            </div>
          )}
        </div>

      </div>

      {/* Mobile filters bottom sheet */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-dark-darker/80 backdrop-blur-sm"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 bg-dark rounded-t-2xl max-h-[85dvh] flex flex-col"
            style={{
              transform: `translateY(${sheetDragY}px)`,
              transition: sheetDragY === 0 ? "transform 0.3s ease" : "none",
            }}
          >
            <div
              className="flex justify-center pt-3 pb-1 flex-shrink-0 touch-none cursor-grab active:cursor-grabbing"
              onTouchStart={onSheetTouchStart}
              onTouchMove={onSheetTouchMove}
              onTouchEnd={onSheetTouchEnd}
            >
              <div className="w-10 h-1 rounded-full bg-dark-lighter" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-dark-lighter flex-shrink-0">
              <h2 className="font-headline text-sm font-black uppercase tracking-widest text-light">Filters</h2>
              <div className="flex items-center gap-4">
                {hasActiveFilters && (
                  <button
                    onClick={() => { clearFilters(); }}
                    className="font-headline text-xs font-medium uppercase tracking-widest text-primary"
                  >
                    Clear all
                  </button>
                )}
                <button onClick={() => setMobileFiltersOpen(false)}>
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-7">
              <div>
                <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Discipline</p>
                <div className="flex flex-wrap gap-2">
                  {DISCIPLINE_OPTIONS.filter((o) => o.value !== "").map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setTypeFilter(typeFilter === opt.value ? "" : opt.value as EventType); setSelectedId(null); }}
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
                  {STATE_CHIP_OPTIONS.filter((o) => o.value !== "").map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setStateFilter(stateFilter === opt.value ? "" : opt.value as AustralianState); setSelectedId(null); }}
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
                  {FORMAT_CHIP_OPTIONS.filter((o) => o.value !== "").map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setFormatFilter(formatFilter === opt.value ? "" : opt.value as CompetitionFormat); setSelectedId(null); }}
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
                  {DATE_CHIP_OPTIONS.map((opt) => {
                    const isActive = opt.value === "" ? dateFilter === "all" : dateFilter === opt.value;
                    return (
                      <button
                        key={opt.value || "all"}
                        onClick={() => { setDateFilter((opt.value || "all") as FilterState["dateRange"]); setSelectedId(null); }}
                        className={`px-4 py-2 rounded-full font-headline text-xs font-medium uppercase tracking-widest border transition-colors ${
                          isActive
                            ? "border-primary bg-primary text-dark"
                            : "border-dark-lighter text-muted hover:border-primary/50 hover:text-light"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 px-5 pb-8 pt-4 border-t border-dark-lighter">
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-xl machined-button-shadow hover:-translate-y-0.5 transition-transform duration-100"
              >
                Show {displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
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
