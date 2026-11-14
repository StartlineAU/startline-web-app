import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { portalsAreSplit } from "@/lib/portal-domains";

const SITE = "https://www.startlineau.com";

// The production portals are the only deployment that should be indexed. A
// branch deployment and every PR preview serve the whole app from a host that
// is none of them, against the staging database, so the crawler is told to stay
// out. Middleware sets the same decision as an `X-Robots-Tag` header, which is
// what actually keeps a page out of the index; this route is the readable
// robots.txt half of it, and it replaces the static `public/robots.txt` because
// that file cannot vary by host.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");

  if (portalsAreSplit(host)) {
    return {
      rules: {
        userAgent: "*",
        allow: ["/", "/events", "/events/", "/about", "/contact"],
        disallow: [
          // Portals and APIs are not for indexing.
          "/organiser",
          "/organiser/",
          "/admin",
          "/admin/",
          "/api/",
          "/_next/",
        ],
      },
      sitemap: `${SITE}/sitemap.xml`,
    };
  }

  return { rules: { userAgent: "*", disallow: "/" } };
}
