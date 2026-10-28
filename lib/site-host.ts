/**
 * Which host production answers on.
 *
 * Staging and PR previews run the same build as production but on an Amplify
 * branch domain, and local dev is localhost. A host check is therefore what
 * separates production from those deployments; an environment variable would
 * not, because the branch domain shares production's build environment.
 */

/** The host the public site is served on in production. */
export const PRODUCTION_DOMAIN = "startlineau.com";

/** True only on the apex domain and its `www` alias, with or without a port. */
export function isProductionHost(host: string | null | undefined): boolean {
  const h = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  return h === PRODUCTION_DOMAIN || h === `www.${PRODUCTION_DOMAIN}`;
}
