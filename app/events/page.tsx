"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FilterSidebar from "@/components/FilterSidebar";
import EventCard from "@/components/EventCard";
import eventsData from "@/data/events.json";
import { FitnessEvent, FilterState, EventType, AustralianState } from "@/types";
import {
  filterEvents,
  sortEventsByDate,
  getEventsByType,
  getEventsByState,
} from "@/lib/utils";
import { X, SlidersHorizontal } from "lucide-react";

const EVENTS_PER_PAGE = 12;

const DEFAULT_FILTERS: FilterState = {
  types: [],
  states: [],
  format: null,
  dateRange: "all",
  searchQuery: "",
};

function EventsContent() {
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(() => {
    const typeParam = searchParams.get("type");
    const stateParam = searchParams.get("state");
    return {
      ...DEFAULT_FILTERS,
      types: typeParam ? [typeParam as EventType] : [],
      states: stateParam ? [stateParam as AustralianState] : [],
    };
  });

  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const events = eventsData.events as FitnessEvent[];

  const eventCounts = useMemo(
    () => ({
      byType: getEventsByType(events),
      byState: getEventsByState(events),
    }),
    [events]
  );

  const filteredEvents = useMemo(() => {
    const filtered = filterEvents(events, filters);
    return sortEventsByDate(filtered);
  }, [events, filters]);

  const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * EVENTS_PER_PAGE,
    currentPage * EVENTS_PER_PAGE
  );

  useEffect(() => {
    const typeParam = searchParams.get("type");
    const stateParam = searchParams.get("state");
    setFilters((prev) => ({
      ...prev,
      types: typeParam ? [typeParam as EventType] : [],
      states: stateParam ? [stateParam as AustralianState] : [],
    }));
  }, [searchParams]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.states.length > 0 ||
    filters.format ||
    filters.dateRange !== "all" ||
    filters.searchQuery;

  return (
    <div className="bg-dark-darker min-h-screen pt-16">
      {/* ── Page Header ── */}
      <div className="bg-dark border-b border-dark-lighter">
        <div className="max-w-[1440px] mx-auto px-6 py-10">
          <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">
            StartLine / Events
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-headline text-5xl font-black italic tracking-tighter text-light leading-none">
                Active Events
              </h1>
              <p className="font-headline text-[10px] uppercase tracking-widest text-muted mt-2">
                {filteredEvents.length} results
                {hasActiveFilters && " — filtered"}
              </p>
            </div>

            {/* Search bar */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search events..."
                value={filters.searchQuery}
                onChange={(e) =>
                  setFilters({ ...filters, searchQuery: e.target.value })
                }
                className="w-full bg-dark-light border border-dark-lighter text-light font-headline text-[10px] uppercase tracking-wider placeholder-muted px-4 py-3 focus:border-primary focus:ring-0 focus:outline-none transition-colors"
              />
              {filters.searchQuery && (
                <button
                  onClick={() => setFilters({ ...filters, searchQuery: "" })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-light"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Filter Bar ── */}
      <div className="lg:hidden sticky top-16 z-40 bg-dark border-b border-dark-lighter">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setShowMobileFilters(true)}
            className="flex items-center gap-2 border border-dark-lighter px-4 py-2 font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary hover:border-primary transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Parameters
            {hasActiveFilters && (
              <span className="bg-primary text-dark text-[9px] font-headline uppercase tracking-wider px-1.5 py-0.5">
                Active
              </span>
            )}
          </button>
          <span className="font-headline text-[10px] uppercase tracking-widest text-muted">
            {filteredEvents.length} Events
          </span>
        </div>
      </div>

      {/* ── Mobile Filter Overlay ── */}
      {showMobileFilters && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-dark-darker overflow-y-auto">
            <div className="sticky top-0 bg-dark-darker border-b border-dark-lighter p-4 flex items-center justify-between">
              <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-light">
                Parameters
              </h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-2 hover:bg-dark-light transition-colors"
              >
                <X className="w-5 h-5 text-light" />
              </button>
            </div>
            <FilterSidebar
              filters={filters}
              onFilterChange={handleFilterChange}
              eventCounts={eventCounts}
            />
            <div className="sticky bottom-0 bg-dark-darker p-4 border-t border-dark-lighter">
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full bg-machined text-dark font-headline text-[10px] uppercase tracking-widest py-3 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100"
              >
                Show {filteredEvents.length} Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <div className="flex gap-0.5 bg-dark-darker items-start">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block w-72 flex-shrink-0 bg-dark-darker">
            <FilterSidebar
              filters={filters}
              onFilterChange={handleFilterChange}
              eventCounts={eventCounts}
            />
          </div>

          {/* Events Grid */}
          <div className="flex-1 min-w-0 bg-dark-darker">
            {paginatedEvents.length === 0 ? (
              <div className="bg-dark p-16 text-center">
                <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">
                  No Results
                </p>
                <h2 className="font-headline text-2xl font-black italic tracking-tighter text-light mb-4">
                  No events found.
                </h2>
                <p className="text-muted text-sm mb-6">
                  Try adjusting your filters or search query.
                </p>
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="font-headline text-[10px] uppercase tracking-widest border border-primary text-primary px-6 py-3 hover:bg-primary hover:text-dark transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-0.5 bg-dark-darker">
                {paginatedEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-0.5 bg-dark px-6 py-4 flex items-center justify-between">
                <span className="font-headline text-[10px] uppercase tracking-widest text-muted">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-0.5 bg-dark-darker">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 font-headline text-sm font-bold transition-colors ${
                          currentPage === page
                            ? "bg-primary text-dark"
                            : "bg-dark text-muted hover:text-light hover:bg-dark-light"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-dark-darker min-h-screen pt-16">
          <div className="bg-dark border-b border-dark-lighter py-10">
            <div className="max-w-[1440px] mx-auto px-6">
              <div className="animate-pulse">
                <div className="h-3 w-32 bg-dark-light mb-4" />
                <div className="h-14 w-64 bg-dark-light" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <EventsContent />
    </Suspense>
  );
}
