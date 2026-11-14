import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.startlineau.com";
const INSTAGRAM_URL = "https://www.instagram.com/startlineau/";

const TITLE = "About Startline | Running & Fitness Events in Australia";
// Link previews use the site-wide card. A page-level openGraph replaces the
// layout's, so the image has to be named here too.
const SHARE_IMAGE = "/site-preview.png";

const DESCRIPTION =
  "Startline is the Melbourne-born home for running, fitness and sports events in Australia. Find fun runs, marathons and trail races, then enter in minutes.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "running events Australia",
    "fitness events Melbourne",
    "fun runs",
    "sports events Victoria",
    "marathons",
    "half marathons",
    "5K",
    "10K",
    "trail runs",
    "charity runs",
    "event registration",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: "/about" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/about",
    images: [{ url: SHARE_IMAGE, width: 1200, height: 630, alt: "Startline" }],
  },
  twitter: {
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
};

const EVENT_TYPES = [
  "Fun runs",
  "5K and 10K races",
  "Half marathons",
  "Marathons",
  "Trail runs",
  "Charity runs",
  "Run clubs",
  "Triathlons and obstacle course races",
];

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Startline",
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo.png`,
  description: DESCRIPTION,
  sameAs: [INSTAGRAM_URL],
};

// Escape "<" so no string in the data can close the script element early.
const jsonLd = (data: object) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

const eyebrow = "font-headline text-[10px] sm:text-xs font-black uppercase tracking-widest text-primary mb-3";
const h2 = "font-headline text-[28px] sm:text-4xl font-black italic leading-none tracking-tighter text-light mb-5";
const prose = "space-y-4 text-[15px] sm:text-base text-muted leading-relaxed";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-dark-darker">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationSchema)} />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <header>
          <p className={eyebrow}>About</p>
          <h1 className="font-headline text-[36px] sm:text-5xl lg:text-6xl font-black italic leading-[0.95] tracking-tighter text-light mb-8">
            About Startline: Your <span className="text-primary">Start Line</span> for Every Race in Australia
          </h1>
          <p className="text-base sm:text-lg text-light/90 leading-relaxed">
            Startline is the Melbourne-born home for running events across
            Australia. Find fun runs, marathons, trail races and fitness events
            near you, then enter in minutes.
          </p>
        </header>

        <section className="mt-16" aria-labelledby="our-story">
          <p className={eyebrow}>Our story</p>
          <h2 id="our-story" className={h2}>
            Part of something <span className="text-primary">bigger.</span>
          </h2>
          <div className={prose}>
            <p>
              At Startline, we believe the best part of fitness is being part of
              something bigger. Built by a team of four from different
              backgrounds, we&apos;re united by a shared passion for fitness,
              competition and community.
            </p>
            <p>
              Having experienced the fitness industry firsthand, we recognised an
              opportunity to make events more accessible, connected and easier to
              manage. Too often, great events go unnoticed, and organisers are
              left navigating complicated processes to bring their ideas to life.
            </p>
            <p>
              That&apos;s why we built Startline: a platform that brings athletes,
              organisers and events together in one place. From discovering your
              next challenge and tracking your progress to creating, managing and
              promoting events, we&apos;re making it easier for everyone to get
              involved.
            </p>
            <p>
              We&apos;re passionate about the industry we&apos;re building in, the
              people who make it what it is, and the opportunities that come from
              bringing everyone together.
            </p>
          </div>
          <p className="text-[13.5px] text-muted leading-relaxed mt-6">
            Startline was founded in Melbourne by Lachlan Martin, Nathan Sweet,
            Hugo Shrowder and Noah Helu.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="events">
          <p className={eyebrow}>Events</p>
          <h2 id="events" className={h2}>
            Running and fitness events <span className="text-primary">near you.</span>
          </h2>
          <p className="text-[15px] sm:text-base text-muted leading-relaxed mb-6">
            From your first 5K to your next marathon, Startline brings sports
            events from Victoria and every other state into one calendar, with
            event registration built in.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EVENT_TYPES.map((t) => (
              <li
                key={t}
                className="font-headline text-xs font-bold uppercase tracking-[0.15em] text-light bg-dark border border-dark-lighter rounded-lg px-4 py-3"
              >
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 text-center" aria-label="Get started">
          <p className="font-headline text-xl sm:text-2xl font-black italic tracking-tighter text-light leading-snug">
            Find your community. Discover your next challenge.{" "}
            <span className="text-primary">Find your Startline.</span>
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 font-headline font-bold text-[11.5px] uppercase tracking-[0.13em] text-dark bg-machined shadow-machined px-[26px] py-[13px] rounded-[10px] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-[transform,box-shadow] duration-150"
            >
              Browse events
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center font-headline font-bold text-[11.5px] uppercase tracking-[0.13em] text-light border border-dark-lighter hover:border-primary/50 px-[26px] py-[13px] rounded-[10px] transition-colors"
            >
              Contact
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
