import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Clock, Users, Calendar, ExternalLink } from "lucide-react";
import { getAllEvents } from "@/lib/events";
import { toCustomerEvent } from "@/lib/customer-events";
import { EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatEventDate, formatTime, formatCompetitionFormat } from "@/lib/utils";
import { getEventImage } from "@/lib/images";
import { getEventStatus } from "@/lib/event-status";
import { Button } from "@/components/ui/button";

export const revalidate = 60;

export async function generateStaticParams() {
  const events = await getAllEvents();
  return events.map((e) => ({ id: e.id }));
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await getAllEvents();
  const found = raw.find((e) => e.id === id);
  if (!found) notFound();

  const event = toCustomerEvent(found);
  const [day, month] = formatEventDate(event.date).split(" ");
  const status = getEventStatus(event);
  const bannerUrl = getEventImage(event.type, event.id, 1200);

  return (
    <main className="min-h-screen bg-dark-darker pt-16">

      <section className="max-w-[1440px] mx-auto px-6 py-8">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors mb-6"
        >
          &larr; Back to Events
        </Link>

        <div className="relative rounded-3xl overflow-hidden mb-8" style={{ aspectRatio: "16/7" }}>
          <img src={bannerUrl} alt={event.title} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/40 to-transparent" />
          <div className="absolute top-4 left-5 flex items-center gap-2 flex-wrap">
            <span className={`font-headline text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-full ${status.style}`}>
              {status.label}
            </span>
            <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted bg-dark/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
              {EVENT_TYPE_LABELS[event.type]}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <h1 className="font-headline text-4xl lg:text-5xl font-black italic tracking-tighter text-light leading-none mb-3">
              {event.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 font-headline text-sm font-medium uppercase tracking-widest text-muted">
                <MapPin className="w-4 h-4 text-primary" />
                {event.location}, {STATE_LABELS[event.state]}
              </span>
              <span className="flex items-center gap-1.5 font-headline text-sm font-medium uppercase tracking-widest text-muted">
                <Calendar className="w-4 h-4 text-primary" />
                {formatEventDate(event.date)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">

            <div>
              <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Event Overview</h2>
              <p className="text-sm font-medium text-muted leading-relaxed">{event.description}</p>
            </div>

            {event.ticketDrops && event.ticketDrops.length > 0 && (
              <div>
                <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Pricing</h2>
                <div className="space-y-2">
                  {event.ticketDrops.map((drop, i) => (
                    <div key={i} className="flex items-center justify-between bg-dark-light rounded-lg px-6 py-4">
                      <div>
                        <p className="font-headline text-sm font-bold text-light">{drop.label}</p>
                        {drop.date && (
                          <p className="font-headline text-xs text-muted uppercase tracking-widest">{drop.date}</p>
                        )}
                      </div>
                      <span className="font-headline text-2xl font-black italic text-primary">{drop.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="space-y-4">
            <div className="bg-dark rounded-xl p-6">
              <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-4">Event Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-1">Date</p>
                  <p className="font-headline text-base font-black italic text-light">{formatEventDate(event.date)}</p>
                </div>
                <div>
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-1">Time</p>
                  <p className="font-headline text-base font-black italic text-light">
                    {formatTime(event.time)}
                    {event.endTime && ` \u2014 ${formatTime(event.endTime)}`}
                  </p>
                </div>
                <div>
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-1">Location</p>
                  <p className="font-headline text-base font-black italic text-light">{event.location}</p>
                  <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">{event.city}, {STATE_LABELS[event.state]}</p>
                </div>
                <div>
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-1">Format</p>
                  <p className="font-headline text-base font-black italic text-light">{formatCompetitionFormat(event.format)}</p>
                </div>
                <div>
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-1">Level</p>
                  <p className="font-headline text-base font-black italic text-light">
                    {event.level === "elite" ? "Elite" : event.level === "beginner" ? "Beginner" : "Open"}
                  </p>
                </div>
                {event.organizer && (
                  <div>
                    <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-1">Organiser</p>
                    <p className="font-headline text-base font-black italic text-light">{event.organizer}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {event.registrationUrl && (
                <Button asChild variant="machined" size="ctaLg">
                  <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer">
                    Register Now
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" size="ctaLg">
                <Link href={`https://maps.google.com/?q=${encodeURIComponent(
                  event.location + ", " + event.city + ", Australia"
                )}`} target="_blank" rel="noopener noreferrer">
                  <MapPin className="w-4 h-4" />
                  View on Maps
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
