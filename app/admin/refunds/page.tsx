"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Ticket {
  id: string;
  name: string;
  email: string;
  eventName: string | null;
  eventDate: string | null;
  eventId: string | null;
  organiserId: string | null;
  reason: string;
  status: "OPEN" | "APPROVED" | "DECLINED" | "REFUNDED";
  decisionNote: string | null;
  createdAt: string;
}

export default function AdminRefundsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    return fetch("/api/admin/refund-requests")
      .then((res) => (res.ok ? res.json() : { tickets: [] }))
      .then((data) => setTickets(data.tickets ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, action: "approve" | "decline" | "refunded") => {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/refund-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
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
      <div className="max-w-[1100px] mx-auto px-6">
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <h1 className="font-headline text-[34px] font-black italic tracking-tighter text-light mt-3">Refund requests</h1>
        <p className="text-[14px] text-muted mt-2 mb-8 leading-relaxed">
          Raised through Support. The organiser records their view; Startline issues the refund from the
          registrations page and marks it refunded here.
        </p>

        {error && <p className="text-[13px] text-red-300 mb-4">{error}</p>}
        {tickets === null && <p className="text-[13px] text-muted">Loading…</p>}
        {tickets?.length === 0 && <p className="text-[13px] text-muted">No refund requests.</p>}

        <div className="grid gap-3">
          {tickets?.map((t) => (
            <div key={t.id} className="rounded-xl border border-dark-lighter bg-dark-light p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">{t.status}</span>
                <span className="font-headline text-[13px] font-bold text-light">{t.eventName ?? "Event not given"}</span>
                {t.eventDate && <span className="text-[12px] text-muted">{t.eventDate}</span>}
                {t.eventId && <Link href={`/admin/events/${t.eventId}`} className="text-[12px] text-primary underline">Open event</Link>}
              </div>
              <p className="text-[13px] text-muted-light mt-2 whitespace-pre-wrap">{t.reason}</p>
              <p className="text-[12px] text-muted-dark mt-2">{t.name} · {t.email}</p>
              {t.status !== "REFUNDED" && (
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy === t.id} onClick={() => decide(t.id, "approve")}
                    className="font-headline text-[11px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-2 rounded disabled:opacity-50">
                    Approve
                  </button>
                  <button type="button" disabled={busy === t.id} onClick={() => decide(t.id, "decline")}
                    className="font-headline text-[11px] font-bold uppercase tracking-widest border border-red-500/30 text-red-400 px-3 py-2 rounded disabled:opacity-50">
                    Decline
                  </button>
                  <button type="button" disabled={busy === t.id} onClick={() => decide(t.id, "refunded")}
                    className="font-headline text-[11px] font-bold uppercase tracking-widest border border-primary/40 text-primary px-3 py-2 rounded disabled:opacity-50">
                    Mark refunded
                  </button>
                </div>
              )}
              {t.decisionNote && <p className="text-[12px] text-muted mt-2">Note: {t.decisionNote}</p>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
