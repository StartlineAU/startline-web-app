import { NextRequest } from "next/server";
import { hasEdgeProof } from "@/lib/edge-proof";

/**
 * Best-effort client IP for rate limiting and Turnstile.
 *
 * When the request carries the Cloudflare edge secret (lib/edge-proof.ts), it
 * came through Cloudflare and CF-Connecting-IP is the athlete's address. That
 * is the only case the header is used.
 *
 * Otherwise X-Forwarded-For is used. It is a chain, and each proxy appends the
 * peer it saw, so the right-most hop is the one added by the nearest proxy;
 * the left-most values come from the caller. Behind
 * Cloudflare that hop is a Cloudflare edge, shared by everyone in a region,
 * which is why production needs the edge secret.
 */
export function getClientIp(req: NextRequest): string {
  if (hasEdgeProof(req.headers)) {
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
