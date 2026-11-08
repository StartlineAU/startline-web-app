"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface RevisionLine {
  field: string;
  label: string;
  from: string;
  to: string;
}

/**
 * Shown on a live event while an unverified organiser's edit is waiting.
 * The listing athletes see is the last approved version.
 */
export default function PendingRevisionNotice({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [revision, setRevision] = useState<{ lines: RevisionLine[] } | null>(null);
  const [discarding, setDiscarding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/organiser/events/${eventId}/revision`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setRevision(data?.revision ?? null);
      })
      .catch(() => {
        if (!cancelled) setRevision(null);
      });
    return () => { cancelled = true; };
  }, [eventId]);

  if (!revision) return null;

  const discard = async () => {
    setDiscarding(true);
    try {
      const res = await fetch(`/api/organiser/events/${eventId}/revision`, { method: "DELETE" });
      if (res.ok) {
        setRevision(null);
        router.refresh();
      }
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4" data-testid="pending-revision-notice">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-amber-300">
            Changes awaiting review
          </p>
          <p className="text-[13px] text-muted-light leading-relaxed mt-1">
            The live listing is unchanged until Startline approves this edit.
          </p>
          <dl className="mt-2 grid gap-1">
            {revision.lines.map((line) => (
              <div key={line.field} className="text-[13px]">
                <span className="text-amber-300">{line.label}: </span>
                <span className="text-muted line-through">{line.from}</span>
                <span className="text-muted-dark mx-1">→</span>
                <span className="text-light">{line.to}</span>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={discard}
            disabled={discarding}
            className="mt-3 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light disabled:opacity-40"
          >
            {discarding ? "Discarding…" : "Discard these changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
