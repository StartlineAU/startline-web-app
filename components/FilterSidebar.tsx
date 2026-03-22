"use client";

import { X, SlidersHorizontal } from "lucide-react";
import {
  EventType,
  AustralianState,
  FilterState,
  EVENT_TYPE_OPTIONS,
  STATE_OPTIONS,
  FORMAT_OPTIONS,
  DATE_RANGE_OPTIONS,
} from "@/types";

interface FilterSidebarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  eventCounts?: {
    byType: Record<string, number>;
    byState: Record<string, number>;
  };
}

export default function FilterSidebar({
  filters,
  onFilterChange,
  eventCounts,
}: FilterSidebarProps) {
  const handleTypeToggle = (type: EventType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    onFilterChange({ ...filters, types: newTypes });
  };

  const handleStateToggle = (state: AustralianState) => {
    const newStates = filters.states.includes(state)
      ? filters.states.filter((s) => s !== state)
      : [...filters.states, state];
    onFilterChange({ ...filters, states: newStates });
  };

  const handleFormatChange = (format: string | null) => {
    onFilterChange({
      ...filters,
      format: format as FilterState["format"],
    });
  };

  const handleDateRangeChange = (range: FilterState["dateRange"]) => {
    onFilterChange({ ...filters, dateRange: range });
  };

  const handleClearFilters = () => {
    onFilterChange({
      types: [],
      states: [],
      format: null,
      dateRange: "all",
      searchQuery: "",
    });
  };

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.states.length > 0 ||
    filters.format ||
    filters.dateRange !== "all" ||
    filters.searchQuery;

  return (
    <aside className="bg-dark">
      {/* Header */}
      <div className="border-l-4 border-primary px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-light">
            Parameters
          </h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* Date Range */}
        <div>
          <h3 className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">
            Time Window
          </h3>
          <div className="flex flex-col gap-1">
            {DATE_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleDateRangeChange(option.value)}
                className={`text-left font-headline text-[10px] uppercase tracking-widest px-3 py-2 transition-colors ${
                  filters.dateRange === option.value
                    ? "bg-primary text-dark border-l-2 border-primary"
                    : "text-muted hover:text-light hover:bg-dark-light border-l-2 border-transparent"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-dark-lighter" />

        {/* Event Types */}
        <div>
          <h3 className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">
            Event Type
          </h3>
          <div className="space-y-1">
            {EVENT_TYPE_OPTIONS.map((option) => {
              const isActive = filters.types.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex items-center justify-between cursor-pointer px-3 py-2 transition-colors ${
                    isActive
                      ? "bg-primary/10 border-l-2 border-primary"
                      : "hover:bg-dark-light border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleTypeToggle(option.value)}
                      className="w-3.5 h-3.5 border-dark-lighter bg-dark-light text-primary focus:ring-primary focus:ring-offset-0"
                    />
                    <span
                      className={`font-headline text-[10px] uppercase tracking-widest transition-colors ${
                        isActive ? "text-primary" : "text-muted"
                      }`}
                    >
                      {option.label}
                    </span>
                  </div>
                  {eventCounts?.byType && (
                    <span
                      className={`font-headline text-[10px] ${
                        isActive ? "text-primary" : "text-muted-dark"
                      }`}
                    >
                      {eventCounts.byType[option.value] || 0}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-dark-lighter" />

        {/* States */}
        <div>
          <h3 className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">
            Regional Sector
          </h3>
          <div className="grid grid-cols-2 gap-0.5 bg-dark-darker">
            {STATE_OPTIONS.map((option) => {
              const isActive = filters.states.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => handleStateToggle(option.value)}
                  className={`flex items-center justify-between px-3 py-2 font-headline text-[10px] uppercase tracking-widest transition-colors ${
                    isActive
                      ? "bg-primary text-dark"
                      : "bg-dark text-muted hover:text-light hover:bg-dark-light"
                  }`}
                >
                  <span>{option.shortLabel}</span>
                  {eventCounts?.byState && (
                    <span
                      className={`text-[9px] ${
                        isActive ? "text-dark/70" : "text-muted-dark"
                      }`}
                    >
                      {eventCounts.byState[option.value] || 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-dark-lighter" />

        {/* Format */}
        <div>
          <h3 className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">
            Competition Format
          </h3>
          <div className="space-y-1">
            <label
              className={`flex items-center gap-3 cursor-pointer px-3 py-2 transition-colors ${
                filters.format === null
                  ? "border-l-2 border-primary"
                  : "border-l-2 border-transparent hover:bg-dark-light"
              }`}
            >
              <input
                type="radio"
                name="format"
                checked={filters.format === null}
                onChange={() => handleFormatChange(null)}
                className="w-3.5 h-3.5 border-dark-lighter bg-dark-light text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span
                className={`font-headline text-[10px] uppercase tracking-widest ${
                  filters.format === null ? "text-primary" : "text-muted"
                }`}
              >
                All Formats
              </span>
            </label>
            {FORMAT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 cursor-pointer px-3 py-2 transition-colors ${
                  filters.format === option.value
                    ? "border-l-2 border-primary"
                    : "border-l-2 border-transparent hover:bg-dark-light"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  checked={filters.format === option.value}
                  onChange={() => handleFormatChange(option.value)}
                  className="w-3.5 h-3.5 border-dark-lighter bg-dark-light text-primary focus:ring-primary focus:ring-offset-0"
                />
                <span
                  className={`font-headline text-[10px] uppercase tracking-widest ${
                    filters.format === option.value ? "text-primary" : "text-muted"
                  }`}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Reset Config button */}
        {hasActiveFilters && (
          <>
            <div className="h-px bg-dark-lighter" />
            <button
              onClick={handleClearFilters}
              className="w-full font-headline text-[10px] uppercase tracking-widest text-muted border border-dark-lighter py-3 hover:border-primary hover:text-primary transition-colors"
            >
              Reset Config
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
