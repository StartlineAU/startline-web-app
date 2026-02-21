"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FilterSidebar from "@/components/FilterSidebar";
import EventList from "@/components/EventList";
import eventsData from "@/data/events.json";
import { FitnessEvent, FilterState, EventType, AustralianState } from "@/types";
import { filterEvents, sortEventsByDate, getEventsByType, getEventsByState } from "@/lib/utils";
import { Calendar, X, SlidersHorizontal, LayoutGrid, List } from "lucide-react";

const DEFAULT_FILTERS: Pick<FilterState, "format" | "dateRange" | "searchQuery"> & {
  types: EventType[];
  states: AustralianState[];
} = {
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
      types: typeParam ? [typeParam as EventType] : [],
      states: stateParam ? [stateParam as AustralianState] : [],
      format: DEFAULT_FILTERS.format,
      dateRange: DEFAULT_FILTERS.dateRange,
      searchQuery: DEFAULT_FILTERS.searchQuery,
    };
  });

  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  useEffect(() => {
    const typeParam = searchParams.get("type");
    const stateParam = searchParams.get("state");

    setFilters((prev) => ({
      ...prev,
      types: typeParam ? [typeParam as EventType] : DEFAULT_FILTERS.types,
      states: stateParam ? [stateParam as AustralianState] : DEFAULT_FILTERS.states,
    }));
  }, [searchParams]);

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
    <div className="bg-dark-darker min-h-screen">
      {/* Page Header */}
      <div className="bg-dark border-b border-dark-light py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary rounded flex items-center justify-center">
              <Calendar className="w-5 h-5 text-dark" />
            </div>
            <h1 className="text-2xl font-bold text-light">Competitions</h1>
          </div>
          <p className="text-muted">
            Find your next HYROX, CrossFit, running or hybrid event
          </p>

          {/* Search Bar */}
          <div className="mt-4 max-w-xl">
            <div className="relative">
              <input
                type="text"
                placeholder="Search competitions..."
                value={filters.searchQuery}
                onChange={(e) =>
                  setFilters({ ...filters, searchQuery: e.target.value })
                }
                className="w-full px-4 py-2.5 bg-dark-light border border-dark-lighter rounded text-light placeholder-muted focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              {filters.searchQuery && (
                <button
                  onClick={() => setFilters({ ...filters, searchQuery: "" })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-light"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filter Button & View Toggle */}
      <div className="lg:hidden bg-dark-darker border-b border-dark-light sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setShowMobileFilters(true)}
            className="flex items-center gap-2 bg-dark-light px-4 py-2 rounded font-medium text-light"
          >
            <SlidersHorizontal className="w-5 h-5" />
            Filters
            {hasActiveFilters && (
              <span className="bg-primary text-dark text-xs px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </button>

          <div className="flex items-center gap-1 bg-dark-light rounded p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded ${
                viewMode === "grid" ? "bg-dark text-primary" : "text-muted"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded ${
                viewMode === "list" ? "bg-dark text-primary" : "text-muted"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Filter Overlay */}
      {showMobileFilters && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-dark-darker overflow-y-auto">
            <div className="sticky top-0 bg-dark-darker p-4 border-b border-dark-light flex items-center justify-between">
              <h2 className="font-semibold text-light">Filters</h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-2 hover:bg-dark-light rounded transition-colors"
              >
                <X className="w-5 h-5 text-light" />
              </button>
            </div>
            <div className="p-4">
              <FilterSidebar
                filters={filters}
                onFilterChange={handleFilterChange}
                eventCounts={eventCounts}
              />
            </div>
            <div className="sticky bottom-0 bg-dark-darker p-4 border-t border-dark-light">
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full bg-primary text-dark py-3 rounded font-semibold hover:bg-primary-light transition-colors"
              >
                Show {filteredEvents.length} Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <FilterSidebar
              filters={filters}
              onFilterChange={handleFilterChange}
              eventCounts={eventCounts}
            />
          </div>

          {/* Events List */}
          <div className="flex-1 min-w-0">
            {/* Desktop View Toggle */}
            <div className="hidden lg:flex items-center justify-end gap-1 mb-4">
              <div className="flex items-center gap-1 bg-dark rounded p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded ${
                    viewMode === "grid"
                      ? "bg-dark-light text-primary"
                      : "text-muted hover:text-light"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded ${
                    viewMode === "list"
                      ? "bg-dark-light text-primary"
                      : "text-muted hover:text-light"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            <EventList events={filteredEvents} viewMode={viewMode} />
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
        <div className="bg-dark-darker min-h-screen">
          <div className="bg-dark border-b border-dark-light py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="animate-pulse">
                <div className="h-10 w-48 bg-dark-light rounded mb-2" />
                <div className="h-5 w-96 bg-dark-light rounded" />
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 py-6">
            <EventList events={[]} loading={true} />
          </div>
        </div>
      }
    >
      <EventsContent />
    </Suspense>
  );
}