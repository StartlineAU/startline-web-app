import { NextRequest } from "next/server";

/**
 * Best-effort client IP for rate limiting and Turnstile.
 *
 * X-Forwarded-For is a chain, and each proxy appends the peer it saw. The
 * right-most hop is therefore the one added by the nearest proxy; the left-most
 * values are whatever the caller sent and can be spoofed. CloudFront — the
 * proxy Amplify runs behind — appends the viewer address, so this is also the
 * only hop that remains trustworthy when the Amplify origin is called directly.
 *
 * Cloudflare sets CF-Connecting-IP, but a direct request to the origin can set
 * that header too. Trust it only when TRUST_CF_CONNECTING_IP is explicitly on,
 * which is safe only once the origin cannot be reached except through
 * Cloudflare.
 */
export function getClientIp(req: NextRequest): string {
  if (process.env.TRUST_CF_CONNECTING_IP === "true") {
    const cloudflareIp = req.headers.get("cf-connecting-ip")?.trim();
    if (cloudflareIp) return cloudflareIp;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    const nearest = hops[hops.length - 1];
    if (nearest) return nearest;
  }

  return "unknown";
}
