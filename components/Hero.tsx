"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown } from "lucide-react";
import { STATE_OPTIONS, EVENT_TYPE_OPTIONS, AustralianState, EventType } from "@/types";

export default function Hero() {
  const [selectedState, setSelectedState] = useState<AustralianState | "">("");
  const [selectedType, setSelectedType] = useState<EventType | "">("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (selectedState) params.set("state", selectedState);
    if (selectedType) params.set("type", selectedType);
    router.push(`/events${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const handleQuickFilter = (type: EventType) => {
    router.push(`/events?type=${type}`);
  };

  return (
    <section className="bg-dark-darker py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Content */}
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-dark-light px-3 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm text-muted">Australia&apos;s Competitive Fitness Calendar</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-normal text-light mb-4 leading-tight tracking-tight">
            Where is your next<br />
            <span className="text-primary">Start Line</span>?
          </h1>

          {/* Sub-headline */}
          <p className="text-lg md:text-xl text-muted mb-8 max-w-2xl">
            Discover HYROX, CrossFit competitions, running races and hybrid events across Australia.
          </p>

          {/* Event Type Quick Filters */}
          <div className="flex flex-wrap gap-2 mb-8">
            {EVENT_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleQuickFilter(option.value)}
                className="px-4 py-2 bg-dark-light border border-dark-lighter rounded text-sm font-medium text-light hover:border-primary hover:text-primary transition-colors"
              >
                {option.shortLabel}
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            {/* State Dropdown */}
            <div className="relative flex-1 max-w-xs">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value as AustralianState | "")}
                className="w-full appearance-none bg-dark-light border border-dark-lighter rounded px-4 py-3 pr-10 text-light focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
              >
                <option value="">All States</option>
                {STATE_OPTIONS.map((state) => (
                  <option key={state.value} value={state.value}>
                    {state.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
            </div>

            {/* Search Button */}
            <button
              type="submit"
              className="flex items-center justify-center gap-2 bg-primary text-dark px-6 py-3 rounded font-semibold hover:bg-primary-light transition-colors duration-200"
            >
              <Search className="w-5 h-5" />
              <span>Find Competitions</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
