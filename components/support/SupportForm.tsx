"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";
import { Send } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const inputCls =
  "w-full bg-dark-light border border-dark-lighter rounded-[10px] px-[15px] py-3 text-[14.5px] text-light placeholder:text-placeholder outline-none focus:border-primary";
const labelCls = "font-headline font-bold text-[10.5px] uppercase tracking-[0.15em] text-light";
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** One of the signed-in athlete's paid entries that a refund can be asked for. */
export interface RefundableEntry {
  id: string;
  eventTitle: string;
  eventDate: string;
  athleteName: string;
  paidCents: number;
  /** What the organisation's change-of-mind policy returns if asked today. */
  quoteCents: number;
  policyLines: string[];
  /** A request is already waiting on the organiser. */
  requested: boolean;
}

export default function SupportForm({
  signedIn = false,
  defaultName = "",
  defaultEmail = "",
  entries = [],
  initialEntryId,
  linkedEntryProblem,
}: {
  signedIn?: boolean;
  defaultName?: string;
  defaultEmail?: string;
  entries?: RefundableEntry[];
  initialEntryId?: string;
  /**
   * The page was opened for one entry (`?registration=`) that cannot take a
   * refund request here. Nothing is preselected then: picking a different
   * entry for the athlete would refund the wrong one.
   */
  linkedEntryProblem?: "requested" | "unavailable";
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [requestType, setRequestType] = useState<"refund" | "other">("refund");
  // "" means the athlete is describing the event by hand instead.
  const [entryId, setEntryId] = useState(
    initialEntryId ?? (linkedEntryProblem ? "" : (entries.find((e) => !e.requested)?.id ?? "")),
  );
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [reason, setReason] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);

  // Signing in from the prompt below: reload the server list of entries.
  const router = useRouter();
  const { status } = useAuthContext();
  useEffect(() => {
    if (!signedIn && status === "authenticated") router.refresh();
  }, [signedIn, status, router]);

  const entry = requestType === "refund" ? entries.find((e) => e.id === entryId) ?? null : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          requestType,
          ...(entry
            ? { registrationId: entry.id }
            : { eventName: eventName.trim() || undefined, eventDate: eventDate || undefined }),
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

  if (ticketId) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-6">
        <h2 className="font-headline text-[20px] font-black uppercase tracking-wide text-light">Ticket opened</h2>
        <p className="text-[14px] text-muted-light mt-2 leading-relaxed">
          Your reference is <span className="text-light">{ticketId.slice(0, 8)}</span>. Startline will reply to {email}.
          {requestType === "refund" &&
            " For a refund, the organiser decides, usually within 3 business days, and Startline issues it. We'll email you either way."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className={labelCls}>Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelCls}>Email</span>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelCls}>What do you need?</span>
        <select value={requestType} onChange={(e) => setRequestType(e.target.value as "refund" | "other")} className={inputCls}>
          <option value="refund">Refund</option>
          <option value="other">Something else</option>
        </select>
      </label>

      {requestType === "refund" && linkedEntryProblem && (
        <p role="status" data-testid="linked-entry-problem" className="text-[12px] text-amber-300">
          {linkedEntryProblem === "requested"
            ? "You have already asked for a refund on that entry. The organiser is deciding, and we will email you."
            : "That entry cannot be refunded online. Describe it below and Startline will match it by hand."}
        </p>
      )}

      {requestType === "refund" && entries.length > 0 && (
        <label className="grid gap-1.5">
          <span className={labelCls}>Entry</span>
          <select value={entryId} onChange={(e) => setEntryId(e.target.value)} className={inputCls} aria-label="Entry">
            {entries.map((en) => (
              <option key={en.id} value={en.id} disabled={en.requested}>
                {en.eventTitle} · {en.eventDate} · {en.athleteName}
                {en.requested ? " (refund already requested)" : ""}
              </option>
            ))}
            <option value="">Another entry, not listed here</option>
          </select>
        </label>
      )}

      {entry ? (
        <div className="rounded-xl border border-dark-lighter bg-dark-light p-4 grid gap-1.5" data-testid="refund-quote">
          <p className="text-[13px] text-light">
            Under the refund policy you would get back <span className="font-bold">{money(entry.quoteCents)}</span> of the{" "}
            {money(entry.paidCents)} you paid.
          </p>
          <ul className="text-[12px] text-muted list-disc pl-4">
            {entry.policyLines.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="text-[12px] text-muted-dark">
            The booking fee is not refunded under the policy. The organiser can refund more, and must refund everything
            if the event is cancelled or changed so it is no longer what you paid for.
          </p>
        </div>
      ) : (
        <>
          {requestType === "refund" && !signedIn && (
            <p className="text-[12px] text-muted">
              <Link href="/support?signin=true" className="text-primary underline">Sign in</Link> to pick your entry. A request
              without one has to be matched to your entry by hand, which takes longer.
            </p>
          )}
          <label className="grid gap-1.5">
            <span className={labelCls}>Event</span>
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Event name" className={inputCls} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelCls}>Event date</span>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} />
          </label>
        </>
      )}

      <label className="grid gap-1.5">
        <span className={labelCls}>Reason</span>
        <textarea required rows={5} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="What happened, and what you want us to do." />
      </label>
      {TURNSTILE_SITE_KEY && (
        <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={setTurnstileToken} />
      )}
      {error && <p role="alert" className="text-[13px] text-red-300">{error}</p>}
      <p className="text-[12px] text-muted-dark leading-relaxed">
        The refund policy gives nothing back within 24 hours of the event start. Australian Consumer Law rights still apply at any time if the event is cancelled or significantly changed. The organiser decides on a refund request, and Startline issues the refund. Opening a ticket does not refund you.
      </p>
      <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-machined text-dark font-headline text-[13px] font-black uppercase tracking-[0.12em] shadow-machined disabled:opacity-50">
        <Send className="w-4 h-4" />
        {submitting ? "Sending…" : "Open a ticket"}
      </button>
    </form>
  );
}
