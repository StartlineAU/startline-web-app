import type { MetadataRoute } from "next";
import { fetchAllEvents } from "@/lib/supabase";

const BASE = "https://www.startlineau.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,        lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/events`,  lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/about`,   lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Dynamic event detail pages
  let eventRoutes: MetadataRoute.Sitemap = [];
  try {
    const events = await fetchAllEvents();
    eventRoutes = events.map((e) => ({
      url:             `${BASE}/events/${e.id}`,
      lastModified:    now,
      changeFrequency: "weekly" as const,
      priority:        0.8,
    }));
  } catch {
    // Fallback gracefully — static pages are still included
  }

  return [...staticRoutes, ...eventRoutes];
}
