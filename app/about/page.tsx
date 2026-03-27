import Link from "next/link";
import { ArrowRight, Compass, BarChart2, Users, Zap } from "lucide-react";

const TEAM = [
  {
    name: "MARCUS T.",
    role: "Chief of Engineering",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
  },
  {
    name: "ELENA C.",
    role: "Head of Data Science",
    img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
  },
  {
    name: "DAVID V.",
    role: "Lead Product Designer",
    img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
  },
];

const PILLARS = [
  {
    icon: <Compass className="w-8 h-8 text-primary" />,
    label: "Discovery",
    tag: "Event Aggregation",
    body: "Finding your next challenge shouldn't be the hardest part of the race. Our discovery engine aggregates events across Australia with surgical precision, filtered by discipline, location, and date.",
  },
  {
    icon: <BarChart2 className="w-8 h-8 text-primary" />,
    label: "Performance",
    tag: "Telemetry Analysis",
    body: "Data is only as good as the insight it generates. We provide a heads-up display for your training, translating raw information into actionable event intelligence and competitive context.",
  },
  {
    icon: <Users className="w-8 h-8 text-primary" />,
    label: "Community",
    tag: "Kinetic Social Mesh",
    body: "Connecting athletes through shared intent. Our community layer isn't about social validation — it's about collective advancement, elite-level mentorship, and the competitive fire of shared goals.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-dark-darker">

      {/* ── HERO ── */}
      <section className="relative min-h-[480px] flex items-start overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=1920&q=80"
          alt="Athletes racing"
          className="absolute inset-0 w-full h-full object-cover brightness-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-darker/95 via-dark-darker/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-transparent to-dark-darker/50" />

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 pt-48 pb-24">
          <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4">
            01 // Origin
          </p>
          <h1 className="font-headline text-5xl sm:text-6xl lg:text-7xl font-black italic tracking-tighter text-light leading-none max-w-4xl">
            Bridging the Gap Between{" "}
            <span className="text-primary">Discovery</span> and Performance.
          </h1>
        </div>
      </section>

      {/* ── OUR STORY ── */}
      <section className="max-w-[1440px] mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Left */}
          <div>
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-6 flex items-center gap-3">
              <span className="w-10 h-px bg-primary inline-block" />
              01 // Origin
            </p>
            <h2 className="font-headline text-4xl lg:text-5xl font-black italic tracking-tighter text-light leading-tight">
              Machined for Precision.{" "}
              <span className="text-muted">Built for Athletes.</span>
            </h2>
          </div>

          {/* Right */}
          <div className="space-y-6">
            <p className="text-muted text-lg leading-relaxed">
              StartLine was founded with a singular, unyielding objective: to eliminate the friction
              that exists between an athlete&apos;s potential and their execution. We saw a landscape
              fractured by disparate platforms — data lived in one silo, events in another, and
              community in the shadows.
            </p>
            <p className="text-muted text-lg leading-relaxed">
              We engineered a unified architecture. A platform machined for precision, designed to
              serve those who measure progress in milliseconds and heartbeats. This isn&apos;t just
              about logging miles; it&apos;s about the kinetic energy of a community moving toward
              excellence.
            </p>

            {/* Philosophy quote */}
            <div className="border-l-4 border-primary bg-dark px-6 py-5 mt-8">
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">
                Philosophy
              </p>
              <p className="font-headline text-xl italic text-light leading-snug">
                &ldquo;Complexity is the enemy of performance. We build the tools that make speed simple.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── THREE PILLARS ── */}
      <section className="bg-dark-darker py-24">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="flex items-end justify-between mb-16">
            <div>
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">
                02 // Core Mission
              </p>
              <h2 className="font-headline text-4xl font-black italic tracking-tighter text-light">
                The Three Pillars
              </h2>
            </div>
            <span className="hidden md:block font-headline text-xs font-medium uppercase tracking-widest text-muted">
              Vertical Integration // Kinetic Sync
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 bg-dark-darker">
            {PILLARS.map((pillar) => (
              <div
                key={pillar.label}
                className="bg-dark p-10 group hover:bg-dark-light transition-colors duration-300"
              >
                <div className="mb-8">{pillar.icon}</div>
                <h3 className="font-headline text-2xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors mb-4">
                  {pillar.label}
                </h3>
                <p className="text-muted leading-relaxed mb-8 text-sm">{pillar.body}</p>
                <div className="flex items-center gap-3">
                  <span className="w-8 h-px bg-primary inline-block" />
                  <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                    {pillar.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE COLLECTIVE ── */}
      <section className="max-w-[1440px] mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Left: intro */}
          <div className="lg:col-span-1">
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4">
              03 // The Collective
            </p>
            <h2 className="font-headline text-4xl font-black italic tracking-tighter text-light leading-tight mb-6">
              Machined by Athletes, for Athletes.
            </h2>
            <p className="text-muted leading-relaxed mb-8 text-sm">
              We are a lean collective of engineers, sports scientists, and endurance specialists
              based in Melbourne, Australia. Our team operates at the intersection of high-frequency
              data and high-intensity sport.
            </p>
            <Link
              href="/contact"
              className="flex items-center gap-3 group w-fit"
            >
              <span className="font-headline text-sm font-bold uppercase tracking-widest text-light group-hover:text-primary transition-colors">
                View Open Positions
              </span>
              <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Right: team cards */}
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-0.5 bg-dark-darker">
            {TEAM.map((member) => (
              <div
                key={member.name}
                className="aspect-[3/4] bg-dark relative overflow-hidden group"
              >
                <img
                  src={member.img}
                  alt={member.name}
                  className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 opacity-60 group-hover:opacity-100 brightness-75 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <span className="font-headline text-xs font-bold text-primary block">{member.name}</span>
                  <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">{member.role}</span>
                </div>
              </div>
            ))}

            {/* Join tile */}
            <div className="aspect-[3/4] bg-dark border-2 border-dashed border-dark-lighter flex flex-col items-center justify-center gap-3 p-4">
              <Users className="w-8 h-8 text-muted" />
              <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted text-center">
                Join The Mission
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-[1440px] mx-auto px-6 pb-24">
        <div className="relative bg-dark border border-dark-lighter overflow-hidden">
          {/* HUD corners */}
          <div className="absolute top-4 left-4 w-8 h-8 hud-corner-tl" />
          <div className="absolute top-4 right-4 w-8 h-8 hud-corner-tr" />
          <div className="absolute bottom-4 left-4 w-8 h-8 hud-corner-bl" />
          <div className="absolute bottom-4 right-4 w-8 h-8 hud-corner-br" />

          <div className="px-12 py-16 text-center">
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-4">
              Ready?
            </p>
            <h2 className="font-headline text-4xl sm:text-5xl font-black italic tracking-tighter text-light mb-4">
              Ready to Redefine Your{" "}
              <span className="text-primary">StartLine</span>?
            </h2>
            <p className="text-muted max-w-lg mx-auto mb-8 text-sm">
              Experience the precision of Australia&apos;s most comprehensive fitness event platform.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/events"
                className="bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-8 py-4 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Find Events Now
              </Link>
              <Link
                href="/contact"
                className="border border-primary/30 text-light font-headline text-sm font-bold uppercase tracking-widest px-8 py-4 hover:border-primary hover:text-primary transition-colors"
              >
                Get In Touch
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
