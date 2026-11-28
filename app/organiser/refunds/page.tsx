"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Undo2, X } from "lucide-react";
import {
  APPROVE_REASONS,
  DECLINE_REASONS,
  REFUND_NOTE_MAX,
  REFUND_REASON_HINT,
  REFUND_REASON_LABEL,
  refundNoteRequired,
  type ApproveReason,
  type DeclineReason,
} from "@/lib/refund-decision-reasons";

type Reason = ApproveReason | DeclineReason;

interface Ticket {
  id: string;
  name: string;
  email: string;
  eventName: string | null;
  eventDate: string | null;
  reason: string;
  status: "OPEN" | "APPROVED" | "DECLINED" | "REFUNDED";
  organiserDecision: "APPROVED" | "DECLINED" | null;
  organiserNote: string | null;
  organiserReason: Reason | null;
  adminDecisionKind: "NO_RESPONSE" | "OVERRIDE" | null;
  adminNote: string | null;
  organiserResponseDue: string;
  createdAt: string;
  registrationId: string | null;
  policyRefundPercent: number | null;
  policyRefundCents: number | null;
  fullRefundCents: number | null;
  refundType: "POLICY" | "FULL" | null;
  refundCents: number | null;
  refundError: string | null;
}

const DUE = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" });
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const STATUS_STYLE: Record<Ticket["status"], string> = {
  OPEN: "text-amber-300 bg-amber-300/10",
  APPROVED: "text-primary bg-primary/10",
  DECLINED: "text-red-300 bg-red-400/10",
  REFUNDED: "text-primary bg-primary/10",
};

/** What the organiser's choice will send back, so the money is never a surprise. */
function amountFor(t: Ticket, reason: Reason): string | null {
  if ((DECLINE_REASONS as readonly string[]).includes(reason)) return null;
  if (!t.registrationId) return null;
  if (reason === "WITHIN_POLICY") {
    return t.policyRefundCents != null ? money(t.policyRefundCents) : null;
  }
  return t.fullRefundCents != null ? money(t.fullRefundCents) : null;
}

export default function OrganiserRefundsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState<Record<string, Reason>>({});
  // Sent with the decision. The athlete sees it on a decline.
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    return fetch("/api/organiser/refund-requests")
      .then((res) => (res.ok ? res.json() : { tickets: [] }))
      .then((data) => setTickets(data.tickets ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/organiser/refund-requests")
      .then((res) => (res.ok ? res.json() : { tickets: [] }))
      .then((data) => {
        if (live) setTickets(data.tickets ?? []);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const decide = async (t: Ticket) => {
    const reason = reasons[t.id];
    if (!reason) {
      setError("Choose a reason first.");
      return;
    }
    const action = (APPROVE_REASONS as readonly string[]).includes(reason) ? "approve" : "decline";
    setBusy(t.id);
    setError("");
    try {
      const res = await fetch(`/api/organiser/refund-requests/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, note: notes[t.id]?.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save that decision.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-dark-darker pt-24 pb-16">
      <div className="max-w-[900px] mx-auto px-6">
        <Link href="/organiser/dashboard" className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <h1 className="font-headline text-[34px] font-black italic tracking-tighter text-light mt-3">Refund requests</h1>
        <p className="text-[14px] text-muted mt-2 mb-8 leading-relaxed">
          Athletes ask for a refund through Support. You decide on each request, and the reason you pick sets how much
          goes back. Approving a request refunds the athlete straight away. Please decide within 3 business days.
          After that, Startline may decide in your place.
        </p>

        {error && <p role="alert" className="text-[13px] text-red-300 mb-4">{error}</p>}
        {tickets === null && <p className="text-[13px] text-muted">Loading…</p>}
        {tickets?.length === 0 && <p className="text-[13px] text-muted">Nothing waiting.</p>}

        <div className="grid gap-3">
          {tickets?.map((t) => {
            const reason = reasons[t.id];
            const amount = reason ? amountFor(t, reason) : null;
            const noteNeeded = reason ? refundNoteRequired(reason) : false;
            const isDecline = reason ? (DECLINE_REASONS as readonly string[]).includes(reason) : false;
            return (
              <div key={t.id} data-testid="refund-ticket" className="rounded-xl border border-dark-lighter bg-dark-light p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${STATUS_STYLE[t.status]}`}>
                    {t.status === "OPEN" ? <Undo2 className="w-3 h-3" /> : t.status === "DECLINED" ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                    {t.status.toLowerCase()}
                  </span>
                  <span className="font-headline text-[13px] font-bold text-light">{t.eventName ?? "Event not given"}</span>
                  {t.eventDate && <span className="text-[12px] text-muted">{t.eventDate}</span>}
                </div>
                <p className="text-[13px] text-muted-light mt-2 whitespace-pre-wrap">{t.reason}</p>
                <p className="text-[12px] text-muted-dark mt-2">{t.name} · {t.email}</p>
                {t.registrationId && t.policyRefundCents != null && (
                  <p className="text-[12px] text-muted mt-1">
                    Your policy: {money(t.policyRefundCents)}
                    {t.policyRefundPercent != null ? ` (${t.policyRefundPercent}% of the ticket)` : ""}
                    {t.fullRefundCents != null ? ` · Everything paid: ${money(t.fullRefundCents)}` : ""}
                  </p>
                )}
                {!t.registrationId && t.status === "OPEN" && (
                  <p className="text-[12px] text-muted mt-1">
                    Not linked to an entry. Startline matches it and issues the refund by hand.
                  </p>
                )}

                {t.status === "OPEN" && (
                  <div className="mt-3 grid gap-2">
                    <p className="text-[12px] text-muted">Please decide by {DUE.format(new Date(t.organiserResponseDue))}.</p>
                    <label className="grid gap-1">
                      <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">Reason</span>
                      <select
                        value={reason ?? ""}
                        onChange={(e) => setReasons((r) => ({ ...r, [t.id]: e.target.value as Reason }))}
                        aria-label="Reason for your decision"
                        className="rounded border border-dark-lighter bg-dark p-2 text-[13px] text-light"
                      >
                        <option value="" disabled>Choose a reason</option>
                        <optgroup label="Approve">
                          {APPROVE_REASONS.map((r) => (
                            <option key={r} value={r}>{REFUND_REASON_LABEL[r]}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Decline">
                          {DECLINE_REASONS.map((r) => (
                            <option key={r} value={r}>{REFUND_REASON_LABEL[r]}</option>
                          ))}
                        </optgroup>
                      </select>
                    </label>
                    {reason && (
                      <p className="text-[12px] text-muted-light">
                        {REFUND_REASON_HINT[reason]}
                        {amount ? ` The athlete gets ${amount}.` : ""}
                      </p>
                    )}
                    <textarea
                      value={notes[t.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))}
                      rows={2}
                      maxLength={REFUND_NOTE_MAX}
                      placeholder={
                        isDecline ? "Tell the athlete why (required)"
                        : noteNeeded ? "Why are you refunding outside your policy? (required)"
                        : "Note (optional)"
                      }
                      aria-label="Note"
                      className="rounded border border-dark-lighter bg-dark p-2 text-[13px] text-light"
                    />
                    <div>
                      <button
                        type="button"
                        disabled={busy === t.id || !reason || (noteNeeded && !notes[t.id]?.trim())}
                        onClick={() => decide(t)}
                        className={
                          isDecline
                            ? "font-headline text-[11px] font-bold uppercase tracking-widest border border-red-500/30 text-red-400 px-3 py-2 rounded disabled:opacity-50"
                            : "font-headline text-[11px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-2 rounded disabled:opacity-50"
                        }
                      >
                        {busy === t.id
                          ? "Saving…"
                          : isDecline
                            ? "Decline request"
                            : amount
                              ? `Approve and refund ${amount}`
                              : "Approve"}
                      </button>
                    </div>
                  </div>
                )}

                {t.organiserReason && (
                  <p className="text-[12px] text-muted mt-2">
                    Your reason: {REFUND_REASON_LABEL[t.organiserReason]}
                    {t.organiserNote ? `. Note: ${t.organiserNote}` : ""}
                  </p>
                )}
                {!t.organiserReason && t.organiserNote && <p className="text-[12px] text-muted mt-2">Your note: {t.organiserNote}</p>}
                {t.status === "REFUNDED" && t.refundCents != null && (
                  <p className="text-[12px] text-primary mt-2">
                    Refunded {money(t.refundCents)}{t.refundType === "FULL" ? ", booking fee included" : ""}.
                  </p>
                )}
                {t.status === "APPROVED" && t.registrationId && (
                  <p className="text-[12px] text-amber-300 mt-2">
                    Approved. Startline is finishing the refund{t.refundError ? `: ${t.refundError}` : "."}
                  </p>
                )}
                {t.adminDecisionKind && (
                  <p className="text-[12px] text-amber-300 mt-2">
                    {t.adminDecisionKind === "OVERRIDE"
                      ? `Startline overrode ${t.organiserDecision ? `your decision (${t.organiserDecision.toLowerCase()})` : "this request"}`
                      : "Startline decided after no response"}
                    {t.adminNote ? `: ${t.adminNote}` : "."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
