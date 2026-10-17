import Image from "next/image";
import Link from "next/link";
import { LegalFooter } from "../LegalFooter";

/**
 * The legal pages as production shows them while it is in waitlist mode:
 * middleware rewrites /terms, /privacy and /cookies on the apex domain to
 * here, so they carry only the logo (back to the waitlist) and the legal
 * footer. The full site header would offer navigation and a sign-up that
 * all lead back to the waitlist.
 */
export default function WaitlistLegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-dark-darker pb-16">
      <header className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-8">
        <Link href="/" aria-label="Startline home" className="inline-block">
          <Image src="/images/logo-title.png" alt="Startline" width={120} height={26} priority className="h-[26px] w-auto" />
        </Link>
      </header>
      {children}
      <LegalFooter />
    </div>
  );
}
