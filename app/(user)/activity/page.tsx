"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, UserCheck, Flag, Megaphone, Undo2, Banknote, CheckCheck, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserEvent } from "@/types";
import type { PublicEvent } from "@/lib/event-types";
import { getRegisteredEventIds, fetchSavedEventIds } from "@/lib/client-lists";
import { toUserEvents } from "@/lib/user-events";
import { useApiResource } from "@/hooks/useApiResource";
import { formatInEventTimeZone } from "@/lib/event-time";
import type { CheckInState } from "@/lib/check-in-window";
import { useAuthContext } from "@/context/AuthContext";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type FollowingOrganiser = {
  followId: string;
  id: string;
  orgName: string | null;
  logoUrl: string | null;
  followers: number;
  eventsHosted: number;
  registrations: number;
};

type RegStatus = "CONFIRMED" | "REFUND_REQUESTED" | "REFUNDED";
type RegMeta = {
  id: string;
  eventId: string;
  status: RegStatus;
  athleteName: string;
  wave: string | null;
  bibNumber: string | null;
  checkedInAt: string | null;
  checkInState: CheckInState;
  checkInOpensAt: string | null;
  checkInClosesAt: string | null;
  timeZone: string;
  paidCents: number;
  refundAmountCents: number;
  refundPercent: number;
  outsidePolicy: boolean;
};

type UserNotif = {
  id: string;
  type?: string;
  title: string;
  body: string;
  eventId: string | null;
  read: boolean;
  createdAt: string;
};

/* One Bell on every row told you nothing about what had happened. Each type now
   gets its own silhouette - start flag, megaphone, return arrow, banknote - so
   the kind of update is readable before you read the text. Mirrors the organiser
   nav's notification tiles. */
const USER_NOTIF_STYLE: Record<string, { Icon: LucideIcon; tone: string }> = {
  WAVE_UPDATE:              { Icon: Flag,      tone: "bg-white/[0.06] text-light"   },
  ORGANISER_EVENT_LIVE:     { Icon: Megaphone, tone: "bg-primary/10 text-primary"   },
  ORGANISER_REFUND_REQUEST: { Icon: Undo2,     tone: "bg-amber-400/10 text-amber-300" },
  REFUND_PROCESSED:         { Icon: Banknote,  tone: "bg-primary/10 text-primary"   },
};

const FALLBACK_NOTIF_STYLE = { Icon: Bell, tone: "bg-white/[0.06] text-muted" };

function NotificationsPanel({
  notifs,
  onMarkAllRead,
}: {
  notifs: UserNotif[];
  onMarkAllRead: () => void;
}) {
  const unread = notifs.filter((n) => !n.read).length;
  if (notifs.length === 0) return null;
  return (
    <div className="mb-9">
      <div className="flex items-center justify-between mb-3">
        <p className="inline-flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary">
          <Bell className="w-3.5 h-3.5" strokeWidth={2.4} /> Updates
          {unread > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-dark text-[10px] font-black">
              {unread}
            </span>
          )}
        </p>
        {unread > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="scroll-slim space-y-2 max-h-[22rem] overflow-y-auto overscroll-contain pr-1">
        {notifs.map((n) => {
          const href =
            n.type === "ORGANISER_EVENT_LIVE" && n.eventId
              ? `/events/${n.eventId}`
              : null;
          const className = `flex items-start gap-3 rounded-xl border px-4 py-3 ${
            n.read ? "bg-dark border-dark-lighter" : "bg-primary/[0.07] border-primary/25"
          }${href ? " hover:border-primary/40 transition-colors" : ""}`;
          const { Icon, tone } = USER_NOTIF_STYLE[n.type ?? ""] ?? FALLBACK_NOTIF_STYLE;
          const inner = (
            <>
              <span className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${tone}`}>
                <Icon className="w-4 h-4" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-headline text-[13px] font-bold text-light">{n.title}</p>
                <p className="text-[12.5px] text-muted leading-relaxed mt-0.5">{n.body}</p>
                {n.type === "ORGANISER_EVENT_LIVE" && n.eventId && (
                  <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary mt-1.5">
                    View event
                  </p>
                )}
              </div>
              {!n.read && <span className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />}
            </>
          );
          return href ? (
            <Link key={n.id} href={href} className={className}>
              {inner}
            </Link>
          ) : (
            <div key={n.id} className={className}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function currentCheckInState(meta: RegMeta, now: Date): CheckInState {
  if (meta.checkInState === "unavailable") return "unavailable";
  if (!meta.checkInOpensAt || !meta.checkInClosesAt) return meta.checkInState;
  const opensAt = Date.parse(meta.checkInOpensAt);
  const closesAt = Date.parse(meta.checkInClosesAt);
  if (Number.isNaN(opensAt) || Number.isNaN(closesAt)) return "unavailable";
  if (now.getTime() >= closesAt) return "closed";
  if (now.getTime() < opensAt) return "before";
  return "open";
}

function formatCheckInTime(iso: string, timeZone: string) {
  return formatInEventTimeZone(new Date(iso), timeZone, {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit",
  });
}

function CheckInAction({ meta, now }: { meta: RegMeta; now: Date }) {
  if (meta.status !== "CONFIRMED") return null;

  if (meta.checkedInAt) {
    return (
      <span className="inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
        <CheckCheck className="w-3.5 h-3.5" />
        Checked in {formatCheckInTime(meta.checkedInAt, meta.timeZone)}
      </span>
    );
  }

  const state = currentCheckInState(meta, now);
  if (state === "open") {
    return (
      <Link
        href={`/checkin/${meta.eventId}?registration=${encodeURIComponent(meta.id)}`}
        data-testid="activity-check-in"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-headline text-[10px] font-black uppercase tracking-widest text-dark hover:bg-primary-light transition-colors"
      >
        <UserCheck className="w-3.5 h-3.5" /> Check in
      </Link>
    );
  }
  if (state === "before" && meta.checkInOpensAt) {
    return (
      <span className="inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-muted">
        <Clock className="w-3.5 h-3.5" />
        Check-in opens {formatCheckInTime(meta.checkInOpensAt, meta.timeZone)}
      </span>
    );
  }
  if (state === "closed") {
    return (
      <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
        Check-in closed
      </span>
    );
  }
  return null;
}

function RegisteredCard({
  event,
  metas,
  now,
  onRequestRefund,
}: {
  event: UserEvent;
  metas: RegMeta[];
  now: Date;
  onRequestRefund: (meta: RegMeta) => void;
}) {
  const cardStatus = metas.length === 0
    ? "CONFIRMED"
    : metas.length === 1
      ? metas[0].status
      : "MIXED";

  return (
    <div
      className="flex flex-col"
      data-testid="registration-entry"
      data-event-id={event.id}
      data-registration-status={cardStatus}
    >
      <EventCard
        event={event}
        cardClassName="rounded-b-none border-b-0 group-hover:ring-0"
      />
      <div className="bg-dark-light border border-dark-lighter rounded-b-xl px-4 py-3">
        {metas.length === 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark leading-none">
                Your Wave
              </p>
              <p className="font-headline text-[12px] font-bold uppercase tracking-widest text-light mt-1 truncate">
                —
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark leading-none">
                Bib
              </p>
              <p className="font-headline text-[13px] font-black mt-1 text-muted-dark">—</p>
            </div>
          </div>
        )}

        {metas.map((meta, index) => {
          const withdrawn = meta.status !== "CONFIRMED";
          const refunded = meta.status === "REFUNDED";
          const freeEntry = meta.paidCents === 0;
          const refundIssued = refunded && !freeEntry;

          // Withdrawal is the athlete's action, so the copy names them rather than
          // saying "cancelled", which can be mistaken for the event being cancelled.
          const withdrawnHeading = refundIssued
            ? "Refund issued."
            : freeEntry
              ? "You withdrew from this event."
              : "You withdrew.";
          const withdrawnDetail = refundIssued
            ? null
            : freeEntry
              ? "Your spot has been released."
              : "Your refund request is awaiting the organiser’s decision.";

          return (
            <div
              key={meta.id}
              className={index > 0 ? "mt-3 pt-3 border-t border-dashed border-dark-lighter" : undefined}
            >
              {metas.length > 1 && (
                <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-light mb-2">
                  {meta.athleteName}
                </p>
              )}

              {withdrawn ? (
                <div className="flex items-start gap-3">
                  <span
                    className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${
                      refundIssued ? "bg-primary/10 text-primary" : "bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    {refundIssued ? (
                      <Banknote className="w-4 h-4" strokeWidth={2.5} />
                    ) : (
                      <Undo2 className="w-4 h-4" strokeWidth={2.5} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`font-headline text-[11px] font-bold uppercase tracking-widest ${
                        refundIssued ? "text-primary" : "text-amber-300"
                      }`}
                    >
                      {withdrawnHeading}
                    </p>
                    {withdrawnDetail && (
                      <p className="text-[12px] text-muted leading-relaxed mt-1">{withdrawnDetail}</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark leading-none">
                        Your Wave
                      </p>
                      <p className="font-headline text-[12px] font-bold uppercase tracking-widest text-light mt-1 truncate">
                        {meta.wave || "—"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark leading-none">
                        Bib
                      </p>
                      <p className={`font-headline text-[13px] font-black mt-1 ${meta.bibNumber ? "text-primary" : "text-muted-dark"}`}>
                        {meta.bibNumber ? `#${meta.bibNumber}` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <CheckInAction meta={meta} now={now} />
                    {freeEntry ? (
                      <button
                        type="button"
                        onClick={() => onRequestRefund(meta)}
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
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrganiserCard({
  organiser,
  onUnfollow,
}: {
  organiser: FollowingOrganiser;
  onUnfollow: (followId: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function unfollow() {
    setBusy(true);
    try {
      const res = await fetch(`/api/public/organisers/${organiser.id}/follow`, {
        method: "DELETE",
      });
      if (res.ok) onUnfollow(organiser.followId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col bg-dark border border-dark-lighter rounded-2xl p-5">
      <Link href={`/organisers/${organiser.id}`} className="group flex items-center gap-4">
        <span className="relative w-14 h-14 rounded-xl overflow-hidden bg-dark-lighter shrink-0">
          {organiser.logoUrl ? (
            <Image src={organiser.logoUrl} alt={`${organiser.orgName} logo`} fill className="object-cover" sizes="56px" />
          ) : (
            <span className="w-full h-full flex items-center justify-center font-headline text-xl font-black text-primary">
              {(organiser.orgName ?? "O").charAt(0)}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-headline text-lg font-black tracking-tighter text-light group-hover:text-primary transition-colors leading-tight truncate">
            {organiser.orgName ?? "Organiser"}
          </span>
          <span className="flex items-center gap-2 mt-1 font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
            <span>{organiser.followers} followers</span>
            <span className="text-muted-dark">·</span>
            <span>{organiser.eventsHosted} events</span>
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={unfollow}
        disabled={busy}
        className="mt-4 inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-dark-lighter text-muted hover:text-light hover:border-primary/50 font-headline text-[11px] font-bold uppercase tracking-widest transition-colors"
      >
        <UserCheck className="w-4 h-4" />
        {busy ? "Unfollowing..." : "Unfollow"}
      </button>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-5 py-2" role="status" aria-label="Loading" data-testid="activity-skeleton">
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-dark border border-dark-lighter rounded-2xl overflow-hidden">
            <Skeleton className="h-40 w-full rounded-none" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: "registered" | "saved" | "following" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="font-headline text-xl font-black tracking-tighter text-light">
        Nothing here yet.
      </p>
      <p className="font-headline text-sm text-light text-center max-w-xs leading-relaxed">
        {tab === "registered"
          ? "Register your interest in events to see them here."
          : tab === "saved"
            ? "Save events with the heart icon to find them later."
            : "Follow organisers to keep up with their upcoming events."}
      </p>
      <Link
        href="/events"
        className="mt-3 inline-flex items-center h-[46px] px-6 rounded-xl bg-machined text-dark font-headline text-[13px] font-black uppercase tracking-[0.12em] shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all duration-150"
      >
        Find Events
      </Link>
    </div>
  );
}

export default function ActivityPage() {
  const { status } = useAuthContext();
  const [activeTab, setActiveTab] = useState<"registered" | "saved" | "following">("registered");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [registeredIds, setRegisteredIds] = useState(() => getRegisteredEventIds());
  const [following, setFollowing] = useState<FollowingOrganiser[]>([]);
  const [regMeta, setRegMeta] = useState<Record<string, RegMeta[]>>({});
  const [now, setNow] = useState(() => new Date());
  // The saved list, registrations and follows come from the account fetch,
  // which only starts once auth resolves. Until it lands every list is empty,
  // so without this the page showed "nothing here yet" before the real entries
  // appeared (#514).
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [notifs, setNotifs] = useState<UserNotif[]>([]);
  const [refundTarget, setRefundTarget] = useState<{ meta: RegMeta; title: string } | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState("");

  const confirmRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    setRefundError("");
    try {
      const res = await fetch(`/api/user/registrations/${refundTarget.meta.id}/refund-request`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefundError(json.error ?? "Could not withdraw your entry.");
        return;
      }
      const { eventId } = refundTarget.meta;
      // Take the server's frozen snapshot rather than keeping the local estimate,
      // so the card shows exactly what was recorded against the entry.
      setRegMeta((prev) => ({
        ...prev,
        [eventId]: (prev[eventId] ?? []).map((entry) =>
          entry.id === refundTarget.meta.id
            ? {
                ...entry,
                status: (json.status === "REFUNDED" ? "REFUNDED" : "REFUND_REQUESTED") as RegStatus,
                refundAmountCents: json.refundAmountCents ?? entry.refundAmountCents ?? 0,
                refundPercent: json.refundPercent ?? entry.refundPercent ?? 0,
                outsidePolicy: json.outsidePolicy ?? entry.outsidePolicy ?? false,
              }
            : entry
        ),
      }));
      setRefundTarget(null);
    } catch {
      setRefundError("Could not withdraw your entry. Check your connection.");
    } finally {
      setRefunding(false);
    }
  };


  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    fetch("/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
  };

  const fetchEvents = useCallback(async (signal: AbortSignal) => {
    const ids = Array.from(new Set([...savedIds, ...registeredIds].filter(Boolean)));
    const key = [...ids].sort().join(",");
    if (ids.length === 0) return { key, events: [] };

    // The event listing API caps one request; chunk an unusually long list so a
    // visitor who saved many events still sees all of them.
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

    const pages = await Promise.all(
      chunks.map((chunk) =>
        fetch(`/api/events?ids=${encodeURIComponent(chunk.join(","))}`, { signal })
          .then((response) => (response.ok ? response.json() : { events: [] }))
          .then((data: { events?: PublicEvent[] }) => data.events ?? []),
      ),
    );
    const found = pages.flat();
    const byId = new Map(found.map((event) => [event.id, event]));
    return { key, events: toUserEvents(ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))) };
  }, [savedIds, registeredIds]);

  const eventKey = Array.from(new Set([...savedIds, ...registeredIds].filter(Boolean))).sort().join(",");
  const { data: loaded, loading: eventsLoading } = useApiResource<{ key: string; events: UserEvent[] }>(
    fetchEvents,
    { key: eventKey },
  );
  const events = loaded?.events ?? [];
  // The hook only flips `loading` in an effect, so the render where the ids
  // change still holds the previous (often empty) result. Comparing keys
  // keeps that one render on the skeleton too.
  const eventsStale = loaded?.key !== eventKey;
  // A signed-out visitor has only the local list, so there is nothing to wait for.
  const accountPending = status === "loading" || (status === "authenticated" && !accountLoaded);
  const listsLoading = accountPending || eventsLoading || eventsStale;

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    Promise.all([
      fetchSavedEventIds(),
      fetch("/api/user/following").then(r => r.ok ? r.json() : null),
      fetch("/api/user/notifications").then(r => r.ok ? r.json() : null),
      fetch("/api/user/registrations").then(r => r.ok ? r.json() : null),
    ])
      .then(([ids, followingData, notifData, regData]) => {
        if (cancelled) return;
        setSavedIds(ids);
        if (followingData?.organisers) setFollowing(followingData.organisers);
        if (Array.isArray(notifData?.notifications)) setNotifs(notifData.notifications);
        if (regData?.registrations) {
          const meta: Record<string, RegMeta[]> = {};
          const regIds: string[] = [];
          for (const r of regData.registrations as RegMeta[]) {
            const entry: RegMeta = {
              id: r.id,
              eventId: r.eventId,
              status: r.status,
              athleteName: r.athleteName,
              wave: r.wave,
              bibNumber: r.bibNumber,
              checkedInAt: r.checkedInAt ?? null,
              checkInState: r.checkInState,
              checkInOpensAt: r.checkInOpensAt ?? null,
              checkInClosesAt: r.checkInClosesAt ?? null,
              timeZone: r.timeZone,
              paidCents: r.paidCents ?? 0,
              refundAmountCents: r.refundAmountCents ?? 0,
              refundPercent: r.refundPercent ?? 0,
              outsidePolicy: r.outsidePolicy ?? false,
            };
            (meta[r.eventId] ??= []).push(entry);
            regIds.push(r.eventId);
          }
          setRegMeta(meta);
          if (regIds.length > 0) {
            setRegisteredIds((prev) => Array.from(new Set([...prev, ...regIds])));
          }
        }
      })
      .finally(() => {
        if (!cancelled) setAccountLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  function onStorage(e: StorageEvent) {
    if (e.key === "startline_registered_interest") {
      setRegisteredIds(getRegisteredEventIds());
    }
  }
  function onLocalChange() {
    setRegisteredIds(getRegisteredEventIds());
  }

  useEffect(() => {
    window.addEventListener("storage", onStorage);
    window.addEventListener("startline-lists-changed", onLocalChange);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("startline-lists-changed", onLocalChange);
      window.clearInterval(timer);
    };
  }, []);

  const savedEvents = events.filter((e) => savedIds.includes(String(e.id)));
  const metasFor = (eventId: string) => regMeta[eventId] ?? [];
  const confirmedMetas = (eventId: string) =>
    metasFor(eventId).filter((meta) => meta.status === "CONFIRMED");
  const withdrawnMetas = (eventId: string) =>
    metasFor(eventId).filter((meta) => meta.status !== "CONFIRMED");

  const registeredEvents = events.filter((e) => {
    const id = String(e.id);
    return registeredIds.includes(id) && (metasFor(id).length === 0 || confirmedMetas(id).length > 0);
  });
  // Withdrawn and refunded entries stay in Activity so the athlete can see what
  // happened to them, but they are no longer live registrations and must not
  // count in the Registered badge.
  const withdrawnEvents = events.filter((e) => {
    const id = String(e.id);
    return registeredIds.includes(id) && withdrawnMetas(id).length > 0;
  });

  const tabCounts = {
    registered: registeredEvents.length,
    saved: savedEvents.length,
    following: following.length,
  };
  const tabLabels: Record<string, string> = {
    registered: "Registered",
    saved: "Saved",
    following: "Following",
  };

  return (
    <main className="min-h-screen bg-dark-darker">
      <div className="max-w-[1440px] mx-auto px-6 pt-20 pb-16">
        <div className="mb-8">
          <h1 className="font-headline text-5xl sm:text-[52px] font-black tracking-tighter text-light leading-none">
            Your activity<br /><span className="text-primary">calendar.</span>
          </h1>
        </div>

        <NotificationsPanel notifs={notifs} onMarkAllRead={markAllRead} />

        <div className="flex gap-2.5 mb-6">
          {(["registered", "saved", "following"] as const).map((id) => {
            const on = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 px-[18px] py-2.5 rounded-full font-headline text-[12px] font-bold uppercase tracking-widest transition-all duration-150 ${
                  on
                    ? "bg-primary/10 border border-primary/40 text-primary"
                    : "bg-transparent border border-dark-lighter text-muted hover:text-light"
                }`}
              >
                {tabLabels[id]}
                <span
                  className={`font-headline text-[11px] font-bold ${on ? "text-primary" : "text-muted-dark"}`}
                >
                  {(id === "following" ? accountPending : listsLoading) ? (
                    <Skeleton className="inline-block h-3 w-3 align-middle" aria-hidden />
                  ) : (
                    tabCounts[id]
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {(activeTab === "following" ? accountPending : listsLoading) ? (
          <ActivitySkeleton />
        ) : activeTab === "following" ? (
          following.length === 0 ? (
            <EmptyState tab="following" />
          ) : (
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
            >
              {following.map((o) => (
                <OrganiserCard
                  key={o.followId}
                  organiser={o}
                  onUnfollow={(followId) => setFollowing((prev) => prev.filter((x) => x.followId !== followId))}
                />
              ))}
            </div>
          )
        ) : activeTab === "registered" ? (
          <>
            {registeredEvents.length === 0 ? (
              <EmptyState tab="registered" />
            ) : (
              <div
                className="grid gap-5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
              >
                {registeredEvents.map((event) => (
                  <RegisteredCard
                    key={event.id}
                    event={event}
                    metas={confirmedMetas(String(event.id))}
                    now={now}
                    onRequestRefund={(meta) => {
                      setRefundError("");
                      setRefundTarget({ meta, title: event.title });
                    }}
                  />
                ))}
              </div>
            )}

            {withdrawnEvents.length > 0 && (
              <section aria-labelledby="withdrawn-entries-heading" className="mt-10">
                <div className="flex items-center gap-3 mb-3">
                  <h2
                    id="withdrawn-entries-heading"
                    className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-muted"
                  >
                    Withdrawn entries
                  </h2>
                  <span className="font-headline text-[11px] font-bold text-muted-dark">
                    {withdrawnEvents.length}
                  </span>
                </div>
                <div
                  className="grid gap-5"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
                >
                  {withdrawnEvents.map((event) => (
                    <RegisteredCard
                      key={event.id}
                      event={event}
                      metas={withdrawnMetas(String(event.id))}
                      now={now}
                      onRequestRefund={(meta) => {
                        setRefundError("");
                        setRefundTarget({ meta, title: event.title });
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : savedEvents.length === 0 ? (
          <EmptyState tab="saved" />
        ) : (
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
          >
            {savedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!refundTarget} onOpenChange={(open) => { if (!open) setRefundTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw your entry?</DialogTitle>
            <DialogDescription>
              {refundTarget?.title}. You will come out of the start list and free your spot.
            </DialogDescription>
          </DialogHeader>

          {refundTarget && (
            <div className="space-y-3">
              <div className="rounded-md bg-dark px-4 py-3">
                <p className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">
                  Free entry
                </p>
                <p className="text-[13px] text-muted leading-relaxed mt-1">
                  This entry cost nothing, so there is no refund to make. Withdrawing your entry gives
                  your spot back to the event and takes you out of the start list.
                </p>
                <p className="text-[12px] text-muted-dark leading-relaxed mt-2">
                  Paid an entry fee? Ask for a refund through Support.
                </p>
              </div>
            </div>
          )}

          {refundError && <p className="text-[13px] text-red-300">{refundError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefundTarget(null)}>Keep my spot</Button>
            <Button onClick={confirmRefund} disabled={refunding}>
              {refunding ? "Withdrawing…" : "Withdraw my entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
