/**
 * Cross-site request check for state-changing API calls.
 *
 * Session cookies are SameSite=Lax and scoped to .startlineau.com, so a page on
 * any sibling subdomain (docs, cdn) counts as same-site and its POSTs carry the
 * session. And `req.json()` reads a text/plain body, which needs no CORS
 * preflight. So SameSite alone does not stop another startlineau.com page
 * from changing someone's account. Browsers send Origin on every POST, PUT,
 * PATCH and DELETE, so a request whose Origin is not one of ours is refused.
 *
 * Requests with no Origin (server-to-server: Stripe, the scheduler, curl) carry
 * no browser cookies to abuse and pass. So does a request authenticated with a
 * bearer token (the native app), because nothing ambient is attached to it.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const PORTAL_ORIGINS = [
  "https://startlineau.com",
  "https://www.startlineau.com",
  "https://organiser.startlineau.com",
  "https://admin.startlineau.com",
];

// The native shell's WebView origins (Capacitor on iOS and Android).
const NATIVE_ORIGINS = ["capacitor://localhost", "https://localhost", "http://localhost"];

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function crossSiteWriteBlocked(req: {
  method: string;
  pathname: string;
  host: string;
  origin: string | null;
  authorization: string | null;
  protocol?: string;
}): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return false;
  if (!req.pathname.startsWith("/api/")) return false;
  if (!req.origin) return false;
  if (req.authorization && /^Bearer\s+/i.test(req.authorization)) return false;

  const allowed = new Set<string>([
    ...PORTAL_ORIGINS,
    ...NATIVE_ORIGINS,
    `https://${req.host}`,
    // A plain-http host is only ever local development.
    ...(req.protocol === "http:" ? [`http://${req.host}`] : []),
  ]);
  const site = originOf(process.env.NEXT_PUBLIC_SITE_URL);
  if (site) allowed.add(site);

  return !allowed.has(req.origin);
}
