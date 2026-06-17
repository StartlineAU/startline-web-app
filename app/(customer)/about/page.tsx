import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

const ABOUT_MISSION = { width: 4702, height: 3608 } as const;

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-dark-darker">

      <section className="relative bg-dark-darker overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-0 right-0 z-0 h-[min(66.792vh,698px)] min-h-[365px]">
          <Image
            src="/images/about/about-hero.jpg"
            alt="Athletes at a fitness event"
            fill
            priority
            className="object-cover object-center brightness-[0.38]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-dark-darker/95 via-dark-darker/75 to-dark-darker/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-transparent to-dark-darker/55" />
        </div>

        <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 pt-28 sm:pt-40 pb-12 sm:pb-20">
          <h1 className="font-headline text-[36px] sm:text-5xl lg:text-7xl font-black italic tracking-tighter text-light leading-tight mb-8 sm:mb-12">
            About <span className="text-primary">us</span>
          </h1>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
            <div>
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-6 flex items-center gap-3">
                <span className="w-10 h-px bg-primary inline-block" />
                01 // Mission &amp; vision
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
                  Endurance &amp; more
                </p>
                <p className="text-light/85 text-sm leading-relaxed">
                  StartLine isn&apos;t limited to one kind of effort. We list endurance events across
                  distances and formats &mdash; road, trail, turf, and longer tests &mdash; right next to comps and
                  community sessions, so your next start line matches how you actually train.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-dark py-10 sm:py-16 border-b border-dark-lighter/50">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 lg:items-start">
            <div className="flex flex-col gap-5 sm:gap-8 lg:col-span-7">
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary flex items-center gap-3">
                <span className="hidden sm:inline-block w-10 h-px bg-primary" />
                02 // Why athletes choose us
              </p>
              <h2 className="font-headline text-4xl lg:text-5xl font-black italic tracking-tighter text-light leading-tight max-w-2xl">
                From invisible events to{" "}
                <span className="text-primary">your next start line.</span>
              </h2>
              <p className="text-muted text-lg leading-relaxed max-w-2xl">
                Too many running events, functional fitness competitions, and community-based training
                groups go unrecognised until someone posts a finish-line photo. With a centralised fitness
                competition platform, StartLine helps connect users to organisers &mdash; so you hear about the
                opportunity when it matters, not only after the fact.
              </p>
            </div>
            <div className="flex w-full justify-center lg:col-span-5 lg:justify-end">
              <Image
                src="/images/about/about-mission.jpg"
                alt="Wheelchair athletes racing on a city course"
                width={ABOUT_MISSION.width}
                height={ABOUT_MISSION.height}
                className="h-auto w-full max-w-xl"
                sizes="(max-width: 1024px) 100vw, 36rem"
                quality={100}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-dark-darker border-t border-dark-lighter">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-xl">
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary flex items-center gap-3 mb-5">
              <span className="w-10 h-px bg-primary inline-block" />
              Australia&apos;s Fitness Event Calendar
            </p>
            <h2 className="font-headline text-4xl lg:text-5xl font-black italic tracking-tighter text-light leading-tight mb-4">
              Where is your<br />
              <span className="text-primary">next start line?</span>
            </h2>
            <p className="text-muted text-sm leading-relaxed">
              HYROX, CrossFit, running and hybrid events across Australia &mdash; all in one place.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <Link
              href="/events"
              className="bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-8 py-4 rounded-xl machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Browse Events
            </Link>
            <Link
              href="/organiser/register"
              className="border border-dark-lighter text-muted font-headline text-sm font-bold uppercase tracking-widest px-8 py-4 rounded-xl hover:border-primary/50 hover:text-light transition-colors flex items-center gap-2"
            >
              List Your Event
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
