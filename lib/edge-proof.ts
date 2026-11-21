/**
 * Proof that a request came through Cloudflare.
 *
 * Production sits behind Cloudflare, then CloudFront, then the Amplify Lambda.
 * CloudFront appends the address of the peer it saw to X-Forwarded-For, and
 * that peer is a Cloudflare edge, not the athlete. Keying rate limits on it put
 * a whole city behind one counter. Cloudflare's CF-Connecting-IP carries the
 * real address, but only requests that came through Cloudflare should be
 * read that way.
 *
 * So Cloudflare also sends a secret: a Transform Rule adds
 * `x-startline-edge: <EDGE_SHARED_SECRET>` to every request it forwards. A
 * request carrying the right value came through Cloudflare, and its
 * CF-Connecting-IP can be believed. Without EDGE_SHARED_SECRET (local dev, the
 * Docker image, Amplify branch domains with no Cloudflare in front) nothing
 * here is trusted and nothing is refused.
 *
 * Pure JS, no node:crypto: middleware runs on the edge runtime.
 */

export const EDGE_PROOF_HEADER = "x-startline-edge";

/** Compare without returning early on the first differing character. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function edgeSecret(): string | null {
  const secret = process.env.EDGE_SHARED_SECRET?.trim();
  return secret ? secret : null;
}

/** True when the request carries the Cloudflare edge secret. */
export function hasEdgeProof(headers: Headers): boolean {
  const secret = edgeSecret();
  if (!secret) return false;
  const sent = headers.get(EDGE_PROOF_HEADER);
  return sent != null && constantTimeEqual(sent, secret);
}

/**
 * Paths a machine calls on the origin directly, each with its own credential.
 * The lifecycle scheduler authenticates with a shared secret of its own and
 * may be pointed at the Amplify domain.
 */
const DIRECT_ORIGIN_PATHS = ["/api/internal/"];

/**
 * True when the edge secret is configured and the request did not come
 * through Cloudflare. Middleware refuses these, so the app is served only
 * through Cloudflare once the secret is configured.
 */
export function edgeProofMissing(pathname: string, headers: Headers): boolean {
  if (!edgeSecret()) return false;
  if (DIRECT_ORIGIN_PATHS.some((prefix) => pathname.startsWith(prefix))) return false;
  return !hasEdgeProof(headers);
}
