import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Meet the team behind Startline — Australia's fitness event calendar. Founded by Lachlan Martin, Nathan Sweet, Hugo Shrowder, and Noah Helu.",
  openGraph: {
    title: "About Us | Startline",
    description:
      "Meet the team behind Startline — Australia's fitness event calendar.",
    url: "/about",
    images: [
      {
        url: "/images/about/about-hero.jpg",
        width: 1200,
        height: 630,
        alt: "About Startline",
      },
    ],
  },
  twitter: {
    title: "About Us | Startline",
    description:
      "Meet the team behind Startline — Australia's fitness event calendar.",
    images: ["/images/about/about-hero.jpg"],
  },
  alternates: {
    canonical: "/about",
  },
};

const founders = [
  {
    name: "Lachlan Martin",
    initials: "LM",
    bio: "Lachlan brings a lifelong passion for fitness and competition to Startline. With experience building products that connect communities, he drives the vision and strategy behind the platform.",
  },
  {
    name: "Nathan Sweet",
    initials: "NS",
    bio: "Nathan combines deep technical expertise with a love of endurance sport. He architects the systems that make discovering and registering for events seamless.",
  },
  {
    name: "Hugo Shrowder",
    initials: "HS",
    bio: "Hugo shapes the athlete experience with a sharp eye for design and detail. He ensures every interaction on Startline feels fast, precise, and purposeful.",
  },
  {
    name: "Noah Helu",
    initials: "NH",
    bio: "Noah brings a competitive drive and deep understanding of the athlete journey to Startline. He focuses on building the tools that make event registration and management effortless.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-dark-darker">
      {/* ── Hero ── */}
      <section className="relative min-h-[520px] sm:min-h-[600px] flex items-end overflow-hidden">
        <Image
          src="/images/about/about-hero.jpg"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-darker via-darker/55 to-darker/30" />
        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-6 pb-10 sm:pb-14">
          <p className="font-headline text-[10px] sm:text-xs font-black uppercase tracking-widest text-primary mb-3">
            About
          </p>
          <h1 className="font-headline text-[44px] sm:text-6xl lg:text-7xl font-black italic leading-none tracking-tighter text-light max-w-3xl">
            Built for the <span className="text-primary">start line.</span>
          </h1>
          <p className="font-headline text-sm sm:text-base font-medium text-muted max-w-xl leading-relaxed mt-3">
            Startline is Australia&apos;s fitness event calendar. We connect
            athletes with the races, competitions, and communities that push them
            further.
          </p>
        </div>
      </section>

      {/* ── Founders ── */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-2xl mb-14">
          <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-3.5">
            Founders
          </p>
          <h2 className="font-headline text-[32px] sm:text-4xl font-black italic leading-none tracking-tighter text-light mb-4">
            Meet the team behind <em className="text-primary not-italic">Startline.</em>
          </h2>
          <p className="text-[15px] text-muted leading-relaxed">
            Three people who share a belief that finding your next challenge
            should be as simple as lacing up.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 sm:gap-6">
          {founders.map((f) => (
            <div
              key={f.name}
              className="bg-dark border border-dark-lighter rounded-xl p-6 sm:p-7 flex flex-col gap-5"
            >
              <div className="w-full aspect-[3/2] rounded-lg bg-dark-light border border-dark-lighter flex items-center justify-center">
                <span className="font-headline text-2xl font-bold text-muted-dark">
                  {f.initials}
                </span>
              </div>
              <div>
                <h3 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-1.5">
                  {f.name}
                </h3>
                <p className="text-[13.5px] text-muted leading-relaxed">
                  {f.bio}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="relative min-h-[400px] sm:min-h-[460px] flex items-center overflow-hidden">
        <Image
          src="/images/about/about-mission.jpg"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-darker via-darker/70 to-transparent" />
        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-16">
          <div className="max-w-xl">
            <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-3.5">
              Mission
            </p>
            <h2 className="font-headline text-[32px] sm:text-4xl font-black italic leading-none tracking-tighter text-light mb-4">
              Your next race is <em className="text-primary not-italic">out there.</em>
            </h2>
            <p className="text-[15px] text-muted leading-relaxed">
              We believe the hardest part of any event is showing up at the
              start line — not finding one to enter. Startline brings every
              fitness event in Australia into one place so you can discover,
              compare, and register in minutes, not hours.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center">
        <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-3.5">
          Get Started
        </p>
        <h2 className="font-headline text-[32px] sm:text-4xl font-black italic leading-none tracking-tighter text-light mb-3">
          Find your <span className="text-primary">start line.</span>
        </h2>
        <p className="text-[15px] text-muted leading-relaxed max-w-md mx-auto mb-8">
          Browse hundreds of events across Australia and register for your next
          challenge today.
        </p>
        <Link
          href="/events"
          className="inline-flex items-center gap-2 font-headline font-bold text-[11.5px] uppercase tracking-[0.13em] text-dark bg-machined shadow-machined px-[26px] py-[13px] rounded-[10px] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-[transform,box-shadow] duration-150"
        >
          Browse Events
        </Link>
      </section>
    </main>
  );
}
