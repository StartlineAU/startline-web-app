"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useApiResource } from "@/hooks/useApiResource";

interface RefundRow {
  id: string;
  athleteName: string;
  athleteEmail: string;
  cancelRefundStatus: "PENDING" | "FAILED" | "DONE";
  cancelRefundError: string | null;
  refundAmountCents: number | null;
}

const STYLE: Record<RefundRow["cancelRefundStatus"], string> = {
  DONE: "text-primary",
  PENDING: "text-amber-300",
  FAILED: "text-red-300",
};

/**
 * A cancelled event's refunds, one row per paid entry. Anything not DONE is
 * retried by the lifecycle worker on its own; "Retry now" does it immediately.
 */
export default function CancellationRefundsPanel({ eventId }: { eventId: string }) {
  const fetchRows = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(`/api/admin/events/${eventId}/cancel`, { signal });
    if (!res.ok) throw new Error("Could not load refunds.");
    const data = await res.json();
    return (data.refunds ?? []) as RefundRow[];
  }, [eventId]);
  const { data: rows, reload } = useApiResource<RefundRow[]>(fetchRows, { key: eventId });
  const load = () => reload({ silent: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const retry = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/events/${eventId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? `${data.refunded ?? 0} refunded this run, ${data.failed ?? 0} failed, ${data.outstanding ?? 0} still outstanding.`
          : data.error ?? "Retry failed.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (rows === null) return null;
  const outstanding = rows.filter((r) => r.cancelRefundStatus !== "DONE").length;

  return (
    <section className="max-w-[900px] mx-auto px-4 sm:px-6 pt-8" data-testid="cancellation-refunds">
      <div className="rounded-xl border border-dark-lighter bg-dark-light p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Cancellation refunds</h2>
            <p className="text-[12px] text-muted mt-1">
              {rows.length === 0
                ? "No paid entries to refund."
                : outstanding === 0
                  ? `All ${rows.length} paid entries refunded in full.`
                  : `${outstanding} of ${rows.length} still to refund. The scheduled worker retries these automatically.`}
            </p>
          </div>
          {outstanding > 0 && (
            <button type="button" onClick={retry} disabled={busy}
              className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest border border-primary/40 text-primary px-3 py-2 rounded disabled:opacity-50">
              <RefreshCw className="w-3.5 h-3.5" /> {busy ? "Retrying…" : "Retry now"}
            </button>
          )}
        </div>
        {message && <p className="text-[12px] text-muted-light mt-2">{message}</p>}
        {rows.length > 0 && (
          <ul className="mt-3 grid gap-1.5">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 text-[12px]">
                <span className={`font-headline font-bold uppercase tracking-widest text-[10px] ${STYLE[r.cancelRefundStatus]}`}>
                  {r.cancelRefundStatus.toLowerCase()}
                </span>
                <span className="text-light">{r.athleteName}</span>
                <span className="text-muted-dark">{r.athleteEmail}</span>
                {r.cancelRefundStatus === "DONE" && r.refundAmountCents != null && (
                  <span className="text-muted">${(r.refundAmountCents / 100).toFixed(2)}</span>
                )}
                {r.cancelRefundError && <span className="text-red-300 basis-full">{r.cancelRefundError}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
