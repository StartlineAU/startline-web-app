import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description:
    "Startline is Australia's dedicated fitness event calendar — helping performance-driven athletes discover HYROX, CrossFit, running and hybrid competitions across the country.",
  alternates: { canonical: "/about" },
  openGraph: {
    title:       "About Startline | Australia's Fitness Event Calendar",
    description: "Startline is Australia's dedicated fitness event calendar — helping athletes discover competitions across the country.",
    url:         "https://www.startlineau.com/about",
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-dark-darker">
      <header className="relative overflow-hidden border-b border-dark-lighter">
        <div className="absolute inset-0 hero-topo" />
        <div className="absolute inset-0 scan-grid opacity-30" />
        <div className="relative max-w-[1440px] mx-auto px-6 lg:px-8 py-20">
          <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 flex items-center gap-3">
            <span className="w-8 h-px bg-primary" /> Who we are
          </div>
          <h1 className="font-headline text-5xl lg:text-7xl font-black italic tracking-tighter leading-none mb-4">
            Built for<br /><span className="text-primary">competitors.</span>
          </h1>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-[2fr_1fr] gap-16 max-w-5xl">
          <div className="space-y-8">
            <section>
              <h2 className="font-headline text-2xl font-black italic tracking-tighter text-light mb-4">Our mission</h2>
              <p className="text-[16px] text-muted leading-relaxed">
                Startline helps performance-driven fitness individuals discover competitive events across Australia. We aggregate HYROX, CrossFit competitions, running races, and hybrid fitness events in one place — so you spend less time searching and more time training.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-2xl font-black italic tracking-tighter text-light mb-4">What we cover</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { type: "HYROX", desc: "The World Series of Fitness Racing" },
                  { type: "CrossFit", desc: "Competitions and throwdowns" },
                  { type: "Running", desc: "5K to marathon distance races" },
                  { type: "Hybrid", desc: "Functional fitness and obstacle course events" },
                ].map(({ type, desc }) => (
                  <div key={type} className="bg-dark border border-dark-lighter rounded-xl p-5">
                    <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary mb-2">{type}</div>
                    <div className="text-[14px] text-muted">{desc}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-headline text-2xl font-black italic tracking-tighter text-light mb-4">Coverage</h2>
              <p className="text-[16px] text-muted leading-relaxed">
                Events across all Australian states and territories: NSW, VIC, QLD, WA, SA, TAS, ACT and NT. All events link directly to official registration pages.
              </p>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="bg-dark border border-dark-lighter rounded-xl p-6">
              <div className="font-headline text-5xl font-black italic tracking-tighter text-primary mb-1">8/8</div>
              <div className="font-headline text-[11px] uppercase tracking-widest text-muted">States covered</div>
            </div>
            <div className="bg-dark border border-dark-lighter rounded-xl p-6">
              <div className="font-headline text-5xl font-black italic tracking-tighter text-primary mb-1">4</div>
              <div className="font-headline text-[11px] uppercase tracking-widest text-muted">Disciplines tracked</div>
            </div>
            <Link href="/events"
              className="flex items-center justify-between bg-machined shadow-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-5 py-4 rounded-xl hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 transition-transform">
              Browse events <ArrowRight className="w-4 h-4" />
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
