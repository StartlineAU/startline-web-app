"use client";

import { X, ChevronDown, ChevronUp, Filter } from "lucide-react";
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
    <aside className="bg-dark rounded-lg border border-dark-light p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-white">Filters</h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-muted hover:text-primary transition-colors flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Date Range */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white mb-3">When</h3>
        <div className="flex flex-wrap gap-2">
          {DATE_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleDateRangeChange(option.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filters.dateRange === option.value
                  ? "bg-primary text-dark"
                  : "bg-dark-light text-muted hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event Types */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white mb-3">Event Type</h3>
        <div className="space-y-2">
          {EVENT_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={filters.types.includes(option.value)}
                  onChange={() => handleTypeToggle(option.value)}
                  className="w-4 h-4 rounded border-dark-lighter bg-dark-light text-primary focus:ring-primary focus:ring-offset-0"
                />
                <span className="text-sm text-muted group-hover:text-white transition-colors">
                  {option.label}
                </span>
              </div>
              {eventCounts?.byType && (
                <span className="text-xs text-muted-dark">
                  {eventCounts.byType[option.value] || 0}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* States */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white mb-3">State</h3>
        <div className="grid grid-cols-2 gap-2">
          {STATE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStateToggle(option.value)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-between ${
                filters.states.includes(option.value)
                  ? "bg-primary text-dark"
                  : "bg-dark-light text-muted hover:text-white"
              }`}
            >
              <span>{option.shortLabel}</span>
              {eventCounts?.byState && (
                <span
                  className={`text-xs ${
                    filters.states.includes(option.value)
                      ? "text-dark/70"
                      : "text-muted-dark"
                  }`}
                >
                  {eventCounts.byState[option.value] || 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white mb-3">Format</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="format"
              checked={filters.format === null}
              onChange={() => handleFormatChange(null)}
              className="w-4 h-4 border-dark-lighter bg-dark-light text-primary focus:ring-primary focus:ring-offset-0"
            />
            <span className="text-sm text-muted group-hover:text-white transition-colors">
              All Formats
            </span>
          </label>
          {FORMAT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="radio"
                name="format"
                checked={filters.format === option.value}
                onChange={() => handleFormatChange(option.value)}
                className="w-4 h-4 border-dark-lighter bg-dark-light text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span className="text-sm text-muted group-hover:text-white transition-colors">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="pt-4 border-t border-dark-light">
          <p className="text-xs text-muted mb-2">Active Filters:</p>
          <div className="flex flex-wrap gap-2">
            {filters.types.map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-1 rounded"
              >
                {EVENT_TYPE_OPTIONS.find((o) => o.value === type)?.shortLabel}
                <button
                  onClick={() => handleTypeToggle(type)}
                  className="hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.states.map((state) => (
              <span
                key={state}
                className="inline-flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-1 rounded"
              >
                {STATE_OPTIONS.find((o) => o.value === state)?.shortLabel}
                <button
                  onClick={() => handleStateToggle(state)}
                  className="hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.format && (
              <span className="inline-flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                {FORMAT_OPTIONS.find((o) => o.value === filters.format)?.label}
                <button
                  onClick={() => handleFormatChange(null)}
                  className="hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
