"use client";

import { useCallback, useState } from "react";
import { History, AlertTriangle, ChevronDown } from "lucide-react";
import { useApiResource } from "@/hooks/useApiResource";
import type { EventChangeHistoryEntry } from "@/lib/event-change-log";

interface EventChangeHistoryProps {
  eventId: string;
  /** "/api/organiser" or "/api/admin". */
  apiBase: string;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/**
 * The event's change log, read-only. Each entry says when, who, and what each
 * field went from and to, so the original details are on record if anyone
 * disputes them. Changes to date, time, location or type are tagged, since
 * they are the ones that gave registered athletes a full refund.
 */
export default function EventChangeHistory({ eventId, apiBase }: EventChangeHistoryProps) {
  const load = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(`${apiBase}/events/${eventId}/changes`, { signal });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Could not load the change history.");
    return body.changes as EventChangeHistoryEntry[];
  }, [apiBase, eventId]);

  const { data: changes, loading, error } = useApiResource<EventChangeHistoryEntry[]>(load, { key: `${apiBase}:${eventId}` });
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section aria-labelledby="change-history-heading" data-testid="event-change-history">
      <h2 id="change-history-heading" className="flex items-center gap-2 font-headline text-xl font-black italic tracking-tighter text-white mb-2">
        <History className="w-5 h-5 text-primary" /> Change history
      </h2>
      <p className="text-[13px] text-muted leading-relaxed mb-5">
        Every change to this event once it left draft, with what it said before. Entries can&apos;t be edited or removed.
      </p>

      {loading && <p className="font-headline text-[12px] uppercase tracking-widest text-muted-dark">Loading…</p>}
      {error && <p className="text-[13px] text-red-300">{error}</p>}
      {changes && changes.length === 0 && (
        <p className="text-[13px] text-muted">No changes recorded yet. The first entry appears when the event is submitted or published.</p>
      )}

      {changes && changes.length > 0 && (
        <ol className="flex flex-col gap-3">
          {changes.map((entry) => {
            const isBaseline = entry.kind === "BASELINE";
            const expanded = open[entry.id] ?? !isBaseline;
            return (
              <li key={entry.id} className="rounded-xl border border-dark-lighter bg-dark p-4" data-testid="event-change-entry">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [entry.id]: !expanded }))}
                  aria-expanded={expanded}
                  className="w-full flex items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
                        {isBaseline ? "Original details" : `${entry.lines.length} field${entry.lines.length === 1 ? "" : "s"} changed`}
                      </span>
                      {entry.material && !isBaseline && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-300/30 bg-amber-300/10 font-headline text-[10px] font-bold uppercase tracking-widest text-amber-300">
                          <AlertTriangle className="w-3 h-3" /> Date, location or type
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-muted mt-1">
                      {formatWhen(entry.createdAt)} · {entry.changedBy}
                    </div>
                    {entry.affectedCount > 0 && entry.fullRefundUntil && (
                      <div className="text-[12px] text-amber-300 mt-1">
                        {entry.affectedCount} registered athlete{entry.affectedCount === 1 ? "" : "s"} offered a full refund until {formatWhen(entry.fullRefundUntil)}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>

                {expanded && (
                  <dl className="mt-3 border-t border-dark-lighter pt-3 grid gap-2">
                    {entry.lines.map((line) => (
                      <div key={line.field} className="grid sm:grid-cols-[160px_1fr] gap-1 sm:gap-3 text-[13px]">
                        <dt className={`font-headline text-[11px] uppercase tracking-widest ${line.material ? "text-amber-300" : "text-muted-dark"}`}>
                          {line.label}
                        </dt>
                        <dd className="min-w-0 break-words">
                          {isBaseline ? (
                            <span className="text-light">{line.to}</span>
                          ) : (
                            <>
                              <span className="text-muted line-through">{line.from}</span>
                              <span className="text-muted-dark mx-2" aria-hidden>→</span>
                              <span className="sr-only"> changed to </span>
                              <span className="text-light">{line.to}</span>
                            </>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
