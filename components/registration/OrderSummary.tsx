"use client";

import Image from "next/image";
import { Calendar, MapPin, Check } from "lucide-react";

interface OrderLine {
  label: string;
  value: string;
}

interface OrderSummaryProps {
  eventTitle: string;
  dateLabel: string;
  locationLabel: string;
  coverImageUrl?: string | null;
  lines: OrderLine[];
  feeLine?: OrderLine | null;
  totalLabel: string | null;
  /** A free RSVP never goes near Stripe, so it must not promise a payment. */
  free?: boolean;
}

const TRUST = [
  "Instant confirmation by email",
  "Secure payment via Stripe",
  "Event updates sent directly to you",
];

const FREE_TRUST = [
  "Instant confirmation by email",
  "No payment required",
  "Event updates sent directly to you",
];

export default function OrderSummary({
  eventTitle,
  dateLabel,
  locationLabel,
  coverImageUrl,
  lines,
  feeLine,
  totalLabel,
  free = false,
}: OrderSummaryProps) {
  return (
    <div className="lg:sticky lg:top-[76px]">
      <div className="bg-dark border border-dark-lighter rounded-[14px] overflow-hidden">
        <div className="relative h-[90px]">
          {coverImageUrl ? (
            <Image
              src={coverImageUrl}
              alt={eventTitle}
              fill
              sizes="400px"
              className="object-cover"
              style={{ filter: "brightness(.45) saturate(1.1)" }}
            />
          ) : (
            <div className="w-full h-full bg-dark-light" />
          )}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgb(31 31 31), transparent 40%)" }}
          />
        </div>

        <div className="px-5 py-4">
          <div className="font-headline text-[15px] font-bold italic tracking-[-0.03em] text-light mb-2.5">
            {eventTitle}
          </div>
          <div className="flex flex-col gap-1.5 mb-4">
            <div className="flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
              <Calendar className="w-3 h-3 text-primary shrink-0" /> {dateLabel}
            </div>
            <div className="flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
              <MapPin className="w-3 h-3 text-primary shrink-0" /> {locationLabel}
            </div>
          </div>

          <div className="h-px bg-dark-lighter mb-3.5" />

          {totalLabel === null ? (
            <div className="text-center py-2.5">
              <div className="font-headline text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted-dark">
                Select a tier to see your total
              </div>
            </div>
          ) : (
            <div>
              <div className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted mb-2.5">
                Order summary
              </div>
              {lines.map((l) => (
                <div key={l.label} className="flex justify-between mb-2">
                  <span className="text-[13px] text-muted">{l.label}</span>
                  <span className="font-headline text-[13.5px] font-bold text-light">{l.value}</span>
                </div>
              ))}
              {feeLine && (
                <div className="flex justify-between mb-2">
                  <span className="text-[13px] text-muted">{feeLine.label}</span>
                  <span className="font-headline text-[13.5px] font-bold text-light">{feeLine.value}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-3 border-t border-dark-lighter mt-1">
                <span className="font-headline text-[12px] font-bold uppercase tracking-[0.12em] text-light">Total</span>
                <span className="font-headline text-[26px] font-bold italic tracking-[-0.03em] text-primary">{totalLabel}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-4">
        {(free ? FREE_TRUST : TRUST).map((t) => (
          <div key={t} className="flex items-center gap-2 font-headline text-[11px] uppercase tracking-[0.1em] text-muted-dark">
            <Check className="w-[13px] h-[13px] text-primary shrink-0" strokeWidth={2} /> {t}
          </div>
        ))}
      </div>
    </div>
  );
}
