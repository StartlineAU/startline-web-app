import Link from "next/link";
import { LEGAL_ENTITY_ABN, LEGAL_ENTITY_NAME } from "@/lib/legal";

const LINKS = [
  { href: "/terms",   label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
];

/**
 * The waitlist is the only page production serves, so it carries the legal
 * links itself. Sits in the stage's bottom padding, clear of the panel.
 */
export function LegalFooter() {
  return (
    <footer className="absolute inset-x-0 bottom-0 z-[1] px-4 pb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-headline text-[10px] uppercase tracking-widest text-muted-dark">
      <span>
        {LEGAL_ENTITY_NAME} · ABN {LEGAL_ENTITY_ABN}
      </span>
      <nav aria-label="Legal" className="flex gap-4">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-primary transition-colors">
            {l.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
