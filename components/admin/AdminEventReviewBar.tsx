"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Eye, Pencil, X } from "lucide-react";
import RejectPanel from "@/components/admin/RejectPanel";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "IN_PROGRESS" | "REJECTED" | "ARCHIVED";

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string }> = {
  DRAFT:    { bg: "bg-white/[0.05]", text: "text-muted",    dot: "bg-muted-dark", label: "Draft"    },
  PENDING:  { bg: "bg-blue-400/10",  text: "text-blue-300", dot: "bg-blue-400",   label: "Pending"  },
  APPROVED: { bg: "bg-primary/10",   text: "text-primary",  dot: "bg-primary",    label: "Approved" },
  IN_PROGRESS: { bg: "bg-amber-300/10", text: "text-amber-300", dot: "bg-amber-300", label: "In progress" },
  REJECTED: { bg: "bg-red-400/10",   text: "text-red-400",  dot: "bg-red-400",    label: "Rejected" },
  ARCHIVED: { bg: "bg-white/[0.05]", text: "text-muted",    dot: "bg-muted-dark", label: "Archived" },
};

export interface AdminEventReviewBarProps {
  eventId: string;
  status: EventStatus;
  organiserName: string;
  submittedAt: string;
  /** From approvalBlocker(); approve stays disabled while this is set. */
  blocker: string | null;
  rejectionReason: string | null;
  pendingRevision?: {
    material: boolean;
    lines: { field: string; label: string; from: string; to: string }[];
  } | null;
}

/**
 * Sits above the athlete-eye event preview (issue #321) so an admin can review
 * the listing from the page that actually shows it, rather than going back to
 * the queue to act on what they just read.
 */
export default function AdminEventReviewBar({
  eventId,
  status,
  organiserName,
  submittedAt,
  blocker,
  rejectionReason,
  pendingRevision,
}: AdminEventReviewBarProps) {
  const router = useRouter();
  const [approving,  setApproving]  = useState(false);
  const [rejecting,  setRejecting]  = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [error,      setError]      = useState("");

  const review = async (body: { action: "approve" } | { action: "reject"; reason: string }) => {
    setError("");
    const res = await fetch(`/api/admin/events/${eventId}/review`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    if (res.ok) {
      setRejectOpen(false);
      // Re-renders the server page, so the status badge and actions reflect
      // the decision without leaving the preview.
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({})) as { error?: string };
    setError(data.error ?? `Failed to ${body.action} event.`);
  };

  const handleApprove = async () => {
    setApproving(true);
    try { await review({ action: "approve" }); } finally { setApproving(false); }
  };

  const handleReject = async (reason: string) => {
    setRejecting(true);
    try { await review({ action: "reject", reason }); } finally { setRejecting(false); }
  };

  const reviewRevision = async (body: { action: "approve" } | { action: "reject"; reason: string }) => {
    setError("");
    const res = await fetch(`/api/admin/events/${eventId}/revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setRejectOpen(false);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({})) as { error?: string };
    setError(data.error ?? `Failed to ${body.action} the edit.`);
  };

  const s = STATUS_STYLE[status];
  const backStatus = status === "DRAFT" ? "PENDING" : status;

  return (
    <div
      data-testid="admin-event-review-bar"
      // Pinned on desktop only: on a phone the bar wraps to a third of the
      // screen, which would leave little of the preview to read.
      className="lg:sticky lg:top-14 z-40 bg-dark-darker/95 backdrop-blur border-b border-dark-lighter"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Link
            href={`/admin/events?status=${backStatus}`}
            className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Events
          </Link>

          <span className="flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-primary">
            <Eye className="w-3.5 h-3.5" /> Athlete preview
          </span>

          <span className={`inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </span>

          <span className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">
            By <span className="text-muted">{organiserName}</span> · Submitted {submittedAt}
          </span>

          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            {status === "PENDING" && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={approving || rejecting || blocker !== null}
                  title={blocker ? `Cannot approve: ${blocker}.` : undefined}
                  className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {approving
                    ? <span className="w-3 h-3 border border-dark/40 border-t-dark rounded-full animate-spin" />
                    : <Check className="w-3.5 h-3.5" />}
                  Approve
                </button>
                <button
                  onClick={() => { setRejectOpen((o) => !o); setError(""); }}
                  disabled={approving || rejecting}
                  className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest border border-red-500/30 text-red-400 px-3 py-2 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
              </>
            )}
            <Link
              href={`/admin/events/${eventId}/edit`}
              className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest border border-dark-lighter text-muted px-3 py-2 rounded-md hover:border-primary/40 hover:text-light transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Link>
          </div>
        </div>

        {pendingRevision && status !== "PENDING" && (
          <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.08] px-4 py-3" data-testid="admin-pending-revision">
            <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-amber-300">
              Edit awaiting review
            </p>
            <p className="text-[13px] text-amber-200 mt-1">
              The live listing is unchanged until you approve this.
              {pendingRevision.material
                ? " A date, time, location or type change emails the athletes already entered."
                : ""}
            </p>
            <dl className="mt-2 grid gap-1">
              {pendingRevision.lines.map((line) => (
                <div key={line.field} className="text-[13px] text-light">
                  <span className="text-amber-300">{line.label}: </span>
                  <span className="text-muted line-through">{line.from}</span>
                  <span className="text-muted-dark mx-1">→</span>
                  {line.to}
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setApproving(true); reviewRevision({ action: "approve" }).finally(() => setApproving(false)); }}
                disabled={approving || rejecting}
                className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5" /> Approve changes
              </button>
              <button
                type="button"
                onClick={() => { setRejectOpen((o) => !o); setError(""); }}
                disabled={approving || rejecting}
                className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest border border-red-500/30 text-red-400 px-3 py-2 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                <X className="w-3.5 h-3.5" /> Reject changes
              </button>
            </div>
            {rejectOpen && (
              <div className="mt-3">
                <RejectPanel
                  onConfirm={(reason) => { setRejecting(true); reviewRevision({ action: "reject", reason }).finally(() => setRejecting(false)); }}
                  onCancel={() => setRejectOpen(false)}
                  loading={rejecting}
                />
              </div>
            )}
          </div>
        )}

        {status === "PENDING" && blocker && (
          <div className="mt-3 flex items-start gap-3 bg-amber-400/[0.08] border border-amber-400/20 rounded-lg px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-[13px] text-amber-200">
              <span className="font-bold">Organiser profile incomplete: {blocker}.</span>{" "}
              This event cannot be approved until {organiserName} completes their profile.
            </div>
          </div>
        )}

        {status === "REJECTED" && rejectionReason && (
          <div className="mt-3 text-[13px] text-red-400 bg-red-500/10 rounded px-3 py-2 border border-red-500/20">
            <span className="font-bold">Reason: </span>{rejectionReason}
          </div>
        )}

        {status !== "APPROVED" && status !== "IN_PROGRESS" && status !== "ARCHIVED" && (
          <p className="mt-2 text-[12px] text-muted-dark">
            This listing is not public yet. Registration and share links below only work once it is approved.
          </p>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-3 bg-amber-400/[0.08] border border-amber-400/20 rounded-lg px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-[13px] text-amber-200">{error}</div>
          </div>
        )}

        {status === "PENDING" && rejectOpen && (
          <RejectPanel onConfirm={handleReject} onCancel={() => setRejectOpen(false)} loading={rejecting} />
        )}
      </div>
    </div>
  );
}
