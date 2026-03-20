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
      <p className="absolute bottom-6 text-xs text-muted">
        © {new Date().getFullYear()} StartLine
      </p>
    </main>
  );
}
