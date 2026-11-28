"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Send, Ticket } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";
import SelectMenu, { type SelectOption } from "@/components/ui/SelectMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthContext } from "@/context/AuthContext";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const inputCls =
  "w-full bg-dark-light border border-dark-lighter rounded-[10px] px-[15px] py-3 text-[14.5px] text-light placeholder:text-placeholder outline-none focus:border-primary";
const labelCls = "font-headline font-bold text-[10.5px] uppercase tracking-[0.15em] text-light";

/** The slice of `/api/user/registrations` this form reads. */
type Entry = {
  eventId: string;
  status: string;
  paidCents: number;
  /** Not a place bought for someone else on a group purchase. */
  ownEntry: boolean;
  eventCancelled: boolean;
  event: { title: string; eventDate: string; city: string | null; state: string | null };
};

function formatEventDate(isoDate: string) {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Why an entry the athlete has cannot be picked here. Free entries withdraw
 * from Activity, a cancelled event refunds itself, and a request already in
 * flight should not be raised twice.
 */
function ineligibleReason(entries: Entry[]): string | null {
  if (!entries.some((e) => e.ownEntry)) {
    return "You can only request a refund for your own entry. Anyone you entered on a group ticket asks for theirs from their own account.";
  }
  entries = entries.filter((e) => e.ownEntry);
  if (entries.some((e) => e.eventCancelled)) {
    return "This event was cancelled, so everything you paid is being refunded automatically.";
  }
  if (entries.some((e) => e.status === "REFUND_REQUESTED" || e.status === "REFUNDED")) {
    return "A refund for this event has already been requested.";
  }
  if (entries.every((e) => e.paidCents === 0)) {
    return "This entry was free, so there is nothing to refund. You can withdraw it from Activity.";
  }
  return "This entry cannot be refunded from here.";
}

/** An entry the page verified from a confirmation email's refund link. */
export interface LinkedEntry {
  token: string;
  athleteName: string;
  athleteEmail: string;
  event: Entry["event"] & { id: string };
}

function optionFor(eventId: string, event: Entry["event"]): SelectOption {
  const place = [event.city, event.state].filter(Boolean).join(", ");
  return {
    value: eventId,
    label: event.title,
    hint: [formatEventDate(event.eventDate), place].filter(Boolean).join(" · "),
  };
}

export default function RefundForm({
  initialEventId,
  linkedEntry,
  linkExpired,
}: {
  initialEventId: string | null;
  /**
   * The entry a confirmation email's link stands for. It counts as the
   * athlete's own whichever account they are signed in with, or none.
   */
  linkedEntry: LinkedEntry | null;
  /** A refund link was followed but no longer matches its entry. */
  linkExpired: boolean;
}) {
  const { status, user } = useAuthContext();
  // Captured once: opening the sign-in modal strips the query string, and the
  // event the athlete came for should still be chosen after they sign in.
  const [wantedEventId] = useState(initialEventId);
  const [linked] = useState(linkedEntry);

  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Both null until edited, so the account's or the entry's details show by default.
  const [nameInput, setName] = useState<string | null>(null);
  const name = nameInput ?? linked?.athleteName ?? "";
  const [emailInput, setEmail] = useState<string | null>(null);
  const email = emailInput ?? user?.email ?? linked?.athleteEmail ?? "";
  const [pickedEventId, setEventId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/user/registrations")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { registrations: Entry[] }) => {
        if (cancelled) return;
        setEntries(data.registrations);
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [status]);

  // Only the athlete's own places, one option per event. A group purchase
  // lists everyone the buyer entered, but each person asks for their own refund.
  const options = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>();
    const out: SelectOption[] = [];
    if (linked) {
      seen.add(linked.event.id);
      out.push(optionFor(linked.event.id, linked.event));
    }
    for (const r of entries ?? []) {
      if (!r.ownEntry || r.status !== "CONFIRMED" || r.paidCents === 0 || r.eventCancelled || seen.has(r.eventId)) continue;
      seen.add(r.eventId);
      out.push(optionFor(r.eventId, r.event));
    }
    return out;
  }, [entries, linked]);

  // Prefilled from Activity, if that event can be refunded, until the athlete picks another.
  const eventId =
    pickedEventId ?? (wantedEventId && options.some((o) => o.value === wantedEventId) ? wantedEventId : "");

  const wantedNotice = useMemo(() => {
    if (!wantedEventId || !entries || options.some((o) => o.value === wantedEventId)) return null;
    const forEvent = entries.filter((e) => e.eventId === wantedEventId);
    return forEvent.length ? ineligibleReason(forEvent) : null;
  }, [wantedEventId, entries, options]);

  const expiredNotice = linkExpired
    ? "That refund link no longer matches its entry, usually because the entry's details changed."
    : null;

  // A refund link is enough on its own: the athlete may have no account at all.
  if (status === "unauthenticated" && !linked) {
    return (
      <div className="rounded-xl border border-dark-lighter bg-dark p-6">
        <h2 className="font-headline text-[20px] font-black uppercase tracking-wide text-light">Sign in to continue</h2>
        <p className="text-[14px] text-muted mt-2 leading-relaxed">
          {expiredNotice ? `${expiredNotice} ` : ""}Sign in with the account you entered with and choose the event from your entries.
        </p>
        <Link
          href="/refunds?signin=true"
          className="mt-5 bg-machined shadow-machined inline-flex items-center gap-2 text-dark font-headline text-[13px] font-black uppercase tracking-[0.12em] py-3 px-6 rounded-xl"
        >
          Sign in <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (status === "loading" || (status === "authenticated" && !entries && !loadError)) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <Skeleton className="h-[72px] w-full rounded-[10px]" />
        <Skeleton className="h-[72px] w-full rounded-[10px]" />
        <Skeleton className="h-[72px] w-full rounded-[10px]" />
        <Skeleton className="h-[150px] w-full rounded-[10px]" />
      </div>
    );
  }

  if (loadError && !linked) {
    return <p className="text-[13px] text-red-300">Could not load your entries. Refresh the page to try again.</p>;
  }

  if (ticketId) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-6">
        <h2 className="font-headline text-[20px] font-black uppercase tracking-wide text-light">Request sent</h2>
        <p className="text-[14px] text-muted-light mt-2 leading-relaxed">
          Your reference is <span className="text-light">{ticketId.slice(0, 8)}</span>. Expect a response at {linked && eventId === linked.event.id ? linked.athleteEmail : email} within 3 business days.
        </p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="rounded-xl border border-dark-lighter bg-dark p-6">
        <Ticket className="w-6 h-6 text-muted" />
        <h2 className="font-headline text-[20px] font-black uppercase tracking-wide text-light mt-3">No paid entries to refund</h2>
        <p className="text-[14px] text-muted mt-2 leading-relaxed">
          {wantedNotice ?? "Refunds are for paid entries to events that are still going ahead. Free entries can be withdrawn from Activity."}
        </p>
        <Link
          href="/activity"
          className="mt-4 inline-flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:text-light transition-colors"
        >
          Go to Activity <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) {
      setError("Choose the event you want refunded.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          requestType: "refund",
          eventId,
          // The email link proves the entry is theirs when their account cannot.
          refundToken: linked && eventId === linked.event.id ? linked.token : undefined,
          reason: reason.trim(),
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send that. Please try again.");
        return;
      }
      setTicketId(data.id);
    } catch {
      setError("Could not send that. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5">
        <span className={labelCls}>Event</span>
        <SelectMenu
          id="refund-event"
          size="sm"
          ariaLabel="Event"
          placeholder="Choose an event you entered"
          value={eventId}
          onChange={(v) => { setEventId(v); setError(""); }}
          options={options}
          invalid={!!error && !eventId}
        />
        {(wantedNotice ?? expiredNotice) && (
          <p className="text-[12.5px] text-muted-dark">{wantedNotice ?? expiredNotice}</p>
        )}
      </div>
      <label className="grid gap-1.5">
        <span className={labelCls}>Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelCls}>Email</span>
        {/* A request from an email link is recorded against the entry's own address. */}
        {linked && eventId === linked.event.id ? (
          <input type="email" value={linked.athleteEmail} readOnly aria-readonly="true" className={`${inputCls} text-muted`} />
        ) : (
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        )}
      </label>
      <label className="grid gap-1.5">
        <span className={labelCls}>Reason</span>
        <textarea required rows={5} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="Why you're asking for a refund." />
      </label>
      {TURNSTILE_SITE_KEY && (
        <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={setTurnstileToken} />
      )}
      {error && <p className="text-[13px] text-red-300">{error}</p>}
      <p className="text-[12px] text-muted-dark leading-relaxed">
        Refunds are not available within 24 hours of the event start. Australian Consumer Law rights still apply if the event is cancelled or significantly changed.
      </p>
      <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-machined text-dark font-headline text-[13px] font-black uppercase tracking-[0.12em] shadow-machined disabled:opacity-50">
        <Send className="w-4 h-4" />
        {submitting ? "Sending…" : "Request a refund"}
      </button>
    </form>
  );
}
