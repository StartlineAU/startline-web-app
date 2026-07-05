import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-dark border-t border-dark-lighter">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-10 mb-8">
          <div className="flex-shrink-0">
            <Link href="/" className="inline-flex items-center mb-3">
              <Image
                src="/images/logo-title.svg"
                alt="StartLine"
                width={130}
                height={34}
                className="h-7 w-auto"
              />
            </Link>
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted leading-relaxed">
              Australia&apos;s Fitness<br />Event Calendar
            </p>
          </div>

          <div className="flex gap-8 sm:gap-12 lg:gap-16 flex-wrap">
            <div>
              <h4 className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-3">
                Events
              </h4>
              <div className="space-y-2">
                {[
                  { href: "/events", label: "All Events" },
                  { href: "/events?type=running", label: "Running" },
                  { href: "/events?type=cycling", label: "Cycling" },
                  { href: "/events?type=swimming", label: "Swimming" },
                  { href: "/events?type=triathlon", label: "Triathlon" },
                  { href: "/events?type=duathlon", label: "Duathlon" },
                  { href: "/events?type=crossfit", label: "CrossFit" },
                  { href: "/events?type=hybrid", label: "Hybrid" },
                  { href: "/events?type=weightlifting", label: "Weightlifting" },
                  { href: "/events?type=bodybuilding", label: "Body Building" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors py-0.5"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-3">
                Platform
              </h4>
              <div className="space-y-2">
                {[
                  { href: "/contact", label: "Contact" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors py-0.5"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-3">
                Follow
              </h4>
              <a
                href="https://www.instagram.com/startlineau/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors"
              >
                Instagram
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-dark-lighter pt-5">
          <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
            &copy; {new Date().getFullYear()} StartLine. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
