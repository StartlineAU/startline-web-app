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
  id: string;
  eventId: string;
  status: string;
  athleteName: string;
  paidCents: number;
  ticketCents: number;
  /** What the change-of-mind policy returns today (lib/refund-policy.ts). */
  refundAmountCents: number;
  /** The athlete whose place it is, or the buyer who paid for it. */
  canRefund: boolean;
  eventCancelled: boolean;
  event: { title: string; eventDate: string; city: string | null; state: string | null };
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

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
  if (!entries.some((e) => e.canRefund)) {
    return "You can only request a refund for your own entry, or one you paid for.";
  }
  entries = entries.filter((e) => e.canRefund);
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
  registrationId: string;
  athleteName: string;
  athleteEmail: string;
  event: Entry["event"] & { id: string };
}

/** One option per entry: a buyer can hold several places at one event. */
function optionFor(registrationId: string, athleteName: string, event: Entry["event"]): SelectOption {
  const place = [event.city, event.state].filter(Boolean).join(", ");
  return {
    value: registrationId,
    label: event.title,
    hint: [athleteName, formatEventDate(event.eventDate), place].filter(Boolean).join(" · "),
  };
}

export default function RefundForm({
  initialRegistrationId,
  initialEventId,
  linkedEntry,
  linkExpired,
}: {
  /** Activity's "Request a refund" link names the entry. */
  initialRegistrationId: string | null;
  /** Older links name only the event. */
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
  const [wantedRegistrationId] = useState(initialRegistrationId);
  const [wantedEventId] = useState(initialEventId);
  const [linked] = useState(linkedEntry);

  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Both null until edited, so the account's or the entry's details show by default.
  const [nameInput, setName] = useState<string | null>(null);
  const name = nameInput ?? linked?.athleteName ?? "";
  const [emailInput, setEmail] = useState<string | null>(null);
  const email = emailInput ?? user?.email ?? linked?.athleteEmail ?? "";
  const [pickedId, setPickedId] = useState<string | null>(null);
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

  // Every paid place the visitor may ask about: their own, and any they bought
  // for someone else on a group purchase (the refund goes to the buyer's card).
  const refundable = useMemo(
    () => (entries ?? []).filter(
      (r) => r.canRefund && r.status === "CONFIRMED" && r.paidCents > 0 && !r.eventCancelled,
    ),
    [entries],
  );
  const options = useMemo<SelectOption[]>(() => {
    const out: SelectOption[] = [];
    if (linked) out.push(optionFor(linked.registrationId, linked.athleteName, linked.event));
    for (const r of refundable) {
      if (r.id === linked?.registrationId) continue;
      out.push(optionFor(r.id, r.athleteName, r.event));
    }
    return out;
  }, [refundable, linked]);

  // Prefilled from Activity or an email, until the athlete picks another. An
  // event-only link picks the event's entry when there is just one.
  const preselected = useMemo(() => {
    if (wantedRegistrationId && options.some((o) => o.value === wantedRegistrationId)) return wantedRegistrationId;
    if (linked) return linked.registrationId;
    if (wantedEventId) {
      const forEvent = refundable.filter((r) => r.eventId === wantedEventId);
      if (forEvent.length === 1) return forEvent[0].id;
    }
    return "";
  }, [wantedRegistrationId, wantedEventId, options, linked, refundable]);
  const registrationId = pickedId ?? preselected;
  const picked = refundable.find((r) => r.id === registrationId) ?? null;
  const viaLink = !!linked && registrationId === linked.registrationId;

  const wantedNotice = useMemo(() => {
    if (!entries || preselected) return null;
    const forWanted = entries.filter((e) =>
      wantedRegistrationId ? e.id === wantedRegistrationId : wantedEventId ? e.eventId === wantedEventId : false,
    );
    return forWanted.length ? ineligibleReason(forWanted) : null;
  }, [entries, preselected, wantedRegistrationId, wantedEventId]);

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
          Your reference is <span className="text-light">{ticketId.slice(0, 8)}</span>. Expect a response at {viaLink && linked ? linked.athleteEmail : email} within 3 business days.
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
    if (!registrationId) {
      setError("Choose the entry you want refunded.");
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
          registrationId,
          // The email link proves the entry is theirs when their account cannot.
          refundToken: viaLink && linked ? linked.token : undefined,
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
        <span className={labelCls}>Entry</span>
        <SelectMenu
          id="refund-entry"
          size="sm"
          ariaLabel="Entry"
          placeholder="Choose an entry"
          value={registrationId}
          onChange={(v) => { setPickedId(v); setError(""); }}
          options={options}
          invalid={!!error && !registrationId}
        />
        {(wantedNotice ?? expiredNotice) && (
          <p className="text-[12.5px] text-muted-dark">{wantedNotice ?? expiredNotice}</p>
        )}
        {picked && (
          <p data-testid="refund-quote" className="text-[12.5px] text-muted-light">
            Under the refund policy today you would get {money(picked.refundAmountCents)} of the{" "}
            {money(picked.ticketCents)} ticket price. You paid {money(picked.paidCents)} in all.
          </p>
        )}
      </div>
      <label className="grid gap-1.5">
        <span className={labelCls}>Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelCls}>Email</span>
        {/* A request from an email link is recorded against the entry's own address. */}
        {viaLink && linked ? (
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
        The refund policy gives nothing back within 24 hours of the event start, and never refunds the booking fee. Australian Consumer Law rights still apply at any time if the event is cancelled or significantly changed.
      </p>
      <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-machined text-dark font-headline text-[13px] font-black uppercase tracking-[0.12em] shadow-machined disabled:opacity-50">
        <Send className="w-4 h-4" />
        {submitting ? "Sending…" : "Request a refund"}
      </button>
    </form>
  );
}
