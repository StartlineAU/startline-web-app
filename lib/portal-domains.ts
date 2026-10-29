// The three portals share one Next app but not always one hostname.
//
// Production splits them across startlineau.com, organiser.startlineau.com and
// admin.startlineau.com. Every other deployment — the Amplify branch domain, PR
// previews, local dev — serves all three from a single host. A cross-portal
// link that is absolute everywhere points at a hostname that doesn't resolve on
// those single-host deployments, which is how "Get started" led to a browser
// error page (issue #302). A link that is relative everywhere lands on the
// wrong portal in production. So the shape of the link has to follow the host.

export const USER_DOMAIN = "startlineau.com";
export const ORGANISER_DOMAIN = `organiser.${USER_DOMAIN}`;
export const ADMIN_DOMAIN = `admin.${USER_DOMAIN}`;

/** Lower-cased and without the port, which `Host` carries in local dev. */
export function normaliseHost(host: string | null | undefined): string {
  return (host ?? "").toLowerCase().replace(/:\d+$/, "");
}

/** True only on the deployment that gives each portal its own hostname. */
export function portalsAreSplit(host: string | null | undefined): boolean {
  const h = normaliseHost(host);
  return (
    h === USER_DOMAIN ||
    h === `www.${USER_DOMAIN}` ||
    h === ORGANISER_DOMAIN ||
    h === ADMIN_DOMAIN
  );
}

/** A link to `path` on the athlete site, from a page served on `host`. */
export function customerHref(path: string, host: string | null | undefined): string {
  return portalsAreSplit(host) ? `https://${USER_DOMAIN}${path}` : path;
}

/** A link to `path` on the organiser portal, from a page served on `host`. */
export function organiserHref(path: string, host: string | null | undefined): string {
  return portalsAreSplit(host) ? `https://${ORGANISER_DOMAIN}${path}` : path;
}

/** A link to `path` on the admin portal, from a page served on `host`. */
export function adminHref(path: string, host: string | null | undefined): string {
  return portalsAreSplit(host) ? `https://${ADMIN_DOMAIN}${path}` : path;
}

// Emails and Stripe redirects need an absolute URL and have no request host to
// go on, only NEXT_PUBLIC_SITE_URL. In production that is the athlete site, and
// the athlete host rewrites every /organiser and /admin path to the waitlist, so
// `${SITE}/organiser/...` is a dead end there. These resolve the portal from
// the site URL instead: the portal's own hostname in production, the site
// itself on single-host deployments.
function portalUrl(
  toHref: (path: string, host: string) => string,
  path: string,
  siteUrl: string,
): string {
  const origin = siteUrl.replace(/\/+$/, "");
  let host = "";
  try {
    host = new URL(origin).host;
  } catch {
    // Not a URL; fall through to prefixing it as-is.
  }
  const href = toHref(path, host);
  return href.startsWith("/") ? `${origin}${href}` : href;
}

/** An absolute URL for `path` on the organiser portal, given NEXT_PUBLIC_SITE_URL. */
export function organiserUrl(path: string, siteUrl: string): string {
  return portalUrl(organiserHref, path, siteUrl);
}

/** An absolute URL for `path` on the admin portal, given NEXT_PUBLIC_SITE_URL. */
export function adminUrl(path: string, siteUrl: string): string {
  return portalUrl(adminHref, path, siteUrl);
}

// Cognito cookies are written by Amplify in the browser, and a host-only cookie
// set on startlineau.com is never sent to organiser.startlineau.com — which left
// the organiser portal permanently signed out in production. Scoping them to the
// registrable domain lets one sign-in cover all three portals. Returns undefined
// where a shared cookie makes no sense (single-host deployments, localhost),
// because naming a domain the browser isn't on drops the cookie entirely.
export function authCookieDomain(host: string | null | undefined): string | undefined {
  const h = normaliseHost(host);
  return h === USER_DOMAIN || h.endsWith(`.${USER_DOMAIN}`) ? `.${USER_DOMAIN}` : undefined;
}
