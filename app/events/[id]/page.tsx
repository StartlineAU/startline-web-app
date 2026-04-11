import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Users, ExternalLink, ArrowRight,
  Clock, Calendar, Tag, Trophy, Package, Zap, Info,
  CheckCircle, XCircle, Ticket, Award, ShoppingBag,
  Camera, FileText, Accessibility, ParkingCircle,
} from "lucide-react";
import eventsData from "@/data/events.json";
import { FitnessEvent, EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatTime, formatShortDate } from "@/lib/utils";
import { fetchAllEvents } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const TYPE_IMAGES: Record<string, string[]> = {
  hyrox: [
    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=1920&q=80",
    "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=1920&q=80",
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1920&q=80",
  ],
  crossfit: [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1920&q=80",
    "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=1920&q=80",
  ],
  running: [
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1920&q=80",
    "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1920&q=80",
    "https://images.unsplash.com/photo-1544717305-2782549b5136?w=1920&q=80",
  ],
  hybrid: [
    "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1920&q=80",
    "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1920&q=80",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1920&q=80",
  ],
};

function getBannerImage(type: string, id: string): string {
  const pool = TYPE_IMAGES[type] ?? TYPE_IMAGES.running;
  return pool[id.charCodeAt(id.length - 1) % pool.length];
}

function getRelatedImage(type: string, id: string): string {
  const pool = TYPE_IMAGES[type] ?? TYPE_IMAGES.running;
  return pool[(id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % pool.length];
}

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

function getStatusLabel(event: FitnessEvent): { label: string; style: string } {
  const daysUntil = Math.ceil(
    (new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil < 0)   return { label: "Registration Closed", style: "bg-dark-lighter text-muted" };
  if (daysUntil <= 14) return { label: "Selling Fast",         style: "bg-primary text-dark" };
  return                       { label: "Live Registration",   style: "bg-primary text-dark" };
}

// ── Shared section header ─────────────────────────────────────────────────
function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-4 border-t border-dark-lighter pt-8 mb-8">
      <span className="font-headline text-xs font-black tracking-widest text-primary uppercase">
        {number}
      </span>
      <h2 className="font-headline text-xs font-black tracking-widest text-muted uppercase">
        {title}
      </h2>
    </div>
  );
}

// ── Info row used inside detail tiles ────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-3 border-b border-dark-lighter/40 last:border-0">
      <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted flex-shrink-0">
        {label}
      </span>
      <span className="font-headline text-sm font-bold text-light text-right leading-snug">
        {value}
      </span>
    </div>
  );
}

// ── Availability pill ─────────────────────────────────────────────────────
function AvailPill({ label, available }: { label: string; available?: boolean }) {
  if (available === undefined) return null;
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 border ${available ? "border-primary/40 bg-primary/5" : "border-dark-lighter bg-dark-lighter/30"}`}>
      {available
        ? <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
        : <XCircle className="w-4 h-4 text-muted flex-shrink-0" />}
      <span className={`font-headline text-xs font-bold uppercase tracking-widest ${available ? "text-primary" : "text-muted"}`}>
        {label}
      </span>
    </div>
  );
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const liveEvents = await fetchAllEvents();
  const jsonEvents = eventsData.events as FitnessEvent[];

  // Merge: JSON supplies placeholder/new fields, Supabase overrides the
  // authoritative base fields (title, date, location, etc.)
  const events: FitnessEvent[] = liveEvents.length > 0
    ? liveEvents.map((live) => {
        const json = jsonEvents.find((j) => j.id === live.id);
        return json ? { ...json, ...live } : live;
      })
    : jsonEvents;

  const event = events.find((e) => e.id === id);
  if (!event) notFound();

  const typeLabel   = EVENT_TYPE_LABELS[event.type];
  const stateLabel  = STATE_LABELS[event.state];
  const status      = getStatusLabel(event);
  const [day, month] = formatShortDate(event.date).split(" ");
  const bannerUrl   = getBannerImage(event.type, event.id);
  const mapsUrl     = `https://maps.google.com/?q=${encodeURIComponent(
    (event.streetAddress ? event.streetAddress + ", " : "") + event.location + ", " + event.city + ", Australia"
  )}`;

  const formatLabel =
    event.format === "team"  ? "Team" :
    event.format === "both"  ? "Individual & Team" : "Individual";

  const relatedEvents = events
    .filter((e) => e.id !== event.id && e.type === event.type)
    .slice(0, 3);

  // Section visibility guards
  const hasPrizes = !!(event.prizeStructure || event.prizePoolTotal || event.ageGroupCategories || event.ceremonyDate || event.specialAwards);
  const hasExpo   = !!(event.hasExpo || event.expoDetails || event.vendorOpportunities || event.bibCollectionInfo || event.athleteBriefing);
  const hasAdditional = !!(event.participantCap || event.minAge || event.accessibilityInfo || event.parkingInfo || event.bagDropInfo || event.resultsProvider || event.resultsLink || event.additionalNotes);
  const hasPricing = !!(event.entryFeeInclusions || event.optionalExtras || event.groupDiscount || event.charityComponent);
  const hasRegistrationDetail = !!(event.ticketDrops?.length || event.registrationCloseDate || event.transferPolicy || event.refundPolicy || event.waitlistAvailable !== undefined);
  const hasCategories = !!(event.categories?.length || event.workoutDescription || event.soloAvailable !== undefined || event.partnerAvailable !== undefined || event.teamAvailable !== undefined);

  return (
    <div className="min-h-screen bg-dark-darker">

      {/* ── HERO ── */}
      <section className="relative h-[700px] w-full overflow-hidden">
        <img
          src={bannerUrl}
          alt={event.title}
          className="absolute inset-0 w-full h-full object-cover brightness-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 pb-12">
          <div className="max-w-[1440px] mx-auto px-8">
            <div className="max-w-3xl">
              <Link
                href="/events"
                className="inline-flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors mb-6 group"
              >
                <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                All Events
              </Link>

              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className={`font-headline text-xs font-bold uppercase tracking-widest px-3 py-1.5 ${status.style}`}>
                  {status.label}
                </span>
                <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                  {typeLabel}
                </span>
                {event.isOfficial && (
                  <span className="font-headline text-xs font-medium uppercase tracking-widest text-primary border border-primary/40 px-2 py-1">
                    Official
                  </span>
                )}
              </div>

              <h1 className="font-headline text-6xl md:text-8xl font-black italic tracking-tighter leading-none mb-4 text-light">
                {event.title.split(" ").map((word, i, arr) =>
                  i === arr.length - 1
                    ? <span key={i} className="text-primary"> {word}</span>
                    : <span key={i}>{i > 0 ? " " : ""}{word}</span>
                )}
              </h1>

              <p className="font-headline font-medium max-w-xl text-muted leading-relaxed mb-6">
                {event.description}
              </p>

              <a
                href={event.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-4 bg-primary hover:bg-primary/90 text-dark font-headline font-black text-xl uppercase tracking-tighter px-8 py-5 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all duration-100 active:translate-x-0 active:translate-y-0"
              >
                REGISTER NOW
                <ExternalLink className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUICK STATS BAR ── */}
      <section className="max-w-[1440px] mx-auto px-8 py-0.5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0.5 bg-dark-darker">
          {/* Date */}
          <div className="bg-dark p-6 flex items-center gap-4">
            <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <span className="font-headline text-xs tracking-widest text-muted uppercase block mb-1">Date</span>
              <span className="font-headline text-xl font-black text-light">
                {day} <span className="text-primary">{month}</span>
              </span>
            </div>
          </div>
          {/* Start Time */}
          <div className="bg-dark p-6 flex items-center gap-4">
            <Clock className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <span className="font-headline text-xs tracking-widest text-muted uppercase block mb-1">Start Time</span>
              <span className="font-headline text-xl font-black text-light">
                {formatTime(event.time)}
              </span>
            </div>
          </div>
          {/* Location */}
          <div className="bg-dark p-6 flex items-center gap-4">
            <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <span className="font-headline text-xs tracking-widest text-muted uppercase block mb-1">Location</span>
              <span className="font-headline text-xl font-black text-light">
                {event.city}, <span className="text-primary">{stateLabel}</span>
              </span>
            </div>
          </div>
          {/* Format */}
          <div className="bg-dark p-6 flex items-center gap-4">
            <Users className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <span className="font-headline text-xs tracking-widest text-muted uppercase block mb-1">Format</span>
              <span className="font-headline text-xl font-black text-light">{formatLabel}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-[1440px] mx-auto px-8 py-12">

        {/* ── SECTION 1: Event Basics ── */}
        <SectionHeader number="01" title="Event Basics" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 bg-dark-darker mb-16">
          {/* Full description */}
          <div className="md:col-span-2 bg-dark p-8">
            <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">About This Event</span>
            <p className="font-headline font-medium text-base text-muted leading-relaxed mb-4">
              {event.fullDescription ?? event.description}
            </p>
            {event.organizer && (
              <div className="flex items-center gap-2 mt-6 pt-6 border-t border-dark-lighter">
                <Users className="w-4 h-4 text-primary" />
                <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                  Organised by
                </span>
                <span className="font-headline text-sm font-bold uppercase tracking-widest text-light">
                  {event.organizer}
                </span>
              </div>
            )}
          </div>

          {/* Tags + CTA */}
          <div className="bg-dark p-8 flex flex-col gap-6 border-l-4 border-primary">
            <div>
              <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">Discipline</span>
              <div className="flex flex-wrap gap-2">
                <span className="bg-primary text-dark font-headline text-xs font-bold uppercase tracking-widest px-4 py-2">
                  {typeLabel}
                </span>
                {event.isOfficial && (
                  <span className="border border-primary/40 text-primary font-headline text-xs font-bold uppercase tracking-widest px-4 py-2">
                    Official Event
                  </span>
                )}
                {event.distance && (
                  <span className="bg-dark-lighter text-light font-headline text-xs font-bold uppercase tracking-widest px-4 py-2">
                    {event.distance}
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">Level</span>
              <span className="font-headline text-2xl font-black italic text-light">
                {event.level === "elite" ? "Elite" : event.level === "beginner" ? "Beginner" : "Open"}
              </span>
            </div>

            <div className="mt-auto">
              <a
                href={event.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-primary hover:bg-primary/90 text-dark font-headline text-sm font-black uppercase tracking-widest px-6 py-4 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all duration-100 active:translate-x-0 active:translate-y-0"
              >
                <span>Register Now</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Date, Time & Location ── */}
        <SectionHeader number="02" title="Date, Time & Location" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 bg-dark-darker mb-8">
          {/* Dates tile */}
          <div className="bg-dark p-8">
            <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
              <Calendar className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
              Event Date(s)
            </span>
            {event.dates && event.dates.length > 1 ? (
              <div className="flex flex-col gap-2">
                {event.dates.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="font-headline text-xs font-medium uppercase tracking-widest text-primary w-16">
                      Day {i + 1}
                    </span>
                    <span className="font-headline text-sm font-bold text-light">{d}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div className="font-headline text-5xl font-black text-primary leading-none">{day}</div>
                <div className="font-headline text-lg font-bold uppercase text-light mt-1">{month}</div>
              </div>
            )}
          </div>

          {/* Times tile */}
          <div className="bg-dark p-8">
            <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
              <Clock className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
              Times
            </span>
            <div className="flex flex-col gap-0">
              <InfoRow label="Start Time" value={formatTime(event.time)} />
              {event.endTime && (
                <InfoRow label="Finish Time" value={formatTime(event.endTime)} />
              )}
              {event.cutOffTime && (
                <InfoRow label="Cut-off Time" value={formatTime(event.cutOffTime)} />
              )}
            </div>
          </div>

          {/* Venue tile */}
          <div className="bg-dark p-8">
            <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
              <MapPin className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
              Venue
            </span>
            <div className="font-headline text-2xl font-black italic text-light leading-tight mb-2">
              {event.location}
            </div>
            {event.streetAddress && (
              <p className="font-headline text-sm font-medium text-muted tracking-wide mb-1">
                {event.streetAddress}
              </p>
            )}
            <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted">
              {event.city}, {stateLabel}{event.country ? `, ${event.country}` : ""}
            </p>
          </div>
        </div>

        {/* Course Map */}
        <div className="mb-16">
          <a
            href={event.courseMapUrl ?? mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-40 w-full bg-dark border border-dark-lighter overflow-hidden relative group"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <MapPin className="w-6 h-6 text-primary" />
              <span className="font-headline text-xs font-bold uppercase tracking-widest text-primary group-hover:underline">
                {event.courseMapUrl ? "View Course Map" : "View on Google Maps"}
              </span>
              <span className="font-headline text-xs text-muted uppercase tracking-widest">
                {event.city}, {stateLabel}
              </span>
            </div>
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "linear-gradient(#d4ff00 1px, transparent 1px), linear-gradient(90deg, #d4ff00 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          </a>
        </div>

        {/* ── SECTION 3: Categories & Distances ── */}
        {hasCategories && (
          <>
            <SectionHeader number="03" title="Categories & Distances" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5 bg-dark-darker mb-16">
              {/* Distances / categories */}
              <div className="bg-dark p-8">
                <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
                  <Tag className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                  Available Distances / Categories
                </span>
                {event.categories && event.categories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {event.categories.map((cat) => (
                      <span
                        key={cat}
                        className="font-headline text-sm font-bold uppercase tracking-widest text-dark bg-primary px-4 py-2"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                ) : event.distance ? (
                  <span className="font-headline text-3xl font-black italic text-primary">{event.distance}</span>
                ) : (
                  <span className="font-headline text-sm text-muted">To be confirmed</span>
                )}

                {/* Participation types */}
                {(event.soloAvailable !== undefined || event.partnerAvailable !== undefined || event.teamAvailable !== undefined) && (
                  <div className="mt-6 pt-6 border-t border-dark-lighter">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">Participation Options</span>
                    <div className="flex flex-wrap gap-2">
                      <AvailPill label="Solo / Individual" available={event.soloAvailable} />
                      <AvailPill label="Partner / Duo" available={event.partnerAvailable} />
                      <AvailPill label="Team Entry" available={event.teamAvailable} />
                    </div>
                  </div>
                )}
              </div>

              {/* Workout description */}
              {event.workoutDescription && (
                <div className="bg-dark p-8">
                  <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
                    <Zap className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                    The Workout
                  </span>
                  <p className="font-headline text-sm font-medium text-muted leading-relaxed">
                    {event.workoutDescription}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── SECTION 4: Registration & Ticket Drops ── */}
        {hasRegistrationDetail && (
          <>
            <SectionHeader number="04" title="Registration & Ticket Drops" />
            <div className="mb-16">
              {/* Ticket tier cards */}
              {event.ticketDrops && event.ticketDrops.length > 0 && (
                <div className={`grid grid-cols-1 gap-0.5 bg-dark-darker mb-0.5 ${
                  event.ticketDrops.length === 1 ? "md:grid-cols-1" :
                  event.ticketDrops.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
                }`}>
                  {event.ticketDrops.map((drop, i) => (
                    <div key={i} className={`bg-dark p-8 ${i === 0 ? "border-l-4 border-primary" : ""}`}>
                      <div className="flex items-center gap-2 mb-4">
                        <Ticket className="w-4 h-4 text-primary" />
                        <span className="font-headline text-xs font-bold uppercase tracking-widest text-muted">
                          {drop.label}
                        </span>
                      </div>
                      <div className="font-headline text-4xl font-black text-primary leading-none mb-3">
                        {drop.price}
                      </div>
                      <div className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                        {drop.date}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Policies row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 bg-dark-darker">
                {event.registrationCloseDate && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">Registration Closes</span>
                    <span className="font-headline text-2xl font-black italic text-light">{event.registrationCloseDate}</span>
                  </div>
                )}
                {event.transferPolicy && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                      <FileText className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Transfer / Change Policy
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.transferPolicy}</p>
                  </div>
                )}
                {event.refundPolicy && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                      <FileText className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Refund / Deferral Policy
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.refundPolicy}</p>
                  </div>
                )}
                {event.waitlistAvailable !== undefined && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">Waitlist</span>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 ${event.waitlistAvailable ? "bg-primary/10 border border-primary/40" : "bg-dark-lighter border border-dark-lighter"}`}>
                      {event.waitlistAvailable
                        ? <CheckCircle className="w-4 h-4 text-primary" />
                        : <XCircle className="w-4 h-4 text-muted" />}
                      <span className={`font-headline text-sm font-bold uppercase tracking-widest ${event.waitlistAvailable ? "text-primary" : "text-muted"}`}>
                        {event.waitlistAvailable ? "Waitlist Available" : "No Waitlist"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── SECTION 5: Cost & Pricing ── */}
        {hasPricing && (
          <>
            <SectionHeader number="05" title="Cost & Pricing" />
            <div className="mb-16">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5 bg-dark-darker">
                {event.entryFeeInclusions && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
                      <Package className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Inclusions in Entry Fee
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.entryFeeInclusions}</p>
                  </div>
                )}
                {event.optionalExtras && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
                      <ShoppingBag className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Optional Extras / Add-ons
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.optionalExtras}</p>
                  </div>
                )}
                {event.groupDiscount && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
                      <Users className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Group / Corporate Discount
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.groupDiscount}</p>
                  </div>
                )}
              </div>
              {event.charityComponent && (
                <div className="mt-0.5 bg-dark border-l-4 border-primary p-8">
                  <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                    Charity / Fundraising Component
                  </span>
                  <p className="font-headline text-base font-medium text-light leading-relaxed">{event.charityComponent}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── SECTION 6: Prizes & Awards ── */}
        {hasPrizes && (
          <>
            <SectionHeader number="06" title="Prizes & Awards" />
            <div className="mb-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 bg-dark-darker">
                {event.prizePoolTotal && (
                  <div className="bg-dark p-8 flex flex-col justify-between">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
                      <Trophy className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Prize Pool Total
                    </span>
                    <div className="font-headline text-5xl font-black text-primary leading-none">
                      {event.prizePoolTotal}
                    </div>
                  </div>
                )}
                {event.prizeStructure && (
                  <div className={`bg-dark p-8 ${!event.prizePoolTotal ? "md:col-span-2" : ""}`}>
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
                      Prize Structure Overview
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.prizeStructure}</p>
                  </div>
                )}
                {event.ageGroupCategories && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
                      Age Group Categories
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.ageGroupCategories}</p>
                  </div>
                )}
              </div>

              {(event.ceremonyDate || event.ceremonyLocation || event.specialAwards) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 bg-dark-darker mt-0.5">
                  {event.ceremonyDate && (
                    <div className="bg-dark p-8">
                      <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                        <Award className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                        Award Ceremony
                      </span>
                      <div className="font-headline text-xl font-black italic text-light">{event.ceremonyDate}</div>
                      {event.ceremonyLocation && (
                        <p className="font-headline text-sm font-medium text-muted mt-2">{event.ceremonyLocation}</p>
                      )}
                    </div>
                  )}
                  {event.specialAwards && (
                    <div className="bg-dark p-8 md:col-span-2">
                      <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">Special Awards</span>
                      <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.specialAwards}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── SECTION 7: Expo & Public Activations ── */}
        {hasExpo && (
          <>
            <SectionHeader number="07" title="Expo & Public Activations" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5 bg-dark-darker mb-16">
              {(event.hasExpo !== undefined || event.expoDetails) && (
                <div className="bg-dark p-8">
                  <span className="font-headline text-xs tracking-widest text-muted uppercase mb-4 block">
                    Expo / Festival
                  </span>
                  {event.hasExpo !== undefined && (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 mb-4 ${event.hasExpo ? "bg-primary/10 border border-primary/40" : "border border-dark-lighter"}`}>
                      {event.hasExpo
                        ? <CheckCircle className="w-4 h-4 text-primary" />
                        : <XCircle className="w-4 h-4 text-muted" />}
                      <span className={`font-headline text-sm font-bold uppercase tracking-widest ${event.hasExpo ? "text-primary" : "text-muted"}`}>
                        {event.hasExpo ? "Expo Included" : "No Expo"}
                      </span>
                    </div>
                  )}
                  {event.expoDetails && (
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.expoDetails}</p>
                  )}
                  {event.vendorOpportunities !== undefined && (
                    <div className="mt-4 pt-4 border-t border-dark-lighter">
                      <AvailPill label="Exhibitor / Vendor Opportunities" available={event.vendorOpportunities} />
                    </div>
                  )}
                </div>
              )}

              <div className="bg-dark p-8 flex flex-col gap-6">
                {event.bibCollectionInfo && (
                  <div>
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                      <Tag className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Packet Pick-up / Bib Collection
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.bibCollectionInfo}</p>
                  </div>
                )}
                {event.athleteBriefing && (
                  <div className={event.bibCollectionInfo ? "pt-6 border-t border-dark-lighter" : ""}>
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                      <Info className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Athlete / Participant Briefing
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.athleteBriefing}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── SECTION 8: Additional Information ── */}
        {hasAdditional && (
          <>
            <SectionHeader number="08" title="Additional Information" />
            <div className="mb-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 bg-dark-darker">
                {event.participantCap && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-2 block">
                      <Users className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Participant Cap
                    </span>
                    <div className="font-headline text-3xl font-black text-light">{event.participantCap}</div>
                  </div>
                )}
                {event.minAge && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-2 block">Minimum Age</span>
                    <div className="font-headline text-3xl font-black text-light">{event.minAge}</div>
                  </div>
                )}
                {event.accessibilityInfo && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                      <Accessibility className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Accessibility
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.accessibilityInfo}</p>
                  </div>
                )}
                {event.parkingInfo && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                      <ParkingCircle className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Parking & Transport
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.parkingInfo}</p>
                  </div>
                )}
                {event.bagDropInfo && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                      <ShoppingBag className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Bag Drop / Gear Storage
                    </span>
                    <p className="font-headline text-sm font-medium text-muted leading-relaxed">{event.bagDropInfo}</p>
                  </div>
                )}
                {(event.resultsProvider || event.resultsLink) && (
                  <div className="bg-dark p-8">
                    <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                      <Camera className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                      Photography & Results
                    </span>
                    {event.resultsProvider && (
                      <p className="font-headline text-sm font-bold text-light mb-2">{event.resultsProvider}</p>
                    )}
                    {event.resultsLink && (
                      <a
                        href={event.resultsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline flex items-center gap-1.5"
                      >
                        View Results
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {event.additionalNotes && (
                <div className="mt-0.5 bg-dark border-l-4 border-primary p-8">
                  <span className="font-headline text-xs tracking-widest text-muted uppercase mb-3 block">
                    <Info className="w-3.5 h-3.5 inline-block mr-2 text-primary" />
                    Additional Notes
                  </span>
                  <p className="font-headline text-base font-medium text-muted leading-relaxed">{event.additionalNotes}</p>
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* ── RELATED EVENTS ── */}
      {relatedEvents.length > 0 && (
        <section className="bg-dark py-16 mt-0.5">
          <div className="max-w-[1440px] mx-auto px-8">
            <div className="flex justify-between items-end mb-10 border-b border-dark-lighter pb-6">
              <h2 className="font-headline text-4xl font-black uppercase tracking-tighter italic text-light">
                RECOMMENDED <span className="text-primary">EVENTS</span>
              </h2>
              <Link
                href="/events"
                className="font-headline text-sm font-bold text-primary hover:text-light transition-colors flex items-center gap-2 group"
              >
                VIEW ALL EVENTS
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 bg-dark-darker">
              {relatedEvents.map((related) => {
                const [relDay, relMonth] = formatShortDate(related.date).split(" ");
                const relImg = getRelatedImage(related.type, related.id);
                return (
                  <Link key={related.id} href={`/events/${related.id}`} className="group bg-dark-darker overflow-hidden border border-dark-lighter/5 hover:border-primary/30 transition-all">
                    <div className="relative h-56 overflow-hidden">
                      <img
                        src={relImg}
                        alt={related.title}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                      />
                      <div className="absolute top-3 right-3 bg-dark/80 backdrop-blur-sm px-3 py-1">
                        <span className="font-headline text-xs font-bold tracking-widest uppercase text-muted">
                          {EVENT_TYPE_LABELS[related.type]}
                        </span>
                      </div>
                    </div>
                    <div className="bg-dark p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-headline text-xl font-black uppercase italic leading-tight text-light group-hover:text-primary transition-colors flex-1">
                          {related.title}
                        </h3>
                      </div>
                      <div className="flex justify-between items-center font-headline text-xs uppercase tracking-widest text-muted">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-primary" />
                          {related.city}, {STATE_LABELS[related.state]}
                        </span>
                        <span>{relDay} {relMonth}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── BACK CTA ── */}
      <div className="max-w-[1440px] mx-auto px-8 py-10">
        <div className="border-t border-dark-lighter pt-8 flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors group"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
            Back to All Events
          </Link>
          <a
            href={event.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-primary text-dark font-headline text-xs font-black uppercase tracking-widest px-6 py-3 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all duration-100"
          >
            Register
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

    </div>
  );
}

export async function generateStaticParams() {
  const liveEvents = await fetchAllEvents();
  const jsonEvents = eventsData.events as FitnessEvent[];
  const events: FitnessEvent[] = liveEvents.length > 0
    ? liveEvents.map((live) => {
        const json = jsonEvents.find((j) => j.id === live.id);
        return json ? { ...json, ...live } : live;
      })
    : jsonEvents;
  return events.map((event) => ({ id: event.id }));
}
