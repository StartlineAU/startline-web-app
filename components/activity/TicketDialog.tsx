"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, MapPin, Megaphone, MessageCircle, UserPlus } from "lucide-react";
import type { AthleteTicket, TicketAnnouncement, TicketEntry } from "@/lib/athlete-ticket";
import { formatInEventTimeZone } from "@/lib/event-time";
import { formatEventDateRange, formatTime } from "@/lib/utils";
import { STATE_LABELS, type AustralianState } from "@/types";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import OrganiserIdentity from "@/components/OrganiserIdentity";
import OrganiserContactDetails from "@/components/OrganiserContactDetails";
import { useApiResource } from "@/hooks/useApiResource";
import { CheckInAction, withdrawnCopy, type RegMeta } from "@/components/activity/registration-meta";

// Dates arrive as ISO strings over JSON.
type Json<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };
type TicketJson = Omit<AthleteTicket, "entries" | "announcements"> & {
  entries: Json<TicketEntry>[];
  announcements: Json<TicketAnnouncement>[];
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; ticket: TicketJson };

/**
 * The athlete's ticket, over Activity (#552): the event at a glance, each
 * entry's wave and bib, check-in and withdrawal, and the organiser's latest
 * announcements. One screen, no navigation; the full event page is a link at
 * the foot.
 */
export default function TicketDialog({
  eventId,
  eventTitle,
  metas,
  now,
  onClose,
  onWithdraw,
  onAddDetails,
}: {
  /** The event whose ticket is open, or null when closed. */
  eventId: string | null;
  /** Shown while the ticket loads. */
  eventTitle: string;
  /**
   * Activity's own view of these entries. It already carries the check-in
   * window and what was paid, and it updates the moment an entry is withdrawn.
   */
  metas: RegMeta[];
  now: Date;
  onClose: () => void;
  /** Free entries withdraw in place; Activity asks to confirm first. */
  onWithdraw: (meta: RegMeta) => void;
  /** A team place left for later; Activity opens the details form. */
  onAddDetails: (meta: RegMeta) => void;
}) {
  const load = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(`/api/user/tickets/${encodeURIComponent(eventId ?? "")}`, { signal });
    if (!res.ok) {
      // The confirmation email now lands here, so a link opened as the wrong
      // account must say why rather than look like a broken page.
      if (res.status === 404) {
        throw new Error(
          "This entry isn't on this Startline account. It may have been withdrawn, or it belongs to a different account.",
        );
      }
      if (res.status === 401) throw new Error("Your session has expired. Sign in again to open this ticket.");
      throw new Error("Could not load your ticket. Try again in a moment.");
    }
    return (await res.json()) as TicketJson;
  }, [eventId]);

  const { data, error } = useApiResource<TicketJson>(load, { key: eventId, enabled: !!eventId });
  // The hook keeps the last event's ticket until the next reply lands, so a
  // ticket for any other event counts as still loading.
  const ticket = data && data.event.id === eventId ? data : null;
  const state: State = ticket
    ? { status: "ready", ticket }
    : error
      ? { status: "error", message: error }
      : { status: "loading" };

  return (
    <Dialog open={!!eventId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        data-testid="ticket-dialog"
        className="max-w-[calc(100vw-2rem)] sm:max-w-lg p-0 overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col"
      >
        <div className="px-5 pt-5 pb-4 pr-12 border-b border-dark-lighter">
          <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
            Your ticket
          </p>
          <DialogTitle className="mt-1 text-2xl leading-tight">
            {ticket?.event.title ?? eventTitle}
          </DialogTitle>
          {ticket ? (
            <DialogDescription asChild>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
                <EventLine ticket={ticket} />
              </div>
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Your entry, wave, bib and announcements.</DialogDescription>
          )}
        </div>

        <div className="overflow-y-auto overscroll-contain">
          {state.status === "loading" && <TicketSkeleton />}

          {state.status === "error" && (
            <p className="px-5 py-6 text-[13px] text-red-300">{state.message}</p>
          )}

          {ticket && (
            <>
              <ul className="divide-y divide-dashed divide-dark-lighter">
                {ticket.entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    showsWaves={ticket.event.showsWaves}
                    showsBibs={ticket.event.showsBibs}
                    meta={metas.find((m) => m.id === entry.id) ?? null}
                    now={now}
                    onWithdraw={onWithdraw}
                    onAddDetails={onAddDetails}
                  />
                ))}
              </ul>
              <Announcements ticket={ticket} />
              <ContactSection ticket={ticket} />
            </>
          )}
        </div>

        {ticket && (
          <div className="flex items-center justify-between gap-3 border-t border-dark-lighter px-5 py-3">
            {/* Same identity block as the event page's Organiser section. */}
            <OrganiserIdentity
              organiserId={ticket.event.organiser.id}
              name={ticket.event.organiser.orgName ?? "Organiser"}
              logoUrl={ticket.event.organiser.logoUrl}
              rating={ticket.event.organiser.rating}
              action="View profile"
              className="min-w-0"
            />
            <Link
              href={`/events/${ticket.event.id}`}
              data-testid="ticket-event-link"
              // Same pill as "Back to Events" on the event page (#309), so every
              // link that leaves the screen looks like the same control.
              className="inline-flex shrink-0 items-center gap-2 font-headline text-xs font-bold uppercase tracking-widest border border-dark-lighter text-light hover:border-primary hover:text-primary px-4 py-2 rounded-full transition-colors"
            >
              Event page <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventLine({ ticket }: { ticket: TicketJson }) {
  const { event } = ticket;
  const place = [
    event.venue,
    event.city,
    STATE_LABELS[event.state as AustralianState] ?? event.state.toUpperCase(),
  ].filter(Boolean).join(", ");
  const item = "inline-flex items-center gap-1.5";
  const icon = "w-3.5 h-3.5 shrink-0 text-primary";
  return (
    <>
      <span className={item}>
        <CalendarDays className={icon} />
        {formatEventDateRange(event.eventDate, event.endDate ?? undefined)}
      </span>
      <span className={item}>
        <Clock className={icon} />
        {formatTime(event.startTime)}
      </span>
      <span className={`${item} min-w-0`}>
        <MapPin className={icon} />
        <span className="truncate">{place}</span>
      </span>
    </>
  );
}

function EntryRow({
  entry,
  showsWaves,
  showsBibs,
  meta,
  now,
  onWithdraw,
  onAddDetails,
}: {
  entry: Json<TicketEntry>;
  /** The organiser shares start waves / bibs with athletes (#566). */
  showsWaves: boolean;
  showsBibs: boolean;
  meta: RegMeta | null;
  now: Date;
  onWithdraw: (meta: RegMeta) => void;
  onAddDetails: (meta: RegMeta) => void;
}) {
  // Activity's copy wins: it changes as soon as the athlete withdraws.
  const withdrawn = (meta?.status ?? entry.status) !== "CONFIRMED";
  const label = "font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark";

  if (withdrawn) {
    const copy = meta ? withdrawnCopy(meta) : { heading: "Withdrawn.", detail: null, refundIssued: false };
    return (
      <li data-testid="ticket-entry-withdrawn" className="px-5 py-4">
        <p className="truncate font-headline text-[13px] font-bold text-light">{entry.athleteName}</p>
        <p
          className={`mt-1 font-headline text-[11px] font-bold uppercase tracking-widest ${
            copy.refundIssued ? "text-primary" : "text-amber-300"
          }`}
        >
          {copy.heading}
        </p>
        {copy.detail && <p className="mt-0.5 text-[12px] text-muted">{copy.detail}</p>}
      </li>
    );
  }

  // Nobody is named on this place yet, so there is no wave, bib or check-in
  // to show: only the step that names them.
  if (meta?.detailsPending) {
    return (
      <li data-testid="ticket-entry-pending" className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate font-headline text-[13px] font-bold text-light">
            {meta.teamName ? `Team ${meta.teamName}` : "Team place"}
          </p>
          <p className="mt-1 font-headline text-[11px] font-bold uppercase tracking-widest text-amber-300">
            Details needed
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAddDetails(meta)}
          className="inline-flex shrink-0 items-center gap-1.5 h-8 px-3 rounded-lg border border-primary/40 text-primary font-headline text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" /> Add details
        </button>
      </li>
    );
  }

  // The tier bought and what it cost, e.g. "General · $45.00" or "General · Free".
  const price = meta ? (meta.paidCents === 0 ? "Free" : `$${(meta.paidCents / 100).toFixed(2)}`) : null;
  const tier = [entry.ticketLabel, price].filter(Boolean).join(" · ");

  return (
    <li data-testid="ticket-entry" className="px-5 py-4">
      <p className="truncate font-headline text-[15px] font-bold text-light">
        {entry.athleteName}
        {tier && (
          <span data-testid="ticket-tier" className="ml-2 font-headline text-[10px] font-bold uppercase tracking-widest text-muted">
            {tier}
          </span>
        )}
      </p>

      {/* Only what the organiser shares (#566): no placeholder for a wave or
          bib this event will never hand out. */}
      {(showsWaves || showsBibs) && (
        <div className="mt-3 flex items-end justify-between gap-4">
          {showsWaves ? (
            <div className="min-w-0">
              <p className={label}>Wave</p>
              {entry.waveLabel ? (
                <>
                  <p data-testid="ticket-wave" className="mt-1 truncate font-headline text-[15px] font-bold uppercase tracking-widest text-light">
                    {entry.waveLabel}
                  </p>
                  {entry.waveStartTime && (
                    <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
                      Starts {formatTime(entry.waveStartTime)}
                    </p>
                  )}
                </>
              ) : (
                <p data-testid="ticket-wave" className="mt-1 text-[12.5px] text-muted">Not assigned yet</p>
              )}
            </div>
          ) : (
            <span />
          )}
          {showsBibs && (
            <div className="shrink-0 text-right">
              <p className={label}>Bib</p>
              {entry.bibNumber ? (
                <p data-testid="ticket-bib" className="mt-1 font-headline text-4xl font-black leading-none text-primary">
                  #{entry.bibNumber}
                </p>
              ) : (
                <p data-testid="ticket-bib" className="mt-1 text-[12.5px] text-muted">TBC</p>
              )}
            </div>
          )}
        </div>
      )}

      {meta && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <CheckInAction meta={meta} now={now} />
          {/* A free entry withdraws here; a paid one opens the refund form with this entry chosen.
              The athlete or the buyer who paid for the place can ask. */}
          {meta.paidCents === 0 ? (
            <button
              type="button"
              onClick={() => onWithdraw(meta)}
              className="ml-auto font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark hover:text-red-300 transition-colors"
            >
              Withdraw my entry
            </button>
          ) : meta.canRefund ? (
            <Link
              href={`/refunds?registration=${encodeURIComponent(meta.id)}`}
              className="ml-auto font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark hover:text-light transition-colors"
            >
              Request a refund
            </Link>
          ) : null}
        </div>
      )}
    </li>
  );
}

/** Only what the organiser chose to show; nothing at all when they show none. */
function ContactSection({ ticket }: { ticket: TicketJson }) {
  const contact = ticket.event.organiser.contact;
  if (!contact) return null;
  return (
    <section aria-labelledby="ticket-contact" data-testid="ticket-contact" className="border-t border-dark-lighter px-5 py-4">
      <h3
        id="ticket-contact"
        className="inline-flex items-center gap-2 font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary"
      >
        <MessageCircle className="w-3.5 h-3.5" strokeWidth={2.4} /> Contact the organiser
      </h3>
      <OrganiserContactDetails contact={contact} compact className="mt-3" />
    </section>
  );
}

function Announcements({ ticket }: { ticket: TicketJson }) {
  return (
    <section aria-labelledby="ticket-announcements" className="border-t border-dark-lighter px-5 py-4">
      <h3
        id="ticket-announcements"
        className="inline-flex items-center gap-2 font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary"
      >
        <Megaphone className="w-3.5 h-3.5" strokeWidth={2.4} /> Announcements
      </h3>
      {ticket.announcements.length === 0 ? (
        <p data-testid="ticket-no-announcements" className="mt-2 text-[12.5px] text-muted">
          Nothing from the organiser yet.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {ticket.announcements.map((a) => (
            <li key={a.id} data-testid="ticket-announcement">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate font-headline text-[13px] font-bold text-light">{a.title}</p>
                <time
                  dateTime={a.createdAt}
                  className="shrink-0 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark"
                >
                  {formatInEventTimeZone(new Date(a.createdAt), ticket.event.timeZone, {
                    day: "numeric", month: "short",
                  })}
                </time>
              </div>
              {/* Sanitised server-side in lib/athlete-ticket.ts. */}
              <div
                className="mt-1 text-[12.5px] text-muted leading-relaxed line-clamp-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-light"
                dangerouslySetInnerHTML={{ __html: a.bodyHtml }}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function TicketSkeleton() {
  return (
    <div className="space-y-4 px-5 py-5" role="status" aria-label="Loading your ticket">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-9 w-16" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}
