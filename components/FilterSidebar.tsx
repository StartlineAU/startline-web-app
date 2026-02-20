"use client";

import { useState } from "react";
import { Filter, MapPin, X, ChevronDown, ChevronUp } from "lucide-react";
import { EventType, EVENT_TYPE_OPTIONS, FilterState } from "@/types";
import CalendarPicker from "./CalendarPicker";

interface FilterSidebarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  areas: string[];
}

export default function FilterSidebar({
  filters,
  onFilterChange,
  areas,
}: FilterSidebarProps) {
  const [isTypesExpanded, setIsTypesExpanded] = useState(true);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);

  const handleTypeToggle = (type: EventType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    onFilterChange({ ...filters, types: newTypes });
  };

  const handleAreaChange = (area: string) => {
    onFilterChange({ ...filters, area });
  };

  const handleDateSelect = (date: Date | null) => {
    onFilterChange({
      ...filters,
      dateFrom: date ? date.toISOString().split("T")[0] : null,
      dateTo: date ? date.toISOString().split("T")[0] : null,
    });
  };

  const handleClearFilters = () => {
    onFilterChange({
      types: [],
      area: "",
      dateFrom: null,
      dateTo: null,
      searchQuery: "",
    });
  };

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.area ||
    filters.dateFrom ||
    filters.searchQuery;

  return (
    <aside className="bg-white rounded-xl shadow-sm border border-light-dark p-4 sticky top-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-dark">Filters</h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-muted hover:text-primary transition-colors flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      {/* Location Search */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-dark mb-2">
          Location
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by city or area..."
            value={filters.area}
            onChange={(e) => handleAreaChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-light border border-light-dark rounded-lg text-dark placeholder-muted focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
          />
          {filters.area && (
            <button
              onClick={() => handleAreaChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-dark"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Popular Areas */}
        {!filters.area && areas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {areas.slice(0, 4).map((area) => (
              <button
                key={area}
                onClick={() => handleAreaChange(area)}
                className="text-xs px-2 py-1 bg-light hover:bg-primary hover:text-dark rounded-full transition-colors"
              >
                {area}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Calendar Section */}
      <div className="mb-6">
        <button
          onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
          className="flex items-center justify-between w-full text-sm font-medium text-dark mb-2"
        >
          <span>Date</span>
          {isCalendarExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {isCalendarExpanded && (
          <CalendarPicker
            selectedDate={filters.dateFrom ? new Date(filters.dateFrom) : null}
            onDateSelect={handleDateSelect}
          />
        )}
      </div>

      {/* Event Types */}
      <div className="mb-6">
        <button
          onClick={() => setIsTypesExpanded(!isTypesExpanded)}
          className="flex items-center justify-between w-full text-sm font-medium text-dark mb-3"
        >
          <span>Event Types</span>
          <div className="flex items-center gap-2">
            {filters.types.length > 0 && (
              <span className="text-xs bg-primary text-dark px-2 py-0.5 rounded-full">
                {filters.types.length}
              </span>
            )}
            {isTypesExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {isTypesExpanded && (
          <div className="space-y-2">
            {EVENT_TYPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={filters.types.includes(option.value)}
                  onChange={() => handleTypeToggle(option.value)}
                  className="w-4 h-4 rounded border-muted text-primary focus:ring-primary custom-checkbox"
                />
                <span className="text-sm text-dark group-hover:text-primary transition-colors">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="pt-4 border-t border-light-dark">
          <p className="text-xs text-muted mb-2">Active Filters:</p>
          <div className="flex flex-wrap gap-2">
            {filters.area && (
              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-dark px-2 py-1 rounded-full">
                <MapPin className="w-3 h-3" />
                {filters.area}
                <button
                  onClick={() => handleAreaChange("")}
                  className="hover:text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.dateFrom && (
              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-dark px-2 py-1 rounded-full">
                {filters.dateFrom}
                <button
                  onClick={() => handleDateSelect(null)}
                  className="hover:text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.types.map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 text-xs bg-primary/10 text-dark px-2 py-1 rounded-full"
              >
                {EVENT_TYPE_OPTIONS.find((o) => o.value === type)?.label}
                <button
                  onClick={() => handleTypeToggle(type)}
                  className="hover:text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
