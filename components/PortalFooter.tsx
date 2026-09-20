import Link from "next/link";
import Image from "next/image";

const linkCls =
  "font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors";

/**
 * The one-row footer. The organiser and admin portals use it as is; the
 * athlete site's app screens pass `organiserLoginHref` to add a way into the
 * organiser portal, which the full footer offers and this one otherwise lacks.
 */
export default function PortalFooter({ organiserLoginHref }: { organiserLoginHref?: string } = {}) {
  return (
    <footer className="bg-dark border-t border-dark-lighter mt-auto">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center">
            <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
          </Link>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {[
              { href: "/about", label: "About" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              { href: "/contact", label: "Contact" },
              // Athlete site only; the portals are already inside one.
              ...(organiserLoginHref ? [{ href: organiserLoginHref, label: "Organiser Login" }] : []),
            ].map((link) => (
              <Link key={link.href} href={link.href} className={linkCls}>
                {link.label}
              </Link>
            ))}
          </div>

          <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
            &copy; {new Date().getFullYear()} Startline. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
