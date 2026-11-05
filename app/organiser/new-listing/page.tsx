import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import EventFormWizard from "@/components/event/EventFormWizard";
import EventEditLockedNotice from "@/components/organiser/EventEditLockedNotice";
import { getOrganiserSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";
import { hasAbn } from "@/lib/abn";
import { effectiveEventStatus } from "@/lib/event-lifecycle";
import { organiserCanEditEvent } from "@/lib/event-edit-policy";

export const dynamic = "force-dynamic";

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const session = await getOrganiserSession();
  // Without an organiser the wizard still rendered, and the rejection only
  // arrived after five steps and an image upload (issue #302). Send them to the
  // landing page, which offers sign-in and organiser sign-up, before they start.
  if (!session) redirect("/organiser-landing");

  const params = await searchParams;
  const eventId = typeof params.id === "string" ? params.id : undefined;

  if (eventId) {
    const event = await prisma.event.findFirst({
      where:  { id: eventId, organiserId: session.sub },
      select: { id: true, title: true, status: true, startsAtUtc: true, endsAtUtc: true },
    });

    if (event) {
      const status = effectiveEventStatus(event);
      if (!organiserCanEditEvent(status)) {
        return (
          <div className="min-h-screen bg-dark-darker pt-14">
            <main className="max-w-[720px] mx-auto px-6 py-12">
              <Link
                href="/organiser/listings"
                className="inline-flex items-center gap-2 font-headline text-xs font-bold uppercase tracking-widest border border-dark-lighter text-light hover:border-primary hover:text-primary px-4 py-2 rounded-full transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Listings
              </Link>
              <h1 className="font-headline text-[28px] sm:text-[38px] font-black italic tracking-tighter leading-tight text-light mt-8 mb-6">
                {event.title}
              </h1>
              <EventEditLockedNotice eventId={event.id} status={status} />
            </main>
          </div>
        );
      }
    }
  }

  // Read here rather than from a client fetch: the wizard only needs to know
  // whether to show an advisory notice, and this page already has the session.
  const organiser = await prisma.organiser.findUnique({
    where:  { id: session.sub },
    select: { abn: true },
  });

  return (
    <EventFormWizard
      apiBase="/api/organiser"
      submitRedirect="/organiser/dashboard"
      cancelRedirect="/organiser/dashboard"
      organiserId={session.sub}
      organiserHasAbn={hasAbn(organiser?.abn)}
    />
  );
}
