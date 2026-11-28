import type { Metadata } from "next";
import RefundForm from "@/components/refunds/RefundForm";
import { refundLinkEntry } from "@/lib/entry-refund-link";

// A confirmation email's refund link carries a bearer token for one entry:
// keep it out of search results and out of the Referer sent to anything the
// page loads.
export const metadata: Metadata = {
  title: "Refunds",
  description: "Request a refund for an event you entered on Startline.",
  robots: { index: false, follow: true },
  referrer: "no-referrer",
};

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[]; t?: string | string[] }>;
}) {
  const params = await searchParams;
  // Activity's "Request a refund" links here with the event already chosen;
  // a confirmation email's link adds a token for the entry itself.
  const event = typeof params.event === "string" ? params.event : null;
  const token = typeof params.t === "string" ? params.t : null;
  const linked = token ? await refundLinkEntry(token) : null;

  return (
    <main className="min-h-screen bg-dark-darker pt-24 pb-16">
      <div className="max-w-[640px] mx-auto px-6">
        <p className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Refunds</p>
        <h1 className="font-headline text-[36px] font-black italic tracking-tighter text-light mt-2">Request a refund</h1>
        <p className="text-[14px] text-muted mt-3 mb-8 leading-relaxed">
          Choose the event and tell us why. Expect a response within 3 business days.
        </p>
        <RefundForm
          initialEventId={linked?.event.id ?? event}
          linkedEntry={linked && token ? {
            token,
            athleteName: linked.athleteName,
            athleteEmail: linked.athleteEmail,
            event: linked.event,
          } : null}
          linkExpired={!!token && !linked}
        />
      </div>
    </main>
  );
}
