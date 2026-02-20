"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FilterSidebar from "@/components/FilterSidebar";
import EventList from "@/components/EventList";
import eventsData from "@/data/events.json";
import { FitnessEvent, FilterState } from "@/types";
import {
  filterEvents,
  sortEventsByDate,
  getUniqueAreas,
} from "@/lib/utils";
import { Calendar, Filter, X, SlidersHorizontal } from "lucide-react";

function EventsContent() {
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>({
    types: [],
    area: searchParams.get("area") || "",
    dateFrom: null,
    dateTo: null,
    searchQuery: "",
  });

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const events = eventsData.events as FitnessEvent[];
  const areas = useMemo(() => getUniqueAreas(events), [events]);

  const filteredEvents = useMemo(() => {
    const filtered = filterEvents(events, filters);
    return sortEventsByDate(filtered);
  }, [events, filters]);

  // Update area filter when URL params change
  useEffect(() => {
    const areaParam = searchParams.get("area");
    if (areaParam && areaParam !== filters.area) {
      setFilters((prev) => ({ ...prev, area: areaParam }));
    }
  }, [searchParams]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.area ||
    filters.dateFrom ||
    filters.searchQuery;

  return (
    <div className="bg-light min-h-screen">
      {/* Page Header */}
      <div className="bg-dark py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-dark" />
            </div>
            <h1 className="text-3xl font-bold text-white">Upcoming Events</h1>
          </div>
          <p className="text-muted max-w-2xl">
            Browse fitness events in your area. Use the filters to find the
            perfect activity for you.
          </p>

          {/* Search Bar */}
          <div className="mt-6 max-w-xl">
            <div className="relative">
              <input
                type="text"
                placeholder="Search events..."
                value={filters.searchQuery}
                onChange={(e) =>
                  setFilters({ ...filters, searchQuery: e.target.value })
                }
                className="w-full px-4 py-3 bg-dark-light border border-dark-lighter rounded-lg text-white placeholder-muted focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              {filters.searchQuery && (
                <button
                  onClick={() => setFilters({ ...filters, searchQuery: "" })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filter Button */}
      <div className="lg:hidden bg-white border-b border-light-dark sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <button
            onClick={() => setShowMobileFilters(true)}
            className="flex items-center gap-2 bg-light px-4 py-2 rounded-lg font-medium"
          >
            <SlidersHorizontal className="w-5 h-5" />
            Filters
            {hasActiveFilters && (
              <span className="bg-primary text-dark text-xs px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Filter Overlay */}
      {showMobileFilters && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-dark/50"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-light overflow-y-auto">
            <div className="sticky top-0 bg-light p-4 border-b border-light-dark flex items-center justify-between">
              <h2 className="font-semibold text-dark">Filters</h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-2 hover:bg-light-dark rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <FilterSidebar
                filters={filters}
                onFilterChange={handleFilterChange}
                areas={areas}
              />
            </div>
            <div className="sticky bottom-0 bg-light p-4 border-t border-light-dark">
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full bg-primary text-dark py-3 rounded-lg font-semibold hover:bg-primary-light transition-colors"
              >
                Show {filteredEvents.length} Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <FilterSidebar
              filters={filters}
              onFilterChange={handleFilterChange}
              areas={areas}
            />
          </div>

          {/* Events List */}
          <div className="flex-1 min-w-0">
            <EventList events={filteredEvents} />
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
        <div className="bg-light min-h-screen">
          <div className="bg-dark py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="animate-pulse">
                <div className="h-10 w-64 bg-dark-light rounded mb-4" />
                <div className="h-5 w-96 bg-dark-light rounded" />
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 py-8">
            <EventList events={[]} loading={true} />
          </div>
        </div>
      }
    >
      <EventsContent />
    </Suspense>
  );
}
