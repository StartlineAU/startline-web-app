import Image from "next/image";
import Link from "next/link";
import { MapPin, Calendar, ExternalLink, Trophy, Clock, Ticket, FileText, ArrowUpRight } from "lucide-react";
import BackToEventsLink from "@/components/event/BackToEventsLink";
import EventGallery from "@/components/EventGallery";
import EventReviewsSection from "@/components/EventReviewsSection";
import OrganiserIdentity from "@/components/OrganiserIdentity";
import SaveEventButton from "@/components/SaveEventButton";
import ShareEventButton from "@/components/ShareEventButton";
import { Button } from "@/components/ui/button";
import type { EventDetailData } from "@/lib/event-detail";
import { isFreeEvent, todayIso } from "@/lib/event-types";
import { describeTiers, parseTiers, REFUND_PROCESS_COPY } from "@/lib/refund-policy";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { STATE_LABELS } from "@/types";
import {
  formatEventDate,
  formatEventDateRange,
  formatLongDate,
  formatTime,
  formatCompetitionFormat,
  formatLevel,
  formatDiscipline,
} from "@/lib/utils";

/**
 * The event information screen.
 *
 * `page` is /events/[id]. `panel` is the same screen rendered beside the
 * results on the events listing (issue #309), so it lays itself out against
 * the width of its container rather than the viewport — the listing pane is
 * desktop-wide but far from viewport-wide — and swaps the back link for a way
 * through to the full page.
 */
export default function EventDetailView({
  data,
  variant = "page",
}: {
  data: EventDetailData;
  variant?: "page" | "panel";
}) {
  const { event, prizePool, organiserName, organiserRating, organiserReviews } = data;
  const isPanel = variant === "panel";

  const today = todayIso();
  const drops = (event.ticketDrops ?? []).map((drop) => {
    const closes = drop.closes || drop.date;
    return { ...drop, closes, isClosed: !!closes && closes < today };
  });

  const hasRegistration =
    !!event.registrationUrl ||
    (event.registrationType === "startline" && !!event.ticketDrops && event.ticketDrops.length > 0);

  return (
    <div className={isPanel ? "@container" : undefined}>

      {/* ── Banner ── */}
      <div
        className="relative overflow-hidden w-full"
        style={isPanel ? { aspectRatio: "16/7", maxHeight: "260px" } : { aspectRatio: "4/3", maxHeight: "420px" }}
      >
        <Image
          src={event.image}
          alt={event.title}
          fill
          className="object-cover"
          sizes={isPanel ? "(max-width: 1024px) 100vw, 60vw" : "100vw"}
        />
        {/* The panel's banner is a wide, short crop, so the title sits over
            more of the photo than it does on the page and needs a heavier
            scrim. Note the stops name `darker`, not `dark-darker`: the latter
            is not a gradient colour Tailwind knows, so the page's overlay
            below renders fully transparent (pre-existing, left alone here). */}
        <div className={`absolute inset-0 bg-gradient-to-t ${
          isPanel ? "from-darker via-darker/80 to-darker/30" : "from-dark-darker via-dark-darker/50 to-transparent"
        }`} />

        {/* Title overlaid at bottom of banner */}
        <div className="absolute bottom-0 left-0 right-0 pb-5">
          <div className={isPanel ? "px-5" : "max-w-[1440px] mx-auto px-4 sm:px-6"}>
            <span className="inline-block font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-1 rounded-full mb-3">
              {formatDiscipline(event.discipline)}
            </span>
            <h1 className={`font-headline font-black italic tracking-tighter text-light leading-tight mb-2 ${
              isPanel ? "text-2xl @2xl:text-3xl" : "text-[28px] sm:text-4xl lg:text-5xl"
            }`}>
              {event.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-muted">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                {event.location}, {STATE_LABELS[event.state]}
              </span>
              <span className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-muted">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {event.endDate && event.endDate !== event.date
                  ? formatEventDateRange(event.date, event.endDate)
                  : formatEventDate(event.date)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className={isPanel ? "px-5 py-5" : "max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8"}>
        {isPanel ? (
          <Link
            href={`/events/${event.slug ?? event.id}`}
            className="inline-flex items-center gap-2 font-headline text-xs font-bold uppercase tracking-widest border border-dark-lighter text-light hover:border-primary hover:text-primary px-4 py-2 rounded-full transition-colors mb-6"
          >
            Open full page <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <BackToEventsLink />
        )}

        <div className={`grid gap-6 ${isPanel ? "grid-cols-1 @3xl:grid-cols-3" : "grid-cols-1 lg:grid-cols-3 lg:gap-8"}`}>

          {/* ── Main content — after the details card on mobile, first on desktop ── */}
          <div className={`space-y-6 sm:space-y-8 ${
            isPanel ? "order-2 @3xl:order-none @3xl:col-span-2" : "order-2 lg:order-none lg:col-span-2"
          }`}>

            <div>
              <h2 className="font-headline text-lg font-black uppercase tracking-widest text-primary mb-3">Event Overview</h2>
              <div
                className="text-sm font-medium text-muted leading-relaxed
                  [&_h3]:font-headline [&_h3]:font-black [&_h3]:text-base [&_h3]:text-light [&_h3]:mt-4 [&_h3]:mb-1
                  [&_h4]:font-headline [&_h4]:font-bold [&_h4]:text-sm [&_h4]:text-light [&_h4]:mt-3 [&_h4]:mb-1
                  [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-0.5"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description) }}
              />
            </div>

            {prizePool && (
              <div className="bg-dark rounded-xl px-5 sm:px-6 py-5 flex items-center gap-4">
                <Trophy className="w-7 h-7 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-headline text-xl font-black text-primary leading-tight">
                    ${prizePool.amount} prize pool
                  </p>
                  {prizePool.details && (
                    <p className="font-headline text-[11px] font-medium uppercase tracking-widest text-muted mt-1">
                      {prizePool.details}
                    </p>
                  )}
                </div>
              </div>
            )}

            {drops.length > 0 && (
              <div>
                <h2 className="font-headline text-lg font-black uppercase tracking-widest text-primary mb-3">Pricing</h2>
                <div className="space-y-2">
                  {drops.map((drop, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between bg-dark rounded-xl px-4 sm:px-6 py-4 ${
                        drop.isClosed ? "opacity-50" : ""
                      }`}
                    >
                      <div>
                        <p className="font-headline text-sm font-bold text-light flex items-center gap-2 flex-wrap">
                          {drop.label || "General admission"}
                          {drop.isClosed && (
                            <span className="font-headline text-[9px] font-bold uppercase tracking-widest text-muted border border-dark-lighter px-2 py-0.5 rounded-full">
                              Closed
                            </span>
                          )}
                        </p>
                        {drop.startTime && (
                          <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Wave start {formatTime(drop.startTime)}
                          </p>
                        )}
                        {drop.closes && (
                          <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">
                            {drop.isClosed ? "Closed" : "Closes"} {formatLongDate(drop.closes)}
                          </p>
                        )}
                      </div>
                      <span className={`font-headline text-2xl font-black italic ${drop.isClosed ? "text-muted line-through" : "text-primary"}`}>
                        {drop.price === "0" ? "Free" : `$${drop.price}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {event.photos && event.photos.length > 0 && (
              <div>
                <h2 className="font-headline text-lg font-black uppercase tracking-widest text-primary mb-3">Gallery</h2>
                <EventGallery images={event.photos} title={event.title} />
              </div>
            )}

            <EventReviewsSection
              organiserId={event.organiserId}
              organiserName={organiserName}
              organiserLogoUrl={event.organiser?.logoUrl}
              rating={organiserRating}
              reviews={organiserReviews}
            />

          </div>

          {/* ── Sidebar: CTAs + details — first on mobile so key facts aren't buried ── */}
          <div className={`space-y-4 ${isPanel ? "order-1 @3xl:order-none" : "order-1 lg:order-none"}`}>
            {/* CTAs — top of sidebar so they're visible above the fold on desktop.
                The page hides them on mobile (sticky bar instead); the panel has
                no sticky bar, so it always shows them. */}
            <div className="flex flex-col gap-3">
              <div className={`flex-col gap-3 ${isPanel ? "flex" : "hidden lg:flex"}`}>
                {event.registrationType === "startline" && event.ticketDrops && event.ticketDrops.length > 0 && (
                  <Button asChild variant="machined" size="ctaLg">
                    <Link href={`/events/${event.id}/register`}>
                      Register Now
                      <Ticket className="w-4 h-4" />
                    </Link>
                  </Button>
                )}
                {event.registrationUrl && (
                  <Button asChild variant="machined" size="ctaLg">
                    <a href={event.registrationUrl ?? undefined} target="_blank" rel="noopener noreferrer">
                      Register Now
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                )}
                <Button asChild variant="outline" size="ctaLg">
                  <Link href={`https://maps.google.com/?q=${encodeURIComponent(
                    (event.address || event.location) + ", " + event.city + ", Australia"
                  )}`} target="_blank" rel="noopener noreferrer">
                    <MapPin className="w-4 h-4" />
                    View on Maps
                  </Link>
                </Button>
              </div>
              <div className="flex items-center justify-center gap-4 border border-dark-lighter rounded-xl py-2.5 px-4">
                <div className="flex items-center gap-2">
                  <SaveEventButton eventId={event.id} />
                  <span className="font-headline text-xs font-bold uppercase tracking-widest text-muted">Save</span>
                </div>
                <div className="w-px h-5 bg-dark-lighter" />
                <div className="flex items-center gap-2">
                  <ShareEventButton eventId={event.id} slug={event.slug} title={event.title} />
                  <span className="font-headline text-xs font-bold uppercase tracking-widest text-muted">Share</span>
                </div>
              </div>
            </div>

            <div className="bg-dark rounded-xl p-5 sm:p-6">
              <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-4">Event Details</h3>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Date</p>
                  <p className="font-headline text-base font-black italic text-light">
                    {event.endDate && event.endDate !== event.date
                      ? formatEventDateRange(event.date, event.endDate)
                      : formatEventDate(event.date)}
                  </p>
                </div>
                <div>
                  <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Time</p>
                  <p className="font-headline text-base font-black italic text-light">
                    {formatTime(event.time)}
                    {event.endTime && ` — ${formatTime(event.endTime)}`}
                  </p>
                </div>
                <div>
                  <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Location</p>
                  <p className="font-headline text-base font-black italic text-light">{event.location}</p>
                  {event.address && (
                    <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">{event.address}</p>
                  )}
                  <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">{event.city}, {STATE_LABELS[event.state]}</p>
                </div>
                <div>
                  <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Format</p>
                  <p className="font-headline text-base font-black italic text-light">{formatCompetitionFormat(event.format)}</p>
                </div>
                {event.categories && event.categories.length > 0 && (
                  <div>
                    <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-1">Divisions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {event.categories.map((c) => (
                        <span key={c} className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 px-2 py-1 rounded-md">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Intensity</p>
                  <p className="font-headline text-base font-black italic text-light">{formatLevel(event.level)}</p>
                </div>
                {((event.cap != null && event.cap > 0) || event.minAge != null) && (
                  <div className="grid grid-cols-2 gap-3">
                    {event.cap != null && event.cap > 0 && (
                      <div>
                        <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Participant Cap</p>
                        <p className="font-headline text-base font-black italic text-light">{event.cap.toLocaleString()}</p>
                      </div>
                    )}
                    {event.minAge != null && (
                      <div>
                        <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">Minimum Age</p>
                        <p className="font-headline text-base font-black italic text-light">
                          {event.minAge === 0 ? "All ages" : `${event.minAge}+`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {event.organizer && (
                  <div>
                    <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-1.5">Organiser</p>
                    <OrganiserIdentity
                      organiserId={event.organiserId}
                      name={event.organizer}
                      logoUrl={event.organiser?.logoUrl}
                      rating={organiserRating}
                      action="View profile"
                    />
                  </div>
                )}
              </div>
            </div>

            {event.informationPdfs && event.informationPdfs.length > 0 && (
              <div className="bg-dark rounded-xl p-5 sm:p-6">
                <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-3">Event information</h3>
                <ul className="space-y-3">
                  {event.informationPdfs.map((pdf, i) => (
                    <li key={`${pdf.url}-${i}`}>
                      <a
                        href={pdf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        {pdf.label || pdf.name || "Download PDF"}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* A free event takes no money, so there is no policy to publish. */}
            {!isFreeEvent(event.ticketDrops) && (
            <div className="bg-dark rounded-xl p-5 sm:p-6">
              <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">Refund &amp; Transfer Policy</h3>
              <ul className="space-y-1">
                {describeTiers(parseTiers(event.refundTiers)).map((line, i) => (
                  <li key={i} className="text-sm font-medium text-muted leading-relaxed">{line}</li>
                ))}
              </ul>
              {event.refundPolicy && (
                <p className="text-sm font-medium text-muted leading-relaxed mt-2">{event.refundPolicy}</p>
              )}
              <p className="text-[13px] text-muted-dark leading-relaxed mt-3">{REFUND_PROCESS_COPY}</p>
            </div>
            )}

          </div>
        </div>
      </section>

      {/* ── Mobile sticky bottom CTA bar — page only; the panel is desktop ── */}
      {!isPanel && hasRegistration && (
        <>
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-darker border-t border-dark-lighter px-4 py-3 safe-area-bottom">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {event.ticketDrops && event.ticketDrops.length > 0 && (
                  <>
                    <p className="font-headline text-[10px] uppercase tracking-widest text-muted">From</p>
                    <p className="font-headline text-xl font-black italic text-primary leading-none">
                      {event.fromPrice === 0 ? "Free" : `$${event.fromPrice ?? event.ticketDrops[0].price}`}
                    </p>
                  </>
                )}
              </div>
              {event.registrationType === "startline" ? (
                <Link
                  href={`/events/${event.id}/register`}
                  className="flex items-center justify-center gap-2 bg-primary text-dark font-headline text-sm font-black uppercase tracking-widest px-6 h-12 rounded-xl flex-shrink-0 active:scale-[0.97] transition-transform"
                >
                  Register Now
                  <Ticket className="w-4 h-4" />
                </Link>
              ) : (
                <a
                  href={event.registrationUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-primary text-dark font-headline text-sm font-black uppercase tracking-widest px-6 h-12 rounded-xl flex-shrink-0 active:scale-[0.97] transition-transform"
                >
                  Register Now
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Spacer so sticky bar doesn't cover content on mobile */}
          <div className="lg:hidden h-20" />
        </>
      )}

    </div>
  );
}
