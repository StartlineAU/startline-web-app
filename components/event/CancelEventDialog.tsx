"use client";

import { useCallback, useState } from "react";
import { Ban } from "lucide-react";
import { useApiResource } from "@/hooks/useApiResource";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CancelSummary {
  refunded: number;
  failed: number;
  released: number;
  refundedCents: number;
}

interface Preview {
  entries: number;
  paidEntries: number;
  refundCents: number;
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Confirm cancelling an event. Cancelling replaces deleting once an event has
 * entries, and refunds every athlete everything they paid, booking fee
 * included. Shared by the organiser listings and the admin events page; only
 * the API base differs.
 */
export function CancelEventDialog({
  event,
  apiBase,
  onClose,
  onCancelled,
}: {
  event: { id: string; title: string } | null;
  /** "/api/organiser/events" or "/api/admin/events". */
  apiBase: string;
  onClose: () => void;
  onCancelled: (summary: CancelSummary) => void;
}) {
  return (
    <Dialog open={!!event} onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* Keyed so each event opens with a clean form and its own preview. */}
      {event && (
        <CancelEventForm key={event.id} event={event} apiBase={apiBase} onClose={onClose} onCancelled={onCancelled} />
      )}
    </Dialog>
  );
}

function CancelEventForm({
  event,
  apiBase,
  onClose,
  onCancelled,
}: {
  event: { id: string; title: string };
  apiBase: string;
  onClose: () => void;
  onCancelled: (summary: CancelSummary) => void;
}) {
  const loadPreview = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(`${apiBase}/${event.id}/cancel`, { signal });
    if (!res.ok) throw new Error("Could not work out the refunds.");
    return (await res.json()) as Preview;
  }, [apiBase, event.id]);
  const { data: preview } = useApiResource<Preview>(loadPreview, { key: event.id });

  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirmed = typed.trim().toLowerCase() === event.title.trim().toLowerCase();

  const submit = async () => {
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/${event.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not cancel the event.");
        return;
      }
      onCancelled(data as CancelSummary);
    } finally {
      setBusy(false);
    }
  };

  return (
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-red-400/10 text-red-300 flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5" />
            </div>
            <DialogTitle>Cancel this event?</DialogTitle>
          </div>
          <DialogDescription>
            <span className="text-white font-semibold">{event.title}</span> will be taken off sale and marked
            cancelled. Every athlete is refunded everything they paid, booking fee included, and emailed. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-[13px]">
          <p className="text-muted-light" data-testid="cancel-preview">
            {preview === null
              ? "Working out refunds…"
              : preview.entries === 0 && preview.paidEntries === 0
                ? "No one has entered yet."
                : `${preview.entries} entr${preview.entries === 1 ? "y" : "ies"} affected. ` +
                  (preview.paidEntries > 0
                    ? `${dollars(preview.refundCents)} will be refunded across ${preview.paidEntries} paid entr${preview.paidEntries === 1 ? "y" : "ies"}.`
                    : "All of them are free, so nothing needs refunding.")}
          </p>
          <label className="grid gap-1 text-muted">
            Message to athletes (optional)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={1000}
              className="rounded-lg border border-dark-lighter bg-dark p-2 text-light"
              placeholder="For example: the council withdrew the road closure permit."
            />
          </label>
          <label className="grid gap-1 text-muted">
            Type the event name to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-10 rounded-lg border border-dark-lighter bg-dark px-2 text-light"
              aria-label="Type the event name to confirm"
            />
          </label>
          {error && <p className="text-red-300">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Keep event</Button>
          <Button variant="destructive" onClick={submit} disabled={!confirmed || busy}>
            {busy ? "Cancelling and refunding…" : "Cancel event and refund everyone"}
          </Button>
        </DialogFooter>
      </DialogContent>
  );
}
