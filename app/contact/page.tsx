import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Startline team — questions, event submissions or partnership enquiries.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title:       "Contact | Startline",
    description: "Get in touch with the Startline team.",
    url:         "https://www.startlineau.com/contact",
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-dark-darker">
      <header className="relative overflow-hidden border-b border-dark-lighter">
        <div className="absolute inset-0 hero-topo" />
        <div className="absolute inset-0 scan-grid opacity-30" />
        <div className="relative max-w-[1440px] mx-auto px-6 lg:px-8 py-20">
          <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 flex items-center gap-3">
            <span className="w-8 h-px bg-primary" /> Get in touch
          </div>
          <h1 className="font-headline text-5xl lg:text-7xl font-black italic tracking-tighter leading-none">
            Contact<br /><span className="text-primary">us.</span>
          </h1>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-16 max-w-4xl">
          <div>
            <p className="text-[16px] text-muted leading-relaxed mb-8">
              Questions about an event listing, partnership opportunities, or something else? Fill in the form and we&apos;ll get back to you within 1–2 business days.
            </p>

            <form action="/api/contact" method="POST" className="space-y-5">
              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-light block mb-2">Name</label>
                <input name="name" type="text" required placeholder="Your full name"
                  className="w-full bg-dark border border-dark-lighter rounded-lg px-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-light block mb-2">Email</label>
                <input name="email" type="email" required placeholder="you@example.com"
                  className="w-full bg-dark border border-dark-lighter rounded-lg px-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-light block mb-2">Message</label>
                <textarea name="message" required rows={5} placeholder="How can we help?"
                  className="w-full bg-dark border border-dark-lighter rounded-lg px-4 py-3 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors resize-none" />
              </div>
              <button type="submit"
                className="bg-machined shadow-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-4 rounded-lg hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 transition-transform">
                Send message →
              </button>
            </form>
          </div>

          <aside className="space-y-4 lg:pt-4">
            {[
              { label: "List an event",     desc: "Organisers can apply to list events through the Organiser Portal.",  href: "/organiser/register" },
              { label: "Event corrections", desc: "Spotted an error in an event listing? Let us know and we'll fix it.", href: null },
              { label: "Partnerships",      desc: "Sponsorship or media partnership enquiries.",                         href: null },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-dark border border-dark-lighter rounded-xl p-5">
                <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-light mb-1">{label}</div>
                <div className="text-[13px] text-muted">{desc}</div>
              </div>
            ))}
          </aside>
        </div>
      </main>
    </div>
  );
}
