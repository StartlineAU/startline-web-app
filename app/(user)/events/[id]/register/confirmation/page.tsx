"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function ConfirmationPage() {
  const params = useParams();
  const eventId = params.id as string;

  return (
    <div className="min-h-screen bg-dark-darker flex items-center justify-center">
      <div className="max-w-[420px] mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>

        <h1 className="font-headline text-[28px] font-black italic tracking-tighter text-light mb-3">
          Registration confirmed
        </h1>

        <p className="text-[13px] text-muted leading-relaxed mb-8">
          Your payment has been processed and your spot is secured. You&apos;ll receive a confirmation email shortly with all the event details.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center justify-center gap-2 font-headline text-[13px] font-bold uppercase tracking-widest bg-primary text-dark px-6 py-3 rounded-md hover:bg-primary/90 transition-colors"
          >
            View event <ArrowRight className="w-3 h-3" />
          </Link>

          <Link
            href="/events"
            className="font-headline text-[12px] font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors"
          >
            Browse more events
          </Link>
        </div>
      </div>
    </div>
  );
}
