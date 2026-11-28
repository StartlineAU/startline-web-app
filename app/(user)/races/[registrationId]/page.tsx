import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Award, Flag, MapPin, Medal, Timer } from "lucide-react";
import { getUserSession } from "@/lib/amplify-server";
import { getRaceSummary, type RaceSummary } from "@/lib/race-summary";
import { cn, formatDiscipline, formatEventDate } from "@/lib/utils";
import { formatEventArea } from "@/lib/event-place";
import { STATE_LABELS, type AustralianState } from "@/types";
import OrganiserIdentity from "@/components/OrganiserIdentity";

export const dynamic = "force-dynamic";

// A person's result, not a page for search engines, even on a public profile.
export const metadata: Metadata = {
  title: "Race summary",
  robots: { index: false, follow: false },
};

/** Registration ids are uuids; the seed's are readable slugs. Anything else is not one. */
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export default async function RaceSummaryPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const { registrationId } = await params;
  if (!ID_PATTERN.test(registrationId)) notFound();

  const session = await getUserSession();
  const result = await getRaceSummary(registrationId, session?.sub ?? null);

  if (result.kind === "not_found") notFound();
  if (result.kind === "not_finished") redirect(result.eventPath);

  return <RaceSummaryView summary={result.summary} />;
}

function RaceSummaryView({ summary }: { summary: RaceSummary }) {
  const { event } = summary;
  const location = formatEventArea(event.city, STATE_LABELS[event.state as AustralianState]);
  const hasResult = Boolean(summary.resultTime || summary.resultPlacement);
  const profileHref = summary.isOwner
    ? "/profile"
    : `/profile/${encodeURIComponent(summary.username ?? "")}`;
  const eventHref = `/events/${encodeURIComponent(event.slug ?? event.id)}`;

  const details = [
    { label: "Distance", value: summary.resultDistance },
    { label: "Wave", value: summary.wave },
    { label: "Bib", value: summary.bibNumber },
    { label: "Team", value: summary.teamName },
    { label: "Venue", value: event.venue },
  ].filter((d): d is { label: string; value: string } => Boolean(d.value?.trim()));

  return (
    <main className="min-h-screen bg-dark-darker pt-14">
      <section
        aria-labelledby="race-summary-title"
        className="relative isolate overflow-hidden border-b border-dark-lighter"
      >
        {event.coverImageUrl ? (
          <Image
            src={event.coverImageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover brightness-[0.45] saturate-110"
          />
        ) : (
          <div className="absolute inset-0 -z-10 placeholder-stripes opacity-40" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-dark-darker via-dark-darker/70 to-dark-darker/20" />

        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-6 pb-10 sm:pt-8 sm:pb-14">
          <Link
            href={profileHref}
            className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-light/80 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {summary.isOwner ? "Your profile" : `${summary.athleteLabel}'s profile`}
          </Link>

          <div className="mt-16 sm:mt-28">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-headline text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              <span className="inline-flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" />
                Race summary
              </span>
              <span className="text-light/60">{formatDiscipline(event.discipline)}</span>
            </p>
            <h1
              id="race-summary-title"
              className="mt-3 font-headline text-4xl sm:text-6xl font-black tracking-tighter text-light leading-[0.95] break-words"
            >
              {event.title}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-base text-light/80">
              <span>{formatEventDate(event.eventDate)}</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                {location}
              </span>
            </p>
            <p className="mt-5 font-headline text-sm font-bold uppercase tracking-widest text-light">
              {summary.athleteLabel}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 max-w-2xl" data-testid="race-summary-result">
            {hasResult ? (
              <>
                {summary.resultTime && (
                  <ResultStat
                    label="Finish time"
                    value={summary.resultTime}
                    icon={<Timer className="w-5 h-5 text-muted shrink-0" />}
                    fullWidth={!summary.resultPlacement}
                  />
                )}
                {summary.resultPlacement && (
                  <ResultStat
                    label="Placing"
                    value={summary.resultPlacement}
                    icon={<Medal className="w-5 h-5 text-muted shrink-0" />}
                    fullWidth={!summary.resultTime}
                  />
                )}
              </>
            ) : (
              <div className="col-span-2 rounded-2xl border border-dark-lighter bg-dark/80 backdrop-blur-sm px-5 py-4">
                <p className="font-headline text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                  Results
                </p>
                <p className="mt-1 text-light">
                  {event.organiser.orgName ?? "The organiser"} hasn&apos;t posted results yet.
                  {summary.isOwner ? " Your time and placing will show here once they do." : ""}
                </p>
              </div>
            )}
          </div>

          {(summary.isPersonalBest || summary.isTopResult) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {summary.isPersonalBest && <Badge>Personal best</Badge>}
              {summary.isTopResult && <Badge>Top result</Badge>}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <h2 className="font-headline text-2xl font-black tracking-tighter text-light">
            Race <span className="text-primary">details</span>
          </h2>
          {details.length > 0 ? (
            <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {details.map((d, i) => (
                <div
                  key={d.label}
                  className={cn(
                    "rounded-xl border border-dark-lighter bg-dark px-4 py-3 min-w-0",
                    // Two columns on a phone: an odd one out takes the full row
                    // rather than leaving a hole beside it.
                    details.length % 2 === 1 && i === details.length - 1 && "col-span-2 sm:col-span-1",
                  )}
                >
                  <dt className="font-headline text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                    {d.label}
                  </dt>
                  <dd className="mt-1 font-headline text-lg font-bold text-light break-words">{d.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted">No other details were recorded for this race.</p>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-dark-lighter bg-dark p-4">
            <p className="font-headline text-[11px] font-bold uppercase tracking-[0.18em] text-muted mb-3">
              Organised by
            </p>
            <OrganiserIdentity
              organiserId={event.organiser.id}
              name={event.organiser.orgName ?? "Organiser"}
              logoUrl={event.organiser.logoUrl}
            />
          </div>
          <Link
            href={eventHref}
            className="flex items-center justify-between rounded-2xl border border-dark-lighter bg-dark px-4 py-3 font-headline text-xs font-bold uppercase tracking-widest text-light hover:border-primary/40 hover:text-primary transition-colors"
          >
            Event page
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </aside>
      </section>
    </main>
  );
}

function ResultStat({
  label,
  value,
  icon,
  fullWidth,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  /** The only result posted (a DNF with no time, say) takes the whole row. */
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-dark-lighter bg-dark/80 backdrop-blur-sm px-4 py-3 sm:px-5 sm:py-4",
        fullWidth && "col-span-2",
      )}
    >
      <p className="font-headline text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1 flex items-center gap-2 font-headline text-2xl sm:text-4xl font-black tracking-tighter text-light leading-none break-words">
        {/* Side by side on a phone there is no room for the icon beside the value. */}
        <span className="hidden sm:inline-flex">{icon}</span>
        {value}
      </p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 font-headline text-[10px] font-bold uppercase tracking-widest text-darker">
      <Award className="w-3.5 h-3.5" />
      {children}
    </span>
  );
}
