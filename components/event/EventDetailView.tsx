import type { ReactNode } from "react";
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
import { getEventPhase } from "@/lib/event-status";
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

/* ── Shared building blocks ────────────────────────────────────
   Exported so the listing editor (EventPageEditor) dresses its
   controls in exactly the type the athlete page uses. Change the
   look here and both change together (issue #528). */

export const BANNER_TITLE_CLASS =
  "font-headline font-black italic tracking-tighter text-light leading-tight mb-2 text-[28px] sm:text-4xl lg:text-5xl";
export const BANNER_META_CLASS =
  "flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-muted";
export const DISCIPLINE_PILL_CLASS =
  "inline-block font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-1 rounded-full";
export const PRICING_ROW_CLASS = "bg-dark rounded-xl px-4 sm:px-6 py-4";
export const RICH_TEXT_CLASS =
  "text-sm font-medium text-muted leading-relaxed " +
  "[&_h3]:font-headline [&_h3]:font-black [&_h3]:text-base [&_h3]:text-light [&_h3]:mt-4 [&_h3]:mb-1 " +
  "[&_h4]:font-headline [&_h4]:font-bold [&_h4]:text-sm [&_h4]:text-light [&_h4]:mt-3 [&_h4]:mb-1 " +
  "[&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-0.5";

/** A required marker for the editor. Shown beside labels the organiser must fill in. */
export function RequiredMark() {
  return <span className="text-primary font-black ml-1" title="Required" aria-hidden="true">*</span>;
}

export function SectionHeading({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <h2 className="font-headline text-lg font-black uppercase tracking-widest text-primary mb-3">
      {children}{required && <RequiredMark />}
    </h2>
  );
}

export function SidebarCard({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-dark rounded-xl p-5 sm:p-6 ${className}`}>
      <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-4">{title}</h3>
      {children}
    </div>
  );
}

export function DetailLabel({ children }: { children: ReactNode }) {
  return <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-0.5">{children}</p>;
}

export function DetailValue({ children }: { children: ReactNode }) {
  return <p className="font-headline text-base font-black italic text-light">{children}</p>;
}

export function DetailSub({ children }: { children: ReactNode }) {
  return <p className="font-headline text-xs text-muted uppercase tracking-widest mt-0.5">{children}</p>;
}

export function PrizePoolCard({ amount, details, children }: { amount: string; details?: string | null; children?: ReactNode }) {
  return (
    <div className="bg-dark rounded-xl px-5 sm:px-6 py-5 flex items-center gap-4">
      <Trophy className="w-7 h-7 text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        {children ?? (
          <>
            <p className="font-headline text-xl font-black text-primary leading-tight">${amount} prize pool</p>
            {details && (
              <p className="font-headline text-[11px] font-medium uppercase tracking-widest text-muted mt-1">{details}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Regions of the page the listing editor swaps for its own controls. Anything
 * left out renders exactly as athletes see it. `undefined` means "use the
 * public rendering"; `null` hides the region.
 */
export type EventDetailSlots = Partial<Record<
  | "bannerMedia" | "bannerOverlay" | "discipline" | "title" | "meta" | "topLink"
  | "overview" | "prizePool" | "pricing" | "gallery" | "reviews"
  | "actions" | "details" | "information" | "refund" | "footer",
  ReactNode
>>;

function slot(slots: EventDetailSlots | undefined, key: keyof EventDetailSlots, fallback: () => ReactNode): ReactNode {
  return slots && key in slots ? slots[key] : fallback();
}

/**
 * The event information screen.
 *
 * `page` is /events/[id]. `panel` is the same screen rendered beside the
 * results on the events listing (issue #309), so it lays itself out against
 * the width of its container rather than the viewport — the listing pane is
 * desktop-wide but far from viewport-wide — and swaps the back link for a way
 * through to the full page.
 *
 * `edit` is the organiser's own view of an unsaved listing (issue #528): it
 * takes controls through `slots`, links nowhere and has no sticky register
 * bar, since there is no saved event behind it yet.
 */
export default function EventDetailView({
  data,
  variant = "page",
  hideBackLink = false,
  mode = "public",
  slots,
}: {
  data: EventDetailData;
  variant?: "page" | "panel";
  /** The admin preview supplies its own way back to the review queue. */
  hideBackLink?: boolean;
  mode?: "public" | "edit";
  slots?: EventDetailSlots;
}) {
  const { event, prizePool, organiserName, organiserRating, organiserReviews } = data;
  const isPanel = variant === "panel";
  const inert = mode !== "public";

  const today = todayIso();
  const drops = (event.ticketDrops ?? []).map((drop) => {
    const closes = drop.closes || drop.date;
    return { ...drop, closes, isClosed: !!closes && closes < today };
  });

  const phase = inert ? "upcoming" : getEventPhase(event);
  const isRunning = phase === "in_progress";
  const registrationClosed = phase !== "upcoming";
  const hasRegistration =
    !registrationClosed &&
    (!!event.registrationUrl ||
      (event.registrationType === "startline" && !!event.ticketDrops && event.ticketDrops.length > 0));
  const freeEvent = isFreeEvent(event.ticketDrops);
  // A fully free Startline event is an RSVP for the signed-in account, not a
  // ticket checkout, so the button says what the next screen will do.
  const freeRsvp = freeEvent && event.registrationType === "startline";
  const dateLabel = !event.date
    ? "Date TBC"
    : event.endDate && event.endDate !== event.date
      ? formatEventDateRange(event.date, event.endDate)
      : formatEventDate(event.date);

  return (
    <div className={isPanel ? "@container" : undefined}>

      {/* ── Banner ── */}
      <div
        className="relative overflow-hidden w-full"
        style={isPanel
          ? { aspectRatio: "16/7", maxHeight: "260px" }
          // The editor stacks an upload prompt above the title fields, which a
          // phone-width 4:3 banner has no room for.
          : { aspectRatio: "4/3", maxHeight: "420px", ...(mode === "edit" ? { minHeight: "380px" } : {}) }}
      >
        {slot(slots, "bannerMedia", () => event.image ? (
          <Image
            src={event.image}
            alt={event.title}
            fill
            unoptimized={event.image.startsWith("blob:")}
            className="object-cover"
            sizes={isPanel ? "(max-width: 1024px) 100vw, 60vw" : "100vw"}
          />
        ) : (
          <div className="absolute inset-0 placeholder-stripes scan-grid" />
        ))}
        {/* The panel's banner is a wide, short crop, so the title sits over
            more of the photo than it does on the page and needs a heavier
            scrim. Note the stops name `darker`, not `dark-darker`: the latter
            is not a gradient colour Tailwind knows, so the page's overlay
            below renders fully transparent (pre-existing, left alone here). */}
        <div className={`absolute inset-0 pointer-events-none bg-gradient-to-t ${
          isPanel ? "from-darker via-darker/80 to-darker/30" : "from-darker via-darker/50 to-transparent"
        }`} />
        {slots?.bannerOverlay}

        {/* Title overlaid at bottom of banner */}
        <div className="absolute bottom-0 left-0 right-0 pb-5 pointer-events-none">
          <div className={`pointer-events-auto ${isPanel ? "px-5" : "max-w-[1440px] mx-auto px-4 sm:px-6"}`}>
            <div className="mb-3">
              {slot(slots, "discipline", () => (
                <span className={DISCIPLINE_PILL_CLASS}>{formatDiscipline(event.discipline)}</span>
              ))}
            </div>
            {slot(slots, "title", () => (
              <h1 className={isPanel
                ? "font-headline font-black italic tracking-tighter text-light leading-tight mb-2 text-2xl @2xl:text-3xl"
                : BANNER_TITLE_CLASS}>
                {event.title}
              </h1>
            ))}
            {slot(slots, "meta", () => (
              <div className="flex flex-wrap items-center gap-3">
                <span className={BANNER_META_CLASS}>
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  {[event.location, STATE_LABELS[event.state]].filter(Boolean).join(", ")}
                </span>
                <span className={BANNER_META_CLASS}>
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {dateLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className={isPanel ? "px-5 py-5" : "max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8"}>
        {slot(slots, "topLink", () => isPanel ? (
          <Link
            href={`/events/${event.slug ?? event.id}`}
            className="inline-flex items-center gap-2 font-headline text-xs font-bold uppercase tracking-widest border border-dark-lighter text-light hover:border-primary hover:text-primary px-4 py-2 rounded-full transition-colors mb-6"
          >
            Open full page <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        ) : hideBackLink || inert ? null : (
          <BackToEventsLink />
        ))}

        <div className={`grid gap-6 ${isPanel ? "grid-cols-1 @3xl:grid-cols-3" : "grid-cols-1 lg:grid-cols-3 lg:gap-8"}`}>

          {/* ── Main content — after the details card on mobile, first on desktop ── */}
          <div className={`min-w-0 space-y-6 sm:space-y-8 ${
            isPanel ? "order-2 @3xl:order-none @3xl:col-span-2" : "order-2 lg:order-none lg:col-span-2"
          }`}>

            <div>
              <SectionHeading required={inert}>Event Overview</SectionHeading>
              {slot(slots, "overview", () => (
                <div
                  className={RICH_TEXT_CLASS}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description) }}
                />
              ))}
            </div>

            {slot(slots, "prizePool", () => prizePool && (
              <PrizePoolCard amount={prizePool.amount} details={prizePool.details} />
            ))}

            {slot(slots, "pricing", () => drops.length > 0 && (
              <div>
                <SectionHeading>Pricing</SectionHeading>
                <div className="space-y-2">
                  {drops.map((drop, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between ${PRICING_ROW_CLASS} ${
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
            ))}

            {slot(slots, "gallery", () => event.photos && event.photos.length > 0 && (
              <div>
                <SectionHeading>Gallery</SectionHeading>
                <EventGallery images={event.photos} title={event.title} />
              </div>
            ))}

            {slot(slots, "reviews", () => (
              <EventReviewsSection
                organiserId={event.organiserId}
                organiserName={organiserName}
                organiserLogoUrl={event.organiser?.logoUrl}
                rating={organiserRating}
                reviews={organiserReviews}
              />
            ))}

          </div>

          {/* ── Sidebar: CTAs + details — first on mobile so key facts aren't buried ── */}
          <div className={`min-w-0 space-y-4 ${isPanel ? "order-1 @3xl:order-none" : "order-1 lg:order-none"}`}>
            {slot(slots, "actions", () => (
              /* CTAs — top of sidebar so they're visible above the fold on desktop.
                 The page hides them on mobile (sticky bar instead); the panel and
                 the organiser's preview have no sticky bar, so they always show them. */
              <div className="flex flex-col gap-3">
                {(inert || registrationClosed || hasRegistration) && (
                <div className={`flex-col gap-3 ${isPanel || inert ? "flex" : "hidden lg:flex"}`}>
                  {registrationClosed && (
                    <div className="rounded-lg border border-dark-lighter bg-white/5 px-4 py-3 text-center">
                      <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
                        {isRunning ? "Event in progress" : "Registration closed"}
                      </div>
                    </div>
                  )}
                  {inert ? (
                    <>
                      <Button asChild variant="machined" size="ctaLg">
                        <span aria-disabled="true">
                          {event.registrationType === "external" ? "Register Now" : freeRsvp ? "I'm going" : "Register Now"}
                          {event.registrationType === "external" ? <ExternalLink className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
                        </span>
                      </Button>
                    </>
                  ) : (
                    <>
                      {!registrationClosed && event.registrationType === "startline" && event.ticketDrops && event.ticketDrops.length > 0 && (
                        <Button asChild variant="machined" size="ctaLg">
                          <Link href={`/events/${event.id}/register`}>
                            {freeRsvp ? "I'm going" : "Register Now"}
                            <Ticket className="w-4 h-4" />
                          </Link>
                        </Button>
                      )}
                      {!registrationClosed && event.registrationUrl && (
                        <Button asChild variant="machined" size="ctaLg">
                          <a href={event.registrationUrl ?? undefined} target="_blank" rel="noopener noreferrer">
                            Register Now
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </>
                  )}
                </div>
                )}
                {/* Two buttons, not one box holding two icons with captions
                    beside them: only the icons were clickable there, and the
                    captions were not part of the control (issue #309). They sit
                    straight under the register button: there is no maps link. */}
                {!inert && (
                  <div className="grid grid-cols-2 gap-3">
                    <SaveEventButton eventId={event.id} label="Save" />
                    <ShareEventButton eventId={event.id} slug={event.slug} title={event.title} label="Share" />
                  </div>
                )}
              </div>
            ))}

            <SidebarCard title="Event Details">
              {slot(slots, "details", () => (
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <DetailLabel>Date</DetailLabel>
                    <DetailValue>{dateLabel}</DetailValue>
                  </div>
                  <div>
                    <DetailLabel>Time</DetailLabel>
                    <DetailValue>
                      {event.time ? formatTime(event.time) : "TBC"}
                      {event.endTime && ` — ${formatTime(event.endTime)}`}
                    </DetailValue>
                  </div>
                  <div>
                    <DetailLabel>Location</DetailLabel>
                    <DetailValue>{event.location}</DetailValue>
                    {event.address && <DetailSub>{event.address}</DetailSub>}
                    {(event.city || event.state) && (
                      <DetailSub>{[event.city, STATE_LABELS[event.state]].filter(Boolean).join(", ")}</DetailSub>
                    )}
                  </div>
                  <div>
                    <DetailLabel>Format</DetailLabel>
                    <DetailValue>{formatCompetitionFormat(event.format)}</DetailValue>
                  </div>
                  {event.categories && event.categories.length > 0 && (
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-1">Divisions</p>
                      {/* Outline pills in the same idiom as the pricing rows'
                          "Closed" tag and the listing's filter chips. The tinted
                          green squares they replace matched nothing else on the
                          page (issue #309). */}
                      <div className="flex flex-wrap gap-1.5">
                        {event.categories.map((c) => (
                          <span key={c} className="font-headline text-[11px] font-bold uppercase tracking-widest text-light border border-dark-lighter px-2.5 py-1 rounded-full">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <DetailLabel>Intensity</DetailLabel>
                    <DetailValue>{formatLevel(event.level)}</DetailValue>
                  </div>
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
              ))}
            </SidebarCard>

            {slot(slots, "information", () => event.informationPdfs && event.informationPdfs.length > 0 && (
              <SidebarCard title="Event information">
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
              </SidebarCard>
            ))}

            {/* A free event takes no money, so there is no policy to publish. */}
            {slot(slots, "refund", () => !freeEvent && (
              <SidebarCard title="Refund & Transfer Policy">
                <ul className="space-y-1">
                  {describeTiers(parseTiers(event.refundTiers)).map((line, i) => (
                    <li key={i} className="text-sm font-medium text-muted leading-relaxed">{line}</li>
                  ))}
                </ul>
                {event.refundPolicy && (
                  <p className="text-sm font-medium text-muted leading-relaxed mt-2">{event.refundPolicy}</p>
                )}
                <p className="text-[13px] text-muted-dark leading-relaxed mt-3">{REFUND_PROCESS_COPY}</p>
              </SidebarCard>
            ))}

          </div>
        </div>

        {slots?.footer}
      </section>

      {/* ── Mobile sticky bottom CTA bar — public page only ── */}
      {!isPanel && !inert && hasRegistration && (
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
                  {freeRsvp ? "I'm going" : "Register Now"}
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
