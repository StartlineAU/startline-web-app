/**
 * The mobile app's public identifiers (StartlineAU/startline-mobile-app), for
 * the files iOS and Android fetch to decide whether startlineau.com links open
 * the app. None of these are secret.
 *
 * Until a value is filled in, its file answers 404 rather than publishing a
 * placeholder an OS would cache.
 */

export const MOBILE_APP_ID = "com.startlineau.app";

/**
 * Apple Developer Team ID, from developer.apple.com → Membership. Ten
 * characters, e.g. "A1B2C3D4E5". Empty until the Apple account exists.
 */
export const APPLE_TEAM_ID = "";

/**
 * SHA-256 fingerprints of the certificates that sign the Android app, as
 * "AB:CD:…". Use Play App Signing's app signing key (Play Console → Setup →
 * App signing), plus the upload key if internal builds are side-loaded.
 */
export const ANDROID_CERT_SHA256: string[] = [];

/** Paths that open the app rather than the browser. */
export const APP_LINK_PATHS = ["/events/*", "/activity", "/activity/*", "/checkin/*", "/organiser", "/organiser/*"];

export function appleAppSiteAssociation(teamId: string = APPLE_TEAM_ID) {
  if (!teamId) return null;
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${MOBILE_APP_ID}`],
          components: APP_LINK_PATHS.map((path) => ({ "/": path })),
        },
      ],
    },
  };
}

export function androidAssetLinks(fingerprints: string[] = ANDROID_CERT_SHA256) {
  if (fingerprints.length === 0) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: MOBILE_APP_ID,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
