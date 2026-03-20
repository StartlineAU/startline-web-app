import Image from "next/image";
import WaitlistForm from "@/components/WaitlistForm";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(179,225,83,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto gap-8">
        {/* Logo */}
        <Image
          src="/images/logo-title.svg"
          alt="StartLine"
          width={220}
          height={60}
          priority
          className="h-14 w-auto"
        />

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight font-title">
            Where is your next{" "}
            <span className="text-primary">Start Line?</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted max-w-lg mx-auto leading-relaxed">
            Discover HYROX, CrossFit, running and hybrid fitness events across Australia — all in one place. Launching soon.
          </p>
        </div>

        {/* Waitlist form */}
        <div className="w-full space-y-3">
          <WaitlistForm />
          <p className="text-sm text-muted">
            Be first to know when we launch. No spam, ever.
          </p>
        </div>

        {/* Event type tags */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {["HYROX", "CrossFit", "Running", "Hybrid"].map((type) => (
            <span
              key={type}
              className="px-3 py-1 rounded-full text-sm font-medium bg-dark-light border border-dark-lighter text-muted"
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 flex items-center gap-4 text-xs text-muted">
        <p>© {new Date().getFullYear()} StartLine</p>
        <a
          href="https://www.instagram.com/startlineau/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
          aria-label="Instagram"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
          </svg>
        </a>
      </div>
    </main>
  );
}
