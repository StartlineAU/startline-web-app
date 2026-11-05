import Link from "next/link";
import { AlertTriangle, Mail, Megaphone } from "lucide-react";
import { organiserEditBlockedMessage } from "@/lib/event-edit-policy";
import { SUPPORT_EMAIL } from "@/lib/contact";

interface EventEditLockedNoticeProps {
  eventId: string;
  status: string;
  compact?: boolean;
}

export default function EventEditLockedNotice({
  eventId,
  status,
  compact = false,
}: EventEditLockedNoticeProps) {
  const canPostUpdate = status === "APPROVED" || status === "IN_PROGRESS";
  const subject = encodeURIComponent("Event listing change request");
  const body = encodeURIComponent(
    `Hi Startline,\n\nI need to change the listing for event ${eventId}.\n\nWhat needs to change:\n\nWhy:\n`,
  );

  return (
    <div
      className={`rounded-xl border border-amber-300/20 bg-amber-300/[0.06] ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h2 className="font-headline text-[15px] font-black italic tracking-tight text-light">
            Editing is locked
          </h2>
          <p className="text-[13px] text-muted-light leading-relaxed mt-1">
            {organiserEditBlockedMessage(status)}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {canPostUpdate && (
              <Link
                href={`/organiser/events/${eventId}/dashboard?panel=announce`}
                className="inline-flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest border border-dark-lighter text-light hover:border-primary hover:text-primary px-3.5 py-2 rounded-full transition-colors"
              >
                <Megaphone className="w-3.5 h-3.5" /> Post an update
              </Link>
            )}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
              className="inline-flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest border border-dark-lighter text-light hover:border-primary hover:text-primary px-3.5 py-2 rounded-full transition-colors"
            >
              <Mail className="w-3.5 h-3.5" /> Contact Startline
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
