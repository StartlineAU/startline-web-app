"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import PortalFooter from "@/components/PortalFooter";
import { organiserHref } from "@/lib/portal-domains";
import { usePortalHost } from "@/lib/use-portal-host";

/**
 * Pages that get the one-row footer the organiser and admin portals use.
 *
 * These are app screens rather than marketing pages. On a phone the full
 * five-column footer took over most of the viewport under the events list, so
 * you could not see a whole event card on screen at once (#338). Event detail
 * pages (/events/[id]) keep the full footer, so the listing matches exactly.
 */
function usesCompactFooter(pathname: string): boolean {
  return (
    pathname === "/events" ||
    pathname === "/activity" ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/")
  );
}

export default function SiteFooter() {
  const pathname = usePathname() ?? "";
  // The organiser portal has its own hostname in production, so a bare
  // "/organiser" would land on the athlete site's waitlist there.
  const organiserLogin = organiserHref("/organiser", usePortalHost());
  return usesCompactFooter(pathname)
    ? <PortalFooter organiserLoginHref={organiserLogin} />
    : <Footer />;
}
