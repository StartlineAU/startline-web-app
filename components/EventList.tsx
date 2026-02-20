"use client";

import { FitnessEvent } from "@/types";
import EventCard from "./EventCard";
import { Calendar, SearchX } from "lucide-react";

interface EventListProps {
  events: FitnessEvent[];
  loading?: boolean;
}

export default function EventList({ events, loading = false }: EventListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm border border-light-dark overflow-hidden animate-pulse"
          >
            <div className="aspect-[16/10] bg-light-dark" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-light-dark rounded w-3/4" />
              <div className="h-4 bg-light-dark rounded w-full" />
              <div className="h-4 bg-light-dark rounded w-2/3" />
              <div className="space-y-2 pt-2">
                <div className="h-3 bg-light-dark rounded w-1/2" />
                <div className="h-3 bg-light-dark rounded w-1/3" />
                <div className="h-3 bg-light-dark rounded w-2/3" />
              </div>
              <div className="pt-4 border-t border-light-dark flex justify-between">
                <div className="h-3 bg-light-dark rounded w-1/4" />
                <div className="h-8 bg-light-dark rounded w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-light-dark p-12 text-center">
        <div className="w-16 h-16 bg-light rounded-full flex items-center justify-center mx-auto mb-4">
          <SearchX className="w-8 h-8 text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-dark mb-2">No Events Found</h3>
        <p className="text-muted max-w-md mx-auto">
          We couldn&apos;t find any events matching your criteria. Try adjusting
          your filters or search in a different area.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Results Count */}
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-primary" />
        <p className="text-muted">
          <span className="font-semibold text-dark">{events.length}</span>{" "}
          {events.length === 1 ? "event" : "events"} found
        </p>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
