"use client";

import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, MapPin, Calendar, X, SlidersHorizontal } from "lucide-react";
import type { UserEvent, FilterState, EventType, AustralianState, CompetitionFormat } from "@/types";
import {
  EVENT_TYPE_LABELS, STATE_LABELS, STATE_OPTIONS, EVENT_TYPE_OPTIONS,
  FORMAT_OPTIONS, DATE_RANGE_OPTIONS,
} from "@/types";
import { filterEvents, sortEventsByDate, formatShortDate } from "@/lib/utils";
import { getEventImage } from "@/lib/images";
import { toUserEvents } from "@/lib/user-events";
import { getEventCoords } from "@/lib/australia-coords";
import { useAuthContext } from "@/context/AuthContext";
import EventMap from "@/components/EventMap";
import type { EventMapHandle } from "@/components/EventMap";

const DISCIPLINE_OPTIONS = EVENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const STATE_CHIP_OPTIONS  = STATE_OPTIONS.map((o) => ({ value: o.value, label: o.shortLabel }));
const FORMAT_CHIP_OPTIONS = FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const DATE_CHIP_OPTIONS   = DATE_RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

function EventCard({ event, selected, onSelect }: { event: UserEvent; selected: boolean; onSelect: () => void }) {
  const [eDay, eMonth] = formatShortDate(event.date).split(" ");
  const img = getEventImage(event.type, event.id, 800, 80);
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 ${selected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-dark-light/50"}`}
    >
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-dark">
        <Image
          src={img}
          alt={event.title}
          fill
          className="pointer-events-none object-cover brightness-75 transition-all duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute top-2.5 left-2.5">
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-2 py-1 rounded-full">
            {EVENT_TYPE_LABELS[event.type]}
          </span>
        </div>
      </div>
      <div className="px-2.5 pb-2.5 pt-2">
        <h3 className="font-headline text-sm font-black italic tracking-tighter text-light leading-tight mb-1">
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
            From ${event.ticketDrops[0].price}
          </p>
        )}
        <Link
          href={`/events/${event.id}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}

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

  const header = (
    <div className="flex items-center justify-between px-6 py-4 border-b border-dark-lighter flex-shrink-0">
      <h2 className="font-headline text-sm font-black uppercase tracking-widest text-light">Filters</h2>
      <div className="flex items-center gap-4">
        {hasActiveFilters && (
          <button onClick={clearFilters} className="font-headline text-xs font-medium uppercase tracking-widest text-primary hover:text-primary/70 transition-colors">Clear all</button>
        )}
        <button onClick={onClose}><X className="w-5 h-5 text-muted hover:text-light transition-colors" /></button>
      </div>
    </div>
  );

  const body = (
    <div className="overflow-y-auto flex-1 px-6 py-6 space-y-7">
      <div>
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Discipline</p>
        <div className="flex flex-wrap gap-2">
          {DISCIPLINE_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setTypeFilter(typeFilter === opt.value ? "" : opt.value as EventType)}
              className={`px-4 py-2 rounded-full font-headline text-xs font-medium uppercase tracking-widest border transition-colors ${typeFilter === opt.value ? "border-primary bg-primary text-dark" : "border-dark-lighter text-muted hover:border-primary/50 hover:text-light"}`}
            >{opt.label}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-3">State</p>
        <div className="flex flex-wrap gap-2">
          {STATE_CHIP_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setStateFilter(stateFilter === opt.value ? "" : opt.value as AustralianState)}
              className={`px-4 py-2 rounded-full font-headline text-xs font-medium uppercase tracking-widest border transition-colors ${stateFilter === opt.value ? "border-primary bg-primary text-dark" : "border-dark-lighter text-muted hover:border-primary/50 hover:text-light"}`}
            >{opt.label}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Format</p>
        <div className="flex flex-wrap gap-2">
          {FORMAT_CHIP_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setFormatFilter(formatFilter === opt.value ? "" : opt.value as CompetitionFormat)}
              className={`px-4 py-2 rounded-full font-headline text-xs font-medium uppercase tracking-widest border transition-colors ${formatFilter === opt.value ? "border-primary bg-primary text-dark" : "border-dark-lighter text-muted hover:border-primary/50 hover:text-light"}`}
            >{opt.label}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Date</p>
        <div className="flex flex-wrap gap-2">
          {DATE_CHIP_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setDateFilter(opt.value as FilterState["dateRange"])}
              className={`px-4 py-2 rounded-full font-headline text-xs font-medium uppercase tracking-widest border transition-colors ${dateFilter === opt.value ? "border-primary bg-primary text-dark" : "border-dark-lighter text-muted hover:border-primary/50 hover:text-light"}`}
            >{opt.label}</button>
          ))}
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="flex-shrink-0 px-6 pb-6 pt-4 border-t border-dark-lighter">
      <button onClick={onClose}
        className="w-full bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-xl machined-button-shadow hover:-translate-y-0.5 transition-transform duration-100"
      >
        Show {displayCount} event{displayCount !== 1 ? "s" : ""}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-dark-darker/80 backdrop-blur-sm" onClick={onClose} />
      <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-dark rounded-t-2xl max-h-[85dvh] flex flex-col"
        style={{ transform: `translateY(${sheetDragY}px)`, transition: sheetDragY === 0 ? "transform 0.3s ease" : "none" }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 touch-none cursor-grab active:cursor-grabbing"
          onTouchStart={(e) => { (window as any)._dragStart = e.touches[0].clientY; (window as any)._isDragging = true; }}
          onTouchMove={(e) => { if (!(window as any)._isDragging) return; const d = e.touches[0].clientY - (window as any)._dragStart; if (d > 0) setSheetDragY(d); }}
          onTouchEnd={() => { if (sheetDragY > 120) { onClose(); } setSheetDragY(0); (window as any)._isDragging = false; }}
        >
          <div className="w-10 h-1 rounded-full bg-dark-lighter" />
        </div>
        {header}{body}{footer}
      </div>
      <div className="hidden lg:flex absolute inset-0 items-center justify-center p-8">
        <div className="relative bg-dark rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-dark-lighter shadow-2xl">
          {header}{body}{footer}
        </div>
      </div>
    </div>
  );
}

function EventsListingInner() {
  const { status } = useAuthContext();
  const [allEvents, setAllEvents] = useState<UserEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialCenter, setInitialCenter] = useState<{ lng: number; lat: number; zoom: number } | undefined>(undefined);
  const mapRef = useRef<EventMapHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllEvents(toUserEvents(data)); })
      .catch(() => {});
  }, []);

  // Fetch user location for map centering
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.city && data?.state) {
          const [lat, lng] = getEventCoords(data.city, data.state);
          setInitialCenter({ lng, lat, zoom: 5 });
        }
      })
      .catch(() => {});
  }, [status]);

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
      results = results.filter((e) => e.city.toLowerCase().includes(q) || e.state.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
    }
    return results;
  }, [allEvents, filterState, whereQuery]);

  function clearFilters() {
    setWhatQuery(""); setWhereQuery("");
    setTypeFilter(""); setStateFilter(""); setFormatFilter(""); setDateFilter("all");
  }

  const hasActiveFilters  = !!(typeFilter || stateFilter || formatFilter || dateFilter !== "all" || whatQuery || whereQuery);
  const activeFilterCount = [typeFilter, stateFilter, formatFilter, dateFilter !== "all" ? dateFilter : ""].filter(Boolean).length;

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => {
      const next = prev === id ? null : id;
      if (next) {
        mapRef.current?.flyTo(next);
        mapRef.current?.stopSpin();
      }
      return next;
    });
  }, []);

  const desktopList = (
    <div className="hidden lg:flex flex-col w-[480px] xl:w-[564px] flex-shrink-0 border-r border-dark-lighter bg-dark-darker">
      {/* Desktop search */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-stretch gap-2">
          <div className="flex flex-1 items-stretch bg-dark rounded-xl overflow-hidden border border-dark-lighter">
            <div className="flex-1 px-3.5 py-2.5 border-r border-dark-lighter min-w-0">
              <label className="font-headline text-[10px] font-black uppercase tracking-widest text-primary block mb-0.5">Event</label>
              <div className="flex items-center gap-1.5">
                <input type="text" placeholder="Event name, type or keyword" value={whatQuery}
                  onChange={(e) => setWhatQuery(e.target.value)}
                  className="w-full bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none" />
                {whatQuery && <button onClick={() => setWhatQuery("")} className="text-muted hover:text-light flex-shrink-0"><X className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
            <div className="flex-1 px-3.5 py-2.5 min-w-0">
              <label className="font-headline text-[10px] font-black uppercase tracking-widest text-primary block mb-0.5">Where</label>
              <div className="flex items-center gap-1.5">
                <input type="text" placeholder="State, city, or suburb" value={whereQuery}
                  onChange={(e) => setWhereQuery(e.target.value)}
                  className="w-full bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none" />
                {whereQuery && <button onClick={() => setWhereQuery("")} className="text-muted hover:text-light flex-shrink-0"><X className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          </div>
          <button onClick={() => setFiltersOpen(true)}
            className={`flex items-center gap-1.5 px-3 rounded-xl font-headline text-xs font-bold uppercase tracking-widest border transition-colors duration-100 flex-shrink-0 ${activeFilterCount > 0 ? "border-primary text-primary bg-primary/5" : "border-dark-lighter text-muted bg-dark hover:border-primary/50 hover:text-light"}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && <span className="w-4 h-4 rounded-full bg-primary text-dark font-headline text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-0.5">
          <span className="font-headline text-[11px] font-medium uppercase tracking-widest text-muted">{displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}</span>
          {hasActiveFilters && <button onClick={clearFilters} className="font-headline text-[10px] font-medium uppercase tracking-widest text-primary hover:text-primary/70 transition-colors">Clear all</button>}
        </div>
      </div>

      {/* Event list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-4">
        {displayEvents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-headline text-lg font-black italic tracking-tighter text-light mb-3">No events found.</p>
            <button onClick={clearFilters}
              className="font-headline text-xs font-medium uppercase tracking-widest border border-primary text-primary px-4 py-2 hover:bg-primary hover:text-dark transition-colors rounded-full"
            >Clear Filters</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayEvents.map((event) => (
              <EventCard key={event.id} event={event} selected={selectedId === event.id} onSelect={() => handleSelect(event.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const mobileList = (
    <div className="lg:hidden">
      {/* Mobile search */}
      <div className="px-4 pt-3 pb-2">
        {mobileSearch ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-dark rounded-xl px-4 py-2.5">
              <Search className="w-4 h-4 text-muted flex-shrink-0" />
              <input autoFocus type="text" placeholder="Event name, type or keyword" value={whatQuery}
                onChange={(e) => setWhatQuery(e.target.value)}
                className="flex-1 bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:outline-none" />
              {whatQuery && <button onClick={() => setWhatQuery("")} className="text-muted"><X className="w-4 h-4" /></button>}
            </div>
            <div className="flex items-center gap-2 bg-dark rounded-xl px-4 py-2.5">
              <MapPin className="w-4 h-4 text-muted flex-shrink-0" />
              <input type="text" placeholder="City or state" value={whereQuery}
                onChange={(e) => setWhereQuery(e.target.value)}
                className="flex-1 bg-transparent text-light font-headline text-sm placeholder:text-muted/40 border-0 focus:outline-none" />
              {whereQuery && <button onClick={() => setWhereQuery("")} className="text-muted"><X className="w-4 h-4" /></button>}
            </div>
            <button onClick={() => setMobileSearch(false)} className="text-center font-headline text-xs uppercase tracking-widest text-muted py-1">Done</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileSearch(true)} className="flex-1 flex items-center gap-3 bg-dark rounded-xl px-4 h-11 text-left min-w-0">
              <Search className="w-4 h-4 text-muted flex-shrink-0" />
              <span className="flex-1 font-headline text-sm text-muted/60 truncate">
                {whatQuery || whereQuery ? [whatQuery, whereQuery].filter(Boolean).join(" · ") : "Search events…"}
              </span>
            </button>
            <button onClick={() => setFiltersOpen(true)}
              className={`flex items-center gap-1.5 px-3 h-11 rounded-xl font-headline text-xs font-medium uppercase tracking-widest border transition-colors flex-shrink-0 ${activeFilterCount > 0 ? "border-primary text-primary bg-primary/5" : "border-dark-lighter text-muted bg-dark hover:border-primary/50"}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {activeFilterCount > 0 && <span className="w-4 h-4 rounded-full bg-primary text-dark font-headline text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>}
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mt-2.5">
          <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">{displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}</span>
          {hasActiveFilters && <button onClick={clearFilters} className="font-headline text-xs font-medium uppercase tracking-widest text-primary">Clear all</button>}
        </div>
      </div>

      {/* Mobile event grid (full width) */}
      {displayEvents.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-4">No events found.</p>
          <button onClick={clearFilters}
            className="font-headline text-sm font-medium uppercase tracking-widest border border-primary text-primary px-5 py-2.5 hover:bg-primary hover:text-dark transition-colors rounded-full"
          >Clear Filters</button>
        </div>
      ) : (
        <div className="px-3 pb-4 grid grid-cols-2 gap-3">
          {displayEvents.map((event) => (
            <EventCard key={event.id} event={event} selected={false} onSelect={() => {}} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row" style={{ height: "calc(100dvh - 56px)" }}>
      {desktopList}
      {mobileList}

      {/* Map panel (desktop only) */}
      <div className="hidden lg:flex flex-1 relative" style={{ minHeight: 400 }}>
        <EventMap
          events={displayEvents}
          selectedId={selectedId}
          onMarkerClick={handleSelect}
          initialCenter={initialCenter}
          ref={mapRef}
        />
      </div>

      {filtersOpen && (
        <FiltersPanel
          typeFilter={typeFilter} stateFilter={stateFilter} formatFilter={formatFilter} dateFilter={dateFilter}
          setTypeFilter={setTypeFilter} setStateFilter={setStateFilter} setFormatFilter={setFormatFilter} setDateFilter={setDateFilter}
          onClose={() => setFiltersOpen(false)} clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters} displayCount={displayEvents.length}
        />
      )}
    </div>
  );
}

export default function EventsListing() {
  return <Suspense><EventsListingInner /></Suspense>;
}
