"use client";

import { useState } from "react";
import { MapPin, Mail, Send, ExternalLink, Search, Instagram } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not send your message right now.");
      }

      setSubmitted(true);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not send your message right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-dark-darker">

      <section className="relative bg-dark overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/images/Contact-us-page.jpg')",
            opacity: 0.225,
            backgroundPosition: "calc(50% - 5cm) calc(50% - 0.25cm)",
            backgroundSize: "180% auto",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-dark-darker/30 to-dark-darker" />
        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-8 sm:pb-14">
          <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3 flex items-center gap-3">
            <span className="w-8 h-px bg-primary inline-block" />
            Get In Touch
          </p>
          <h1 className="font-headline text-[36px] sm:text-5xl lg:text-7xl font-black italic tracking-tighter text-light leading-tight">
            We&apos;d love to<br />
            <span className="text-primary">hear from you.</span>
          </h1>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <div className="lg:col-span-7 bg-dark rounded-xl p-8 md:p-12">
            <div className="mb-10">
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary flex items-center gap-3 mb-2">
                <span className="w-8 h-px bg-primary inline-block" />
                Send a Message
              </p>
            </div>

            {submitted ? (
              <div className="border-l-4 border-primary bg-dark-light px-6 py-8 rounded-xl">
                <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-2">
                  Message Received
                </p>
                <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-3">
                  Thanks for reaching out.
                </p>
                <p className="text-muted text-sm">
                  We&apos;ll get back to you within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="relative group">
                    <label className="block font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2 group-focus-within:text-primary transition-colors">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Your name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-transparent border-0 border-b border-dark-lighter py-3 px-0 text-light font-headline text-sm placeholder:text-muted/40 focus:ring-0 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div className="relative group">
                    <label className="block font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2 group-focus-within:text-primary transition-colors">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="email@domain.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full bg-transparent border-0 border-b border-dark-lighter py-3 px-0 text-light font-headline text-sm placeholder:text-muted/40 focus:ring-0 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="relative group">
                  <label className="block font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2 group-focus-within:text-primary transition-colors">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="What can we help with?"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full bg-transparent border-0 border-b border-dark-lighter py-3 px-0 text-light font-headline text-sm placeholder:text-muted/40 focus:ring-0 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="relative group">
                  <label className="block font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2 group-focus-within:text-primary transition-colors">
                    Message
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Tell us more..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full bg-transparent border-0 border-b border-dark-lighter py-3 px-0 text-light font-headline text-sm placeholder:text-muted/40 focus:ring-0 focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-3 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-10 py-4 rounded-xl machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                    <Send className="w-4 h-4" />
                  </button>
                  {submitError && (
                    <p className="mt-4 text-sm text-red-400 font-headline">{submitError}</p>
                  )}
                </div>
              </form>
            )}
          </div>

          <div className="lg:col-span-5 lg:justify-self-start flex flex-col gap-6 w-full lg:w-auto">

            <div className="bg-dark rounded-xl p-8 w-full lg:w-[26rem]">
              <div className="flex items-start justify-between mb-6">
                <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
                  Our Location
                </h3>
                <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
              </div>
              <div>
                <p className="font-headline text-lg font-black italic tracking-tighter text-light mb-4">
                  Melbourne, Australia
                </p>
                <div
                  className="relative overflow-hidden rounded-xl"
                  style={{ marginTop: "0.375cm", height: "calc(14rem + 1.5cm)" }}
                >
                  <img
                    src="/images/Location-photo.jpg"
                    alt="Melbourne aerial view"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: "center calc(50% - 1cm)" }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-dark rounded-xl p-8 w-full lg:w-[26rem]">
              <div className="flex items-start justify-between mb-6">
                <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
                  Contact Details
                </h3>
                <Mail className="w-5 h-5 text-primary flex-shrink-0" />
              </div>

              <div className="flex items-center justify-between border-b border-dark-lighter pb-4 mb-4 group cursor-pointer">
                <div>
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-0.5">
                    Email
                  </p>
                  <p className="font-headline text-sm text-light group-hover:text-primary transition-colors">
                    admin@startlineau.com
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
              </div>

              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-3">
                Follow Us
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://www.instagram.com/startlineau/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="StartLine Instagram"
                  className="border border-dark-lighter p-2 rounded-xl inline-flex items-center justify-center self-start group hover:border-primary/50 hover:text-light transition-colors"
                >
                  <Instagram className="w-5 h-5 text-muted group-hover:text-primary transition-colors" />
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section className="bg-dark border-t border-dark-lighter">
        <div className="max-w-[1440px] mx-auto px-6 py-16 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
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
              href="/contact"
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
