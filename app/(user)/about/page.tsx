import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// Placeholder until the real founders photo is supplied. Swap the file here.
const TEAM_IMAGE = "/images/about/team-placeholder.jpg";

const DESCRIPTION =
  "Startline is Australia's running event calendar, built by Lachlan Martin, Nathan Sweet, Hugo Shrowder and Noah Helu.";

export const metadata: Metadata = {
  title: "About Us",
  description: DESCRIPTION,
  openGraph: {
    title: "About Us | Startline",
    description: DESCRIPTION,
    url: "/about",
    images: [{ url: TEAM_IMAGE, width: 1200, height: 630, alt: "The Startline team" }],
  },
  twitter: {
    title: "About Us | Startline",
    description: DESCRIPTION,
    images: [TEAM_IMAGE],
  },
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <p className="font-headline text-[10px] sm:text-xs font-black uppercase tracking-widest text-primary mb-3">
          About
        </p>
        <h1 className="font-headline text-[40px] sm:text-6xl font-black italic leading-none tracking-tighter text-light mb-8">
          Built for the <span className="text-primary">start line.</span>
        </h1>

        <div className="space-y-4 text-[15px] sm:text-base text-muted leading-relaxed">
          <p>
            Startline is Australia&apos;s running event calendar. Races, fun runs
            and run clubs, all in one place, so you can find your next start line
            and register in minutes.
          </p>
          <p>
            We believe the hardest part of any event should be showing up on the
            day, not finding one to enter. Follow along on{" "}
            <a
              href="https://www.instagram.com/startlineau/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Instagram
            </a>
            .
          </p>
        </div>

        <div className="relative w-full aspect-[16/9] mt-12 rounded-xl overflow-hidden border border-dark-lighter bg-dark">
          <Image
            src={TEAM_IMAGE}
            alt="The Startline founders"
            fill
            className="object-cover"
            sizes="(min-width: 768px) 768px, 100vw"
            priority
          />
        </div>
        <p className="text-[13.5px] text-muted leading-relaxed mt-4">
          Startline was founded by Lachlan Martin, Nathan Sweet, Hugo Shrowder
          and Noah Helu.
        </p>

        <Link
          href="/contact"
          className="mt-10 inline-flex items-center gap-2 font-headline font-bold text-[11.5px] uppercase tracking-[0.13em] text-dark bg-machined shadow-machined px-[26px] py-[13px] rounded-[10px] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-[transform,box-shadow] duration-150"
        >
          Contact
        </Link>
      </section>
    </main>
  );
}
