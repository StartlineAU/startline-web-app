import Link from "next/link";
import { Calendar, MapPin, Clock, Ticket } from "lucide-react";
import { formatMediumDate, formatTime } from "@/lib/utils";
import { STATE_LABELS } from "@/types";
import type { UserRegistrationEvent } from "@/lib/user-registrations";

interface RegistrationListProps {
  registrations: UserRegistrationEvent[];
  emptyTitle: string;
  emptyDescription: string;
}

export function RegistrationList({
  registrations,
  emptyTitle,
  emptyDescription,
}: RegistrationListProps) {
  if (registrations.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted text-sm mb-1">{emptyTitle}</p>
        <p className="text-muted-dark text-xs mb-4">{emptyDescription}</p>
        <Link
          href="/events"
          className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
        >
          Browse events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {registrations.map((reg) => (
        <Link
          key={reg.id}
          href={`/events/${reg.eventId}`}
          className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-light transition-colors group"
        >
          <div className="flex-shrink-0 w-12 text-center">
            <span className="font-headline text-[10px] uppercase tracking-widest text-primary block">
              {reg.event.discipline.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-headline text-sm font-bold italic tracking-tighter text-light group-hover:text-primary transition-colors truncate">
              {reg.event.title}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted font-headline text-[10px] uppercase tracking-widest mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary" />
                {formatMediumDate(reg.event.eventDate)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" />
                {formatTime(reg.event.startTime)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-primary" />
                {reg.event.city}, {STATE_LABELS[reg.event.state as keyof typeof STATE_LABELS] ?? reg.event.state}
              </span>
              {reg.waveLabel && (
                <span className="flex items-center gap-1">
                  <Ticket className="w-3 h-3 text-primary" />
                  {reg.waveLabel}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
