/**
 * Where the Turnstile bot check is enforced. Shared by the server (which
 * refuses a request without a valid token) and the forms (which show the
 * widget), so the two can never disagree.
 *
 * The widget is registered for startlineau.com, which Cloudflare extends to its
 * subdomains, so it works on the apex and on the organiser and admin hosts.
 * Those hosts serve /api/* too, so they are all enforced: a request naming
 * another host must not skip the check.
 *
 * A production deployment is enforced on every host it answers on, including
 * its Amplify default domain, so that domain is not a way around the check
 * either. Staging, previews and local dev run on hosts the widget does not
 * know, where it cannot produce a token, so they stay open.
 */
const PRODUCTION_DOMAIN = "startlineau.com";

function isProductionHostname(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === PRODUCTION_DOMAIN || host.endsWith(`.${PRODUCTION_DOMAIN}`);
}

function hostnameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function botCheckAppliesTo(
  hostname: string | null | undefined,
  siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
): boolean {
  return isProductionHostname(hostname) || isProductionHostname(hostnameOf(siteUrl));
}
