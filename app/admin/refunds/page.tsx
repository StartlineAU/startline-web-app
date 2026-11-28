"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { REFUND_REASON_LABEL, UNMATCHED_STRIPE_REFUND_MESSAGE } from "@/lib/refund-decision-reasons";
import type { RefundDecisionReason } from "@prisma/client";

type Status = "OPEN" | "APPROVED" | "DECLINED" | "REFUNDED";

interface Ticket {
  id: string;
  name: string;
  email: string;
  eventName: string | null;
  eventDate: string | null;
  eventId: string | null;
  organiserId: string | null;
  reason: string;
  status: Status;
  organiserDecision: Status | null;
  organiserDecidedAt: string | null;
  organiserNote: string | null;
  adminDecisionKind: "NO_RESPONSE" | "OVERRIDE" | null;
  adminDecidedAt: string | null;
  adminNote: string | null;
  organiserResponseDue: string;
  organiserWindowPassed: boolean;
  createdAt: string;
  registrationId: string | null;
  policyRefundPercent: number | null;
  policyRefundCents: number | null;
  fullRefundCents: number | null;
  organiserReason: RefundDecisionReason | null;
  refundType: RefundType | null;
  refundCents: number | null;
  refundError: string | null;
}

type Action = "approve" | "decline" | "refunded" | "issue" | "match_stripe";
type RefundType = "POLICY" | "TICKET" | "FULL";
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const DATE = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" });
const fmt = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "");

const STATUS_LABEL: Record<Status, string> = {
  OPEN: "Waiting on organiser",
  APPROVED: "Approved, refund to issue",
  DECLINED: "Declined, closed",
  REFUNDED: "Refunded",
};

const btn = "font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded disabled:opacity-50";

export default function AdminRefundsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // The ticket being overridden, and the note the override must carry.
  const [overriding, setOverriding] = useState<{ id: string; action: "approve" | "decline"; refundType: RefundType } | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    return fetch("/api/admin/refund-requests")
      .then((res) => (res.ok ? res.json() : { tickets: [] }))
      .then((data) => setTickets(data.tickets ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (
    id: string,
    body: { action: Action; override?: boolean; note?: string; refundType?: RefundType },
  ) => {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/refund-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save that.");
        await load();
        return false;
      }
      // Approved, but the refund itself did not go through: say why.
      if (data.refundError) setError(`Approved, but the refund failed: ${data.refundError}`);
      await load();
      return true;
    } finally {
      setBusy(null);
    }
  };

  const submitOverride = async () => {
    if (!overriding || !note.trim()) return;
    const ok = await send(overriding.id, {
      action: overriding.action,
      override: true,
      note: note.trim(),
      ...(overriding.action === "approve" ? { refundType: overriding.refundType } : {}),
    });
    if (ok) {
      setOverriding(null);
      setNote("");
    }
  };

  return (
    <main className="min-h-screen bg-dark-darker pt-24 pb-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <h1 className="font-headline text-[34px] font-black italic tracking-tighter text-light mt-3">Refund requests</h1>
        <p className="text-[14px] text-muted mt-2 mb-8 leading-relaxed">
          The organiser decides on each request, and their reason sets the amount. A request raised from an entry is
          refunded as soon as it is approved; retry it here if Stripe failed. A request not linked to an entry is
          issued from the registrations page and then marked refunded here. Startline decides only when the organiser
          has not responded within 3 business days, or as an override with a note, which is audited and sent to the
          organiser.
        </p>

        {error && <p className="text-[13px] text-red-300 mb-4">{error}</p>}
        {tickets === null && <p className="text-[13px] text-muted">Loading…</p>}
        {tickets?.length === 0 && <p className="text-[13px] text-muted">No refund requests.</p>}

        <div className="grid gap-3">
          {tickets?.map((t) => {
            const pastDue = t.status === "OPEN" && t.organiserWindowPassed;
            const canOverride = t.status !== "REFUNDED";
            return (
              <div key={t.id} className="rounded-xl border border-dark-lighter bg-dark-light p-4" data-testid="refund-ticket">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">{STATUS_LABEL[t.status]}</span>
                  <span className="font-headline text-[13px] font-bold text-light">{t.eventName ?? "Event not given"}</span>
                  {t.eventDate && <span className="text-[12px] text-muted">{t.eventDate}</span>}
                  {t.eventId && <Link href={`/admin/events/${t.eventId}`} className="text-[12px] text-primary underline">Open event</Link>}
                </div>
                <p className="text-[13px] text-muted-light mt-2 whitespace-pre-wrap">{t.reason}</p>
                <p className="text-[12px] text-muted-dark mt-2">{t.name} · {t.email}</p>
                {t.registrationId ? (
                  <p className="text-[12px] text-muted mt-1">
                    Policy: {t.policyRefundCents != null ? money(t.policyRefundCents) : "none"}
                    {t.policyRefundPercent != null ? ` (${t.policyRefundPercent}%)` : ""}
                    {t.fullRefundCents != null ? ` · Full: ${money(t.fullRefundCents)}` : ""}
                  </p>
                ) : (
                  <p className="text-[12px] text-muted mt-1">Not linked to an entry.</p>
                )}

                <div className="mt-3 grid gap-1 text-[12px] text-muted">
                  {t.organiserDecision ? (
                    <p>
                      Organiser {t.organiserDecision.toLowerCase()} on {fmt(t.organiserDecidedAt)}
                      {t.organiserReason ? ` (${REFUND_REASON_LABEL[t.organiserReason]})` : ""}
                      {t.organiserNote ? `: ${t.organiserNote}` : ""}
                    </p>
                  ) : (
                    <p>
                      Organiser has not decided.{" "}
                      {pastDue ? "Their window has passed." : `They have until ${fmt(t.organiserResponseDue)}.`}
                    </p>
                  )}
                  {t.status === "REFUNDED" && t.refundCents != null && (
                    <p className="text-primary">
                      Refunded {money(t.refundCents)}{t.refundType === "FULL" ? " in full" : t.refundType === "TICKET" ? ", the whole ticket price" : " under the policy"}.
                    </p>
                  )}
                  {t.status === "APPROVED" && t.refundError && (
                    <p className="text-red-300">Refund failed: {t.refundError}</p>
                  )}
                  {t.adminDecisionKind && (
                    <p className="text-amber-300">
                      {t.adminDecisionKind === "OVERRIDE" ? "Overridden by Startline" : "Decided by Startline after no response"}
                      {" "}on {fmt(t.adminDecidedAt)}{t.adminNote ? `: ${t.adminNote}` : ""}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {t.status === "APPROVED" && t.registrationId && (
                    <button type="button" disabled={busy === t.id} onClick={() => send(t.id, { action: "issue" })}
                      className={`${btn} bg-primary text-dark`}>
                      Retry refund
                    </button>
                  )}
                  {t.status === "APPROVED" && t.registrationId && t.refundError === UNMATCHED_STRIPE_REFUND_MESSAGE && (
                    <button type="button" disabled={busy === t.id} onClick={() => send(t.id, { action: "match_stripe" })}
                      className={`${btn} border border-primary/40 text-primary`}>
                      It was this refund
                    </button>
                  )}
                  {t.status === "APPROVED" && !t.registrationId && (
                    <>
                      <Link
                        href={`/admin/registrations?${new URLSearchParams({ search: t.email, ...(t.eventId ? { eventId: t.eventId } : {}) })}`}
                        className={`${btn} bg-primary text-dark`}
                      >
                        Issue refund
                      </Link>
                      <button type="button" disabled={busy === t.id} onClick={() => send(t.id, { action: "refunded" })}
                        className={`${btn} border border-primary/40 text-primary`}>
                        Mark refunded
                      </button>
                    </>
                  )}
                  {pastDue && (
                    <>
                      {(!t.registrationId || (t.policyRefundCents ?? 0) > 0) && (
                        <button type="button" disabled={busy === t.id} onClick={() => send(t.id, { action: "approve", refundType: "POLICY" })}
                          className={`${btn} border border-primary/40 text-primary`}>
                          {t.registrationId && t.policyRefundCents != null ? `Approve ${money(t.policyRefundCents)}` : "Approve"}
                        </button>
                      )}
                      {t.registrationId && t.fullRefundCents != null && (
                        <button type="button" disabled={busy === t.id} onClick={() => send(t.id, { action: "approve", refundType: "FULL" })}
                          className={`${btn} border border-primary/40 text-primary`}>
                          Approve in full {money(t.fullRefundCents)}
                        </button>
                      )}
                      <button type="button" disabled={busy === t.id} onClick={() => send(t.id, { action: "decline" })}
                        className={`${btn} border border-red-500/30 text-red-400`}>
                        Decline
                      </button>
                    </>
                  )}
                  {canOverride && (
                    <button type="button" disabled={busy === t.id}
                      onClick={() => {
                        setOverriding({ id: t.id, action: t.status === "APPROVED" ? "decline" : "approve", refundType: "POLICY" });
                        setNote("");
                      }}
                      className={`${btn} border border-dark-lighter text-muted hover:text-light`}>
                      Override…
                    </button>
                  )}
                </div>

                {overriding?.id === t.id && (
                  <div className="mt-3 rounded-lg border border-amber-300/30 bg-dark p-3 grid gap-2">
                    <p className="text-[12px] text-muted-light">
                      An override replaces the organiser&apos;s decision. It is written to the audit log and the organiser
                      is emailed the note below.
                    </p>
                    <div className="flex gap-2">
                      {(["approve", "decline"] as const).map((a) => (
                        <button key={a} type="button" onClick={() => setOverriding({ ...overriding, action: a })}
                          className={`${btn} ${overriding.action === a ? "bg-primary text-dark" : "border border-dark-lighter text-muted"}`}>
                          {a}
                        </button>
                      ))}
                    </div>
                    {overriding.action === "approve" && t.registrationId && (
                      <div className="flex gap-2">
                        {(["POLICY", "FULL"] as const).map((kind) => (
                          <button key={kind} type="button" onClick={() => setOverriding({ ...overriding, refundType: kind })}
                            className={`${btn} ${overriding.refundType === kind ? "bg-primary text-dark" : "border border-dark-lighter text-muted"}`}>
                            {kind === "POLICY"
                              ? `Policy ${t.policyRefundCents != null ? money(t.policyRefundCents) : ""}`
                              : `Full ${t.fullRefundCents != null ? money(t.fullRefundCents) : ""}`}
                          </button>
                        ))}
                      </div>
                    )}
                    <label className="grid gap-1 text-[12px] text-muted">
                      Reason (sent to the organiser)
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000}
                        className="rounded border border-dark-lighter bg-dark-light p-2 text-[13px] text-light"
                        placeholder="For example: the date changed, so the athlete is owed a remedy under the Australian Consumer Law." />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" disabled={busy === t.id || !note.trim()} onClick={submitOverride}
                        className={`${btn} bg-primary text-dark`}>
                        Confirm override
                      </button>
                      <button type="button" onClick={() => setOverriding(null)}
                        className={`${btn} border border-dark-lighter text-muted`}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
