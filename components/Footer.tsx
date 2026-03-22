import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#000000] border-t border-dark-lighter">
      <div className="max-w-[1440px] mx-auto px-6 py-10">
        {/* Top row: brand + links */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-10 mb-10">
          {/* Brand */}
          <div className="flex-shrink-0 w-48">
            <Link href="/" className="inline-flex items-center mb-4">
              <Image
                src="/images/logo-title.svg"
                alt="StartLine"
                width={160}
                height={40}
                className="h-8 w-auto"
              />
            </Link>
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted leading-relaxed">
              Australia&apos;s Competitive<br />Fitness Calendar
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-10 sm:gap-16">
            {/* Events */}
            <div>
              <h4 className="font-headline text-[10px] uppercase tracking-widest text-muted mb-4">
                Events
              </h4>
              <div className="space-y-2">
                {[
                  { href: "/events", label: "All Events" },
                  { href: "/events?type=hyrox", label: "HYROX" },
                  { href: "/events?type=crossfit", label: "CrossFit" },
                  { href: "/events?type=running", label: "Running" },
                  { href: "/events?type=hybrid", label: "Hybrid" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <h4 className="font-headline text-[10px] uppercase tracking-widest text-muted mb-4">
                Platform
              </h4>
              <div className="space-y-2">
                {[
                  { href: "/submit", label: "Submit Event" },
                  { href: "/about", label: "About" },
                  { href: "/contact", label: "Contact" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-headline text-[10px] uppercase tracking-widest text-muted mb-4">
                Follow
              </h4>
              <a
                href="https://www.instagram.com/startlineau/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors"
              >
                Instagram
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-dark-lighter pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-headline text-[10px] uppercase tracking-widest text-muted">
            © {new Date().getFullYear()} StartLine. All Rights Reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block animate-pulse-dot" />
            <span className="font-headline text-[10px] uppercase tracking-widest text-muted">
              System Active
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

