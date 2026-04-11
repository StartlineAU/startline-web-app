import Image from "next/image";
import Link from "next/link";
import { Zap } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-dark-darker">

      {/* ── MISSION & VISION over hero image ── */}
      <section className="relative min-h-[min(88vh,920px)] overflow-hidden">
        <Image
          src="/images/about/about-hero.jpg"
          alt="Athletes at a fitness event"
          fill
          priority
          className="object-cover brightness-[0.38]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-darker/95 via-dark-darker/75 to-dark-darker/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-transparent to-dark-darker/55" />

        <div className="relative z-10 max-w-[1440px] mx-auto px-6 pt-[calc(6rem+4cm)] sm:pt-[calc(7rem+4cm)] pb-20 sm:pb-28">
          <h1 className="font-headline text-5xl sm:text-6xl lg:text-7xl font-black italic tracking-tighter text-light leading-none -mt-[2cm] mb-10 sm:mb-12">
            About <span className="text-primary">us</span>
          </h1>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-6 flex items-center gap-3">
                <span className="w-10 h-px bg-primary inline-block" />
                01 // Mission & vision
              </p>
              <h2 className="font-headline text-4xl lg:text-5xl font-black italic tracking-tighter text-light leading-tight">
                Why we{" "}
                <span className="text-light/60">built StartLine.</span>
              </h2>
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-3">
                  Mission
                </h3>
                <p className="text-light/90 text-lg leading-relaxed">
                  StartLine was founded to help uncover fitness events by providing a primary platform
                  to connect users with upcoming competitions, local events, communities, and organisers.
                </p>
              </div>
              <div>
                <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-3">
                  Vision
                </h3>
                <p className="text-light/90 text-lg leading-relaxed">
                  As social media develops and expands the fitness industry, so too does the gap between
                  users and events. Our vision for Startline is to connect people through fitness.
                </p>
              </div>
              <div className="border-l-4 border-primary bg-dark/90 backdrop-blur-sm px-6 py-5">
                <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">
                  Endurance & more
                </p>
                <p className="text-light/85 text-sm leading-relaxed">
                  StartLine isn&apos;t limited to one kind of effort. We list endurance events across
                  distances and formats — road, trail, turf, and longer tests — right next to comps and
                  community sessions, so your next start line matches how you actually train.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY ATHLETES CHOOSE US ── */}
      <section className="bg-dark py-24 border-b border-dark-lighter/50">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4">
                02 // Why athletes choose us
              </p>
              <h2 className="font-headline text-4xl lg:text-5xl font-black italic tracking-tighter text-light leading-tight mb-8 max-w-3xl">
                From invisible events to{" "}
                <span className="text-muted">your next start line.</span>
              </h2>
              <p className="text-muted text-lg leading-relaxed max-w-3xl">
                Too many running events, functional fitness competitions, and community-based training
                groups go unrecognised until someone posts a finish-line photo. With a centralised fitness
                competition platform, StartLine helps connect users to organisers — so you hear about the
                opportunity when it matters, not only after the fact.
              </p>
            </div>
            <div className="relative aspect-[4/5] w-full mx-auto lg:mx-0 border border-dark-lighter overflow-hidden bg-dark">
              <Image
                src="/images/about/about-mission.jpg"
                alt="Woman practising yoga"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-[1440px] mx-auto px-6 pt-24 pb-24">
        <div className="relative bg-dark border border-dark-lighter overflow-hidden">
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
