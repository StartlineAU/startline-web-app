import type { Metadata } from "next";
import SupportForm, { type RefundableEntry } from "@/components/support/SupportForm";
import { getUserSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";
import { changeOfMindQuote, describeTiers, parseTiers, policyToday } from "@/lib/refund-policy";
import { entryPaidCents } from "@/lib/stripe-refunds";

export const metadata: Metadata = {
  title: "Support",
  description: "Ask Startline for help with an entry, including a refund.",
};

/**
 * The signed-in athlete's paid entries that can still be refunded, with the
 * change-of-mind quote each would get today (#492). Picking one links the
 * ticket to the entry, so the organiser decides on a known amount.
 */
async function refundableEntries(session: { sub: string; email: string }): Promise<RefundableEntry[]> {
  const today = policyToday();
  const rows = await prisma.registration.findMany({
    where: {
      OR: [{ userId: session.sub }, { athleteEmail: { equals: session.email, mode: "insensitive" } }],
      status: { in: ["CONFIRMED", "REFUND_REQUESTED"] },
      stripePaymentIntentId: { not: null },
      event: { status: { not: "CANCELLED" }, eventDate: { gte: today } },
    },
    orderBy: { event: { eventDate: "asc" } },
    take: 50,
    select: {
      id: true, status: true, athleteName: true, amountCents: true, platformFeeCents: true,
      feeStructure: true, soldRefundTiers: true, refundAmountCents: true,
      event: { select: { title: true, eventDate: true, refundTiers: true } },
    },
  });
  return rows.map((r) => {
    const quote = changeOfMindQuote({
      amountCents: r.amountCents,
      soldRefundTiers: r.soldRefundTiers,
      eventRefundTiers: r.event.refundTiers,
      eventDate: r.event.eventDate,
    });
    return {
      id: r.id,
      eventTitle: r.event.title,
      eventDate: r.event.eventDate,
      athleteName: r.athleteName,
      paidCents: entryPaidCents(r),
      quoteCents: r.status === "REFUND_REQUESTED" ? (r.refundAmountCents ?? quote.cents) : quote.cents,
      policyLines: describeTiers(parseTiers(r.soldRefundTiers ?? r.event.refundTiers)),
      requested: r.status === "REFUND_REQUESTED",
    };
  });
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ registration?: string }>;
}) {
  const { registration } = await searchParams;
  const session = await getUserSession().catch(() => null);
  const entries = session ? await refundableEntries(session).catch(() => []) : [];
  // The entry Activity linked to, only when a refund can still be asked for on
  // it. Anything else is reported rather than swapped for a different entry.
  const linked = registration ? entries.find((e) => e.id === registration) : undefined;
  const initialEntryId = linked && !linked.requested ? linked.id : undefined;
  const linkedEntryProblem: "requested" | "unavailable" | undefined = !registration
    ? undefined
    : linked?.requested
      ? "requested"
      : linked
        ? undefined
        : "unavailable";

  return (
    <main className="min-h-screen bg-dark-darker pt-24 pb-16">
      <div className="max-w-[640px] mx-auto px-6">
        <p className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Support</p>
        <h1 className="font-headline text-[36px] font-black italic tracking-tighter text-light mt-2">Open a ticket</h1>
        <p className="text-[14px] text-muted mt-3 mb-8 leading-relaxed">
          Tell us the event and what you need. On a refund request, the organiser decides, usually within 3 business days, and Startline issues the refund. Nothing is refunded when you submit this form.
        </p>
        <SupportForm
          signedIn={!!session}
          defaultName={session?.name ?? ""}
          defaultEmail={session?.email ?? ""}
          entries={entries}
          initialEntryId={initialEntryId}
          linkedEntryProblem={linkedEntryProblem}
        />
      </div>
    </main>
  );
}
