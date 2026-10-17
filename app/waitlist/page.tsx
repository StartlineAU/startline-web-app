import Image from "next/image";
import { WaitlistForm } from "./WaitlistForm";
import { LegalFooter } from "./LegalFooter";

export default function WaitlistPage() {
  return (
    <div className="waitlist-stage">
      <div className="waitlist-panel">
        <div className="waitlist-logo">
          <Image
            src="/images/logo-title.png"
            alt="Startline"
            width={120}
            height={26}
            priority
            className="h-[26px] w-auto"
          />
        </div>

        <div className="text-center">
          <div className="font-headline font-bold text-[10.5px] uppercase tracking-[.28em] text-primary mb-4">
            Launching Soon
          </div>

          <h1 className="font-headline font-bold italic tracking-[-.03em] leading-[.98] text-[clamp(34px,6vw,50px)] text-light">
            Cross the start line
            <br />
            <span className="text-primary">before everyone else.</span>
          </h1>

          <p className="text-[15.5px] leading-relaxed text-muted max-w-[420px] mx-auto mt-5">
            Startline is almost ready. Leave your email and we&apos;ll notify you
            the moment the platform goes live. No spam, just the launch.
          </p>

          <WaitlistForm />
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
