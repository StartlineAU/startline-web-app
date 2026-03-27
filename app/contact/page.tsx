"use client";

import { useState } from "react";
import { MapPin, Mail, Send, ExternalLink, Zap } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-dark-darker">

      {/* ── HERO ── */}
      <section className="bg-dark border-b border-dark-lighter">
        <div className="max-w-[1440px] mx-auto px-6 pt-48 pb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-3xl">
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4">
              Transmission Status: Active
            </p>
            <h1 className="font-headline text-5xl sm:text-6xl lg:text-7xl font-black italic tracking-tighter text-light leading-none">
              Get In Touch.<br />
              <span className="text-primary">The Clock Is Ticking.</span>
            </h1>
          </div>
          <div className="hidden lg:block text-right flex-shrink-0">
            <div className="font-headline text-xs font-medium uppercase tracking-widest text-muted leading-loose">
              Coord: 37.8136° S, 144.9631° E<br />
              System: Kinetic v2.04<br />
              Latency: 14ms
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN GRID ── */}
      <section className="max-w-[1440px] mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0.5 bg-dark-darker">

          {/* ── Contact Form ── */}
          <div className="lg:col-span-7 bg-dark p-8 md:p-12">
            <div className="mb-10">
              <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-3">
                <span className="w-8 h-px bg-primary inline-block" />
                Direct Uplink
              </h2>
            </div>

            {submitted ? (
              <div className="border-l-4 border-primary bg-dark-light px-6 py-8">
                <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-2">
                  Transmission Received
                </p>
                <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-3">
                  Message Sent.
                </p>
                <p className="text-muted text-sm">
                  We&apos;ll get back to you within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Name */}
                  <div className="relative group">
                    <label className="block font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2 group-focus-within:text-primary transition-colors">
                      Identification / Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Your Name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-transparent border-0 border-b border-dark-lighter py-3 px-0 text-light font-headline text-sm placeholder:text-muted/40 focus:ring-0 focus:outline-none focus:border-primary transition-colors uppercase tracking-wide"
                    />
                  </div>

                  {/* Email */}
                  <div className="relative group">
                    <label className="block font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2 group-focus-within:text-primary transition-colors">
                      Protocol / Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="email@domain.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full bg-transparent border-0 border-b border-dark-lighter py-3 px-0 text-light font-headline text-sm placeholder:text-muted/40 focus:ring-0 focus:outline-none focus:border-primary transition-colors uppercase tracking-wide"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="relative group">
                  <label className="block font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2 group-focus-within:text-primary transition-colors">
                    Subject / Objective
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Purpose of contact"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full bg-transparent border-0 border-b border-dark-lighter py-3 px-0 text-light font-headline text-sm placeholder:text-muted/40 focus:ring-0 focus:outline-none focus:border-primary transition-colors uppercase tracking-wide"
                  />
                </div>

                {/* Message */}
                <div className="relative group">
                  <label className="block font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2 group-focus-within:text-primary transition-colors">
                    Payload / Message
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Transmit your data here..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full bg-transparent border-0 border-b border-dark-lighter py-3 px-0 text-light font-headline text-sm placeholder:text-muted/40 focus:ring-0 focus:outline-none focus:border-primary transition-colors resize-none uppercase tracking-wide"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-3 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-10 py-4 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
                  >
                    Transmit Data
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── Right side panels ── */}
          <div className="lg:col-span-5 flex flex-col gap-0.5">

            {/* Physical Hub */}
            <div className="bg-dark p-8 flex-1">
              <div className="flex items-start justify-between mb-6">
                <h3 className="font-headline text-lg font-bold uppercase tracking-tight text-light">
                  Physical Hub
                </h3>
                <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
              </div>
              <p className="font-headline text-lg uppercase tracking-tight text-light mb-1">
                Ground Zero Melbourne
              </p>
              <p className="text-muted text-sm leading-relaxed">
                Collins Street Precinct<br />
                Melbourne, VIC 3000
              </p>

              {/* Office image */}
              <div className="mt-6 relative h-40 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=70"
                  alt="Melbourne office"
                  className="w-full h-full object-cover grayscale hover:grayscale-0 opacity-60 hover:opacity-90 brightness-75 transition-all duration-500 cursor-pointer"
                />
                <div className="absolute inset-0 border border-primary/20 pointer-events-none" />
              </div>
            </div>

            {/* Digital Nodes */}
            <div className="bg-dark p-8">
              <div className="flex items-start justify-between mb-6">
                <h3 className="font-headline text-lg font-bold uppercase tracking-tight text-light">
                  Digital Nodes
                </h3>
                <Mail className="w-5 h-5 text-primary flex-shrink-0" />
              </div>

              {/* Email */}
              <div className="flex items-center justify-between border-b border-dark-lighter pb-4 mb-4 group cursor-pointer">
                <div>
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-0.5">
                    Direct Signal
                  </p>
                  <p className="font-headline text-sm uppercase tracking-wide text-light group-hover:text-primary transition-colors">
                    support@startline.com.au
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
              </div>

              {/* Social links */}
              <div className="grid grid-cols-2 gap-0.5 bg-dark-darker">
                <a
                  href="https://www.instagram.com/startlineau/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-dark p-4 flex items-center justify-between group hover:bg-primary transition-all duration-100"
                >
                  <span className="font-headline text-xs font-medium uppercase tracking-widest text-light group-hover:text-dark">
                    Instagram
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-primary group-hover:text-dark" />
                </a>
                <a
                  href="#"
                  className="bg-dark p-4 flex items-center justify-between group hover:bg-primary transition-all duration-100"
                >
                  <span className="font-headline text-xs font-medium uppercase tracking-widest text-light group-hover:text-dark">
                    Strava
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-primary group-hover:text-dark" />
                </a>
              </div>
            </div>

            {/* FAQ CTA */}
            <Link
              href="/events"
              className="bg-primary p-8 group overflow-hidden relative block"
            >
              <div className="relative z-10 flex justify-between items-center">
                <div>
                  <h3 className="font-headline text-xl font-black italic tracking-tighter text-dark mb-1">
                    STUCK IN THE PITS?
                  </h3>
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-dark/60">
                    Browse Events / Find Your Race
                  </p>
                </div>
                <Zap className="w-8 h-8 text-dark group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
              <div className="absolute top-0 right-0 h-full w-20 bg-dark/5 -skew-x-12 translate-x-10 group-hover:translate-x-6 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATUS BAR ── */}
      <section className="max-w-[1440px] mx-auto px-6 pb-16">
        <div className="border-l-4 border-primary bg-dark p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-8">
            <div>
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-1">
                Global Status
              </p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary inline-block animate-pulse" />
                <span className="font-headline text-xs font-bold uppercase tracking-widest text-light">
                  Operational
                </span>
              </div>
            </div>
            <div className="w-px h-8 bg-dark-lighter" />
            <div>
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-1">
                Version
              </p>
              <span className="font-headline text-xs font-bold uppercase tracking-widest text-light">
                2.04.1-Kinetic
              </span>
            </div>
          </div>
          <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
            End of Transmission // Next Sync in 04:59s
          </p>
        </div>
      </section>
    </main>
  );
}
