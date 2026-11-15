"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, MapPin, Megaphone } from "lucide-react";
import type { AthleteTicket, TicketAnnouncement, TicketEntry } from "@/lib/athlete-ticket";
import { formatInEventTimeZone } from "@/lib/event-time";
import { formatEventDateRange, formatTime } from "@/lib/utils";
import { STATE_LABELS, type AustralianState } from "@/types";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
}) {
  const load = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(`/api/user/tickets/${encodeURIComponent(eventId ?? "")}`, { signal });
    if (!res.ok) throw new Error("Could not load your ticket. Try again in a moment.");
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
                    meta={metas.find((m) => m.id === entry.id) ?? null}
                    now={now}
                    onWithdraw={onWithdraw}
                  />
                ))}
              </ul>
              <Announcements ticket={ticket} />
            </>
          )}
        </div>

        {ticket && (
          <div className="flex items-center justify-between gap-3 border-t border-dark-lighter px-5 py-3">
            <span className="truncate font-headline text-[10px] font-bold uppercase tracking-widest text-muted">
              {ticket.event.organiser.orgName ?? "Organiser"}
            </span>
            <Link
              href={`/events/${ticket.event.id}`}
              data-testid="ticket-event-link"
              className="inline-flex shrink-0 items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors"
            >
              Event page <ArrowRight className="w-3 h-3" />
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
  meta,
  now,
  onWithdraw,
}: {
  entry: Json<TicketEntry>;
  meta: RegMeta | null;
  now: Date;
  onWithdraw: (meta: RegMeta) => void;
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

  return (
    <li data-testid="ticket-entry" className="px-5 py-4">
      <p className="truncate font-headline text-[15px] font-bold text-light">
        {entry.athleteName}
        {entry.ticketLabel && (
          <span className="ml-2 font-headline text-[10px] font-bold uppercase tracking-widest text-muted">
            {entry.ticketLabel}
          </span>
        )}
      </p>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={label}>Wave</p>
          <p data-testid="ticket-wave" className="mt-1 truncate font-headline text-[15px] font-bold uppercase tracking-widest text-light">
            {entry.waveLabel ?? "Not assigned yet"}
          </p>
          {entry.waveStartTime && (
            <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
              Starts {formatTime(entry.waveStartTime)}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={label}>Bib</p>
          <p
            data-testid="ticket-bib"
            className={`mt-1 font-headline font-black leading-none ${
              entry.bibNumber ? "text-4xl text-primary" : "text-[15px] text-muted-dark"
            }`}
          >
            {entry.bibNumber ? `#${entry.bibNumber}` : "TBC"}
          </p>
        </div>
      </div>

      {meta && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <CheckInAction meta={meta} now={now} />
          {/* A free entry withdraws here; a paid one is refunded through Support. */}
          {meta.paidCents === 0 ? (
            <button
              type="button"
              onClick={() => onWithdraw(meta)}
              className="ml-auto font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark hover:text-red-300 transition-colors"
            >
              Withdraw my entry
            </button>
          ) : (
            <Link
              href="/support"
              className="ml-auto font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark hover:text-light transition-colors"
            >
              Request a refund
            </Link>
          )}
        </div>
      )}
    </li>
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
