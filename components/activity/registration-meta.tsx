import Link from "next/link";
import { CheckCheck, Clock, UserCheck } from "lucide-react";
import { formatInEventTimeZone } from "@/lib/event-time";
import type { CheckInState } from "@/lib/check-in-window";

export type RegStatus = "CONFIRMED" | "REFUND_REQUESTED" | "REFUNDED" | "REMOVED";

/** One of the athlete's entries, as GET /api/user/registrations returns it. */
export type RegMeta = {
  id: string;
  eventId: string;
  status: RegStatus;
  athleteName: string;
  wave: string | null;
  bibNumber: string | null;
  checkedInAt: string | null;
  checkInState: CheckInState;
  checkInOpensAt: string | null;
  checkInClosesAt: string | null;
  timeZone: string;
  paidCents: number;
  refundAmountCents: number;
  refundPercent: number;
  outsidePolicy: boolean;
  teamName: string | null;
  /** A team place bought "details later": its member still needs naming. */
  detailsPending: boolean;
};

export function currentCheckInState(meta: RegMeta, now: Date): CheckInState {
  if (meta.checkInState === "unavailable") return "unavailable";
  if (!meta.checkInOpensAt || !meta.checkInClosesAt) return meta.checkInState;
  const opensAt = Date.parse(meta.checkInOpensAt);
  const closesAt = Date.parse(meta.checkInClosesAt);
  if (Number.isNaN(opensAt) || Number.isNaN(closesAt)) return "unavailable";
  if (now.getTime() >= closesAt) return "closed";
  if (now.getTime() < opensAt) return "before";
  return "open";
}

function formatCheckInTime(iso: string, timeZone: string) {
  return formatInEventTimeZone(new Date(iso), timeZone, {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit",
  });
}

/**
 * Withdrawal is the athlete's action, so the copy names them rather than
 * saying "cancelled", which can be mistaken for the event being cancelled.
 */
export function withdrawnCopy(meta: RegMeta): { heading: string; detail: string | null; refundIssued: boolean } {
  const freeEntry = meta.paidCents === 0;
  // The organiser took the entry out (#571): the athlete did not withdraw.
  if (meta.status === "REMOVED") {
    const refunded = !freeEntry && meta.refundAmountCents > 0;
    return {
      heading: "Removed by the organiser.",
      detail: refunded
        ? `Your refund of $${(meta.refundAmountCents / 100).toFixed(2)} is on its way.`
        : "Your place has been released. Contact the organiser with any questions.",
      refundIssued: refunded,
    };
  }
  const refundIssued = meta.status === "REFUNDED" && !freeEntry;
  if (refundIssued) return { heading: "Refund issued.", detail: null, refundIssued };
  if (freeEntry) {
    return { heading: "You withdrew from this event.", detail: "Your spot has been released.", refundIssued };
  }
  return {
    heading: "You withdrew.",
    detail: "Your refund request is awaiting the organiser’s decision.",
    refundIssued,
  };
}

export function CheckInAction({ meta, now }: { meta: RegMeta; now: Date }) {
  if (meta.status !== "CONFIRMED") return null;

  if (meta.checkedInAt) {
    return (
      <span className="inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
        <CheckCheck className="w-3.5 h-3.5" />
        Checked in {formatCheckInTime(meta.checkedInAt, meta.timeZone)}
      </span>
    );
  }

  const state = currentCheckInState(meta, now);
  if (state === "open") {
    return (
      <Link
        href={`/checkin/${meta.eventId}?registration=${encodeURIComponent(meta.id)}`}
        data-testid="activity-check-in"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-headline text-[10px] font-black uppercase tracking-widest text-dark hover:bg-primary-light transition-colors"
      >
        <UserCheck className="w-3.5 h-3.5" /> Check in
      </Link>
    );
  }
  if (state === "before" && meta.checkInOpensAt) {
    return (
      <span className="inline-flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-muted">
        <Clock className="w-3.5 h-3.5" />
        Check-in opens {formatCheckInTime(meta.checkInOpensAt, meta.timeZone)}
      </span>
    );
  }
  if (state === "closed") {
    return (
      <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
        Check-in closed
      </span>
    );
  }
  return null;
}
