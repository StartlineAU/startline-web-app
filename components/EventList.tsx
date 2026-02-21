"use client";

import { FitnessEvent } from "@/types";
import EventCard from "./EventCard";
import { Calendar, SearchX } from "lucide-react";

interface EventListProps {
  events: FitnessEvent[];
  loading?: boolean;
  viewMode?: "grid" | "list";
}

export default function EventList({
  events,
  loading = false,
  viewMode = "grid",
}: EventListProps) {
  if (loading) {
    return (
      <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="bg-dark rounded-lg border border-dark-light overflow-hidden animate-pulse"
          >
            {viewMode === "grid" ? (
              <>
                <div className="aspect-[16/10] bg-dark-light" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-dark-light rounded w-3/4" />
                  <div className="h-4 bg-dark-light rounded w-full" />
                  <div className="space-y-2 pt-2">
                    <div className="h-3 bg-dark-light rounded w-1/2" />
                    <div className="h-3 bg-dark-light rounded w-2/3" />
                  </div>
                  <div className="h-10 bg-dark-light rounded w-full mt-4" />
                </div>
              </>
            ) : (
              <div className="p-4 flex gap-4">
                <div className="w-16 h-16 bg-dark-light rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-dark-light rounded w-1/4" />
                  <div className="h-5 bg-dark-light rounded w-3/4" />
                  <div className="h-3 bg-dark-light rounded w-1/2" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-dark rounded-lg border border-dark-light p-12 text-center">
        <div className="w-16 h-16 bg-dark-light rounded-full flex items-center justify-center mx-auto mb-4">
          <SearchX className="w-8 h-8 text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          No Competitions Found
        </h3>
        <p className="text-muted max-w-md mx-auto">
          We couldn&apos;t find any competitions matching your criteria. Try
          adjusting your filters or check back later.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Results Count */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <p className="text-muted">
            <span className="font-semibold text-white">{events.length}</span>{" "}
            {events.length === 1 ? "competition" : "competitions"} found
          </p>
        </div>
      </div>

      {/* Events */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} variant="list" />
          ))}
        </div>
      )}
    </div>
  );
}
