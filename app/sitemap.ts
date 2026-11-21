import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { portalsAreSplit } from "@/lib/portal-domains";
import { publicDiscoveryWhere } from "@/lib/event-lifecycle";
import { publicSiteMode } from "@/lib/site-mode";

const SITE = "https://www.startlineau.com";

// Pages the athlete host serves to everyone while the waitlist gate is on: the
// waitlist itself at the root, and the legal pages. Listing anything else would
// point a crawler at URLs that answer with the waitlist page.
const WAITLIST_PATHS = ["/", "/terms", "/privacy", "/cookies"];

// The public athlete site once it is live. Published events are added below.
const LIVE_PATHS = ["/", "/events", "/about", "/contact", "/faq", "/terms", "/privacy", "/cookies"];

// The sitemap robots.txt names (#547). It follows the same split as robots:
// only the production portals are indexed, so every other host gets an empty
// sitemap. On production it lists only what the current site mode serves.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host");
  if (!portalsAreSplit(host)) return [];

  if (publicSiteMode() !== "live") {
    return WAITLIST_PATHS.map((path) => ({ url: `${SITE}${path}` }));
  }

  const pages: MetadataRoute.Sitemap = LIVE_PATHS.map((path) => ({ url: `${SITE}${path}` }));

  try {
    const events = await prisma.event.findMany({
      where: publicDiscoveryWhere(),
      orderBy: { eventDate: "asc" },
      select: { id: true, slug: true, updatedAt: true },
    });
    for (const event of events) {
      pages.push({ url: `${SITE}/events/${event.slug ?? event.id}`, lastModified: event.updatedAt });
    }
  } catch (err) {
    // A database blip should still leave crawlers the static pages.
    console.error("sitemap: could not load events", err);
  }

  return pages;
}
