// What production shows the public.
//
// `waitlist` keeps every production host on the waitlist page: the apex, the
// organiser portal and the admin portal. Staff signed in to the `admins`
// Cognito group still get the real site, which is how a production deployment
// is reviewed before launch, and the admin login page stays reachable so they
// can sign in. `live` drops the gate for everyone.
//
// Anything unrecognised falls back to `waitlist`: a missing or misspelt value on
// the production app secret must not open the site by accident. Local dev never
// reaches the gate, because middleware skips host routing when NODE_ENV is
// development.
//
// The value is server-only on purpose. It is not NEXT_PUBLIC_*: only middleware
// reads it, and a public variable would be baked into the client bundle instead
// of the runtime environment.
//
// It is read as a literal `process.env.PUBLIC_SITE_MODE`, never as
// `process.env[name]`, and `next.config.ts` lists it under `env` so Next inlines
// the value at build time. Middleware runs on the Edge runtime, where an
// arbitrary `process.env` read is not guaranteed to see the server's
// environment; the build left an unlisted variable as a runtime lookup. The
// Amplify preBuild writes `.env.production` from the app secret before
// `next build`, which is what makes the deploy's value the one that is inlined.

export type SiteMode = "waitlist" | "live";

/** Which gate the production hosts run. Unset or unrecognised means the waitlist. */
export function publicSiteMode(): SiteMode {
  return process.env.PUBLIC_SITE_MODE?.trim().toLowerCase() === "live" ? "live" : "waitlist";
}

// Paths the apex host keeps serving while the waitlist gate is on.
//
// Everything here either keeps the gate itself working (the waitlist page and
// its API), serves an external caller that cannot be given a staff session, or
// is an asset the page needs. Adding to this list widens what the public can
// reach without signing in, so each entry needs a reason.
const PUBLIC_WHILE_WAITLISTED = new Set([
  "/waitlist",
  // Stripe posts to the apex domain, and a waitlist rewrite would answer with
  // HTML: a 200 Stripe reads as delivered while no payment is ever confirmed
  // and no onboarding ever completes. Safe to expose — both handlers verify the
  // Stripe signature before anything. account-events is the Accounts v2 event
  // destination (#379).
  "/api/stripe/webhook",
  "/api/stripe/account-events",
  // The scheduled lifecycle worker calls the apex host. Without this the
  // rewrite answers 200 with HTML and nothing ever transitions. The route
  // validates a shared secret before touching the database.
  "/api/internal/events/lifecycle",
  // Google and Apple hand back here from /organiser-setup, the one page that
  // can sign people in while the apex is in waitlist mode, and the onboarding
  // step a first provider sign-up still owes has to be reachable.
  "/auth/callback",
  "/auth/onboarding",
  // Linking a provider to an already signed-in account has its own callback so
  // it never becomes a sign-in as that provider's user.
  "/auth/link/callback",
]);

// Prefixes, matched on a path segment so `/checkin` does not also open
// `/checkinXYZ`. Each one is either a pre-launch organiser door or something a
// signed-in organiser still needs while the athlete site is closed.
const PUBLIC_PREFIXES = [
  "/api/waitlist",
  // The organiser sign-up flow starts on the athlete site. The organiser
  // portal's landing page sends people here, so the gate has to let them
  // through or the only route into the product dead-ends (issue #302).
  "/organiser-setup",
  "/api/organiser/setup",
  // Settings reads and changes the account's sign-in methods.
  "/api/user/sign-in-methods",
  // Ticket scanning runs from a phone at the event, with no athlete session.
  "/checkin",
  "/api/checkin",
];

// Build output, images and the favicon. The matcher already skips most of these
// but the list keeps the waitlist from swallowing a missing-asset request.
const ASSET_PREFIXES = ["/_next", "/images", "/favicon"];

/** True when `pathname` stays reachable on the athlete host while waitlisted. */
export function servesWhileWaitlisted(pathname: string): boolean {
  if (PUBLIC_WHILE_WAITLISTED.has(pathname)) return true;
  if (ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// The legal pages have to be public before launch, and the waitlist footer
// links to them. They are served from app/waitlist/(legal), which drops the
// site header.
const LEGAL_PATHS = new Set(["/terms", "/privacy", "/cookies"]);

/** True for the three pages that exist on both the live site and the waitlist. */
export function isLegalPath(pathname: string): boolean {
  return LEGAL_PATHS.has(pathname);
}
