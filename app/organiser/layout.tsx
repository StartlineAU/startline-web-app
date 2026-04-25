import type { Metadata } from "next";
import OrganiserMobileNav from "@/components/organiser/MobileNav";

// ── Portal-wide SEO directives ────────────────────────────────────────────────
// Every /organiser/** route inherits noindex so the login-protected portal
// is never crawled or indexed by any search engine.
export const metadata: Metadata = {
  robots: {
    index:     false,
    follow:    false,
    googleBot: { index: false, follow: false },
  },
  title: {
    template: "%s | Startline Organiser",
    default:  "Organiser Portal | Startline",
  },
};

export default function OrganiserLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <OrganiserMobileNav />
    </>
  );
}
