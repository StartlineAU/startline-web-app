"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Link2,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface PayoutEvent {
  id: string;
  title: string;
  eventDate: string;
  endDate: string | null;
  organiser: { id: string; orgName: string | null };
  netCents: number;
}

interface PayoutAttention {
  eventId: string;
  title: string;
  eventDate: string;
  endDate: string | null;
  organiser: { id: string; orgName: string | null };
  netCents: number;
  status: "SUBMITTING" | "NEEDS_RECONCILIATION";
  lastError: string | null;
  updatedAt: string;
}

const formatAud = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function AdminPayoutsPage() {
  const [events, setEvents] = useState<PayoutEvent[]>([]);
  const [attention, setAttention] = useState<PayoutAttention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [payoutIds, setPayoutIds] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/payouts");
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to load payouts.");
      }
      const data = await res.json() as {
        events: PayoutEvent[];
        attention?: PayoutAttention[];
      };
      setEvents(data.events);
      setAttention(data.attention ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payouts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { startTransition(() => { load(); }); }, [load]);

  const runPayout = async (eventId: string) => {
    setRunning(eventId);
    setError("");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Payout failed.");
      }
      setDone((prev) => [...prev, eventId]);
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payout failed.");
    } finally {
      setRunning(null);
    }
  };

  const reconcile = async (
    eventId: string,
    resolution: "link" | "no_payout",
    stripePayoutId?: string,
  ) => {
    setReconciling(eventId);
    setError("");
    try {
      const body = resolution === "link"
        ? { eventId, resolution, stripePayoutId }
        : { eventId, resolution, confirm: true };
      const res = await fetch("/api/admin/payouts/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Could not reconcile the payout.");
      }
      setPayoutIds((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reconcile the payout.");
    } finally {
      setReconciling(null);
    }
  };

  const confirmNoPayout = (event: PayoutAttention) => {
    const confirmed = window.confirm(
      `Only confirm this after checking ${event.organiser.orgName ?? "the organiser"}'s Stripe account and seeing no ${formatAud(event.netCents)} payout. The event will be available to pay out again.`,
    );
    if (confirmed) void reconcile(event.eventId, "no_payout");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pt-14">
      <div className="mb-8">
        <h1 className="font-headline text-2xl sm:text-3xl font-black italic tracking-tighter text-light">
          Stripe payouts
        </h1>
        <p className="font-headline text-[11px] uppercase tracking-widest text-muted mt-1">
          Push event earnings from the organiser&apos;s Stripe Express balance to their bank account
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 font-headline text-[12px] uppercase tracking-widest text-red-300">
          {error}
        </div>
      )}

      {attention.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-400/[0.06]">
          <div className="flex items-center gap-2 border-b border-amber-400/20 px-5 py-4">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-amber-200">
              Needs attention
            </span>
          </div>
          <ul className="divide-y divide-amber-400/10">
            {attention.map((event) => (
              <li key={event.eventId} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <p className="font-headline text-[15px] font-black italic tracking-tighter text-light">
                    {event.title}
                  </p>
                  <span className="font-headline text-[13px] font-black text-amber-200">
                    {formatAud(event.netCents)}
                  </span>
                </div>
                <p className="font-headline text-[11px] uppercase tracking-widest text-muted mt-0.5">
                  {event.organiser.orgName ?? "Organiser"} · {event.status === "SUBMITTING"
                    ? "request in progress or interrupted"
                    : "reconciliation required"}
                </p>
                {event.lastError && (
                  <p className="font-headline text-[11px] text-amber-200/80 mt-2">
                    {event.lastError}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`Stripe payout ID for ${event.title}`}
                    value={payoutIds[event.eventId] ?? ""}
                    onChange={(e) => setPayoutIds((prev) => ({
                      ...prev,
                      [event.eventId]: e.target.value,
                    }))}
                    placeholder="Stripe payout ID (po_…)"
                    className="w-56 rounded border border-white/[0.12] bg-[#0b0b0b] px-3 py-2 font-headline text-[12px] text-light placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={() => void reconcile(
                      event.eventId,
                      "link",
                      payoutIds[event.eventId]?.trim(),
                    )}
                    disabled={
                      reconciling === event.eventId
                      || !payoutIds[event.eventId]?.trim()
                    }
                    className="inline-flex items-center gap-1.5 rounded border border-primary/60 px-3 py-2 font-headline text-[11px] font-bold uppercase tracking-widest text-primary disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {reconciling === event.eventId ? "Saving…" : "Link payout"}
                  </button>
                  <button
                    onClick={() => confirmNoPayout(event)}
                    disabled={reconciling === event.eventId}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-2 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    No payout — retry
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-white/[0.06] bg-[#111]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-light">
            Ready to pay out
          </span>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="px-5 py-8 font-headline text-[12px] uppercase tracking-widest text-muted">
            Loading…
          </p>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
            <CheckCircle className="w-8 h-8 text-primary mb-3" />
            <p className="font-headline text-[13px] text-light">
              No events ready to pay out
            </p>
            <p className="font-headline text-[11px] uppercase tracking-widest text-muted mt-1">
              Events become eligible once their date has passed
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-headline text-[15px] font-black italic tracking-tighter text-light truncate">
                    {event.title}
                  </p>
                  <p className="font-headline text-[11px] uppercase tracking-widest text-muted mt-0.5">
                    {event.organiser.orgName ?? "Organiser"} · ended {formatDate(event.endDate ?? event.eventDate)}
                  </p>
                </div>
                <span className="font-headline text-[15px] font-black text-primary shrink-0">
                  {formatAud(event.netCents)}
                </span>
                <button
                  onClick={() => runPayout(event.id)}
                  disabled={running === event.id || done.includes(event.id)}
                  className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 font-headline text-[11px] font-bold uppercase tracking-widest text-[#141414] disabled:opacity-50 shrink-0"
                >
                  {done.includes(event.id) ? (
                    <><CheckCircle className="w-3.5 h-3.5" /> Sent</>
                  ) : running === event.id ? (
                    <><Clock className="w-3.5 h-3.5 animate-pulse" /> Sending…</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" /> Pay out</>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
