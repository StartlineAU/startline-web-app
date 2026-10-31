import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { JWTPayload } from "jose";
import { USER_DOMAIN, ORGANISER_DOMAIN, ADMIN_DOMAIN } from "@/lib/portal-domains";
import { isLegalPath, publicSiteMode, servesWhileWaitlisted } from "@/lib/site-mode";

const region   = process.env.NEXT_PUBLIC_AWS_REGION          ?? "";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const clientId   = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID    ?? "";

const cognitoDomain = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

const JWKS = createRemoteJWKSet(
  new URL(`${cognitoDomain}/.well-known/jwks.json`)
);

const ORGANISER_PROTECTED = [
  "/organiser/dashboard",
  "/organiser/listings",
  "/organiser/profile",
  "/organiser/members",
  "/organiser/new-listing",
  "/organiser/onboarding",
  "/organiser/payments",
  "/organiser/events",
];

const ADMIN_PROTECTED = [
  "/admin/dashboard",
  "/admin/events",
  "/admin/organisers",
  "/admin/reviews",
  "/admin/users",
  "/admin/registrations",
  "/admin/analytics",
  "/admin/audit",
  "/admin/payouts",
  "/admin/security",
];

async function getVerifiedPayload(req: NextRequest): Promise<JWTPayload | null> {
  const lastAuthUser = req.cookies.get(
    `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`
  )?.value;
  if (!lastAuthUser) return null;

  const accessToken = (
    req.cookies.get(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`)?.value ??
    req.cookies.get(`CognitoIdentityServiceProvider.${clientId}.${encodeURIComponent(lastAuthUser)}.accessToken`)?.value
  );
  if (!accessToken) return null;

  try {
    const { payload } = await jwtVerify(accessToken, JWKS, {
      issuer: cognitoDomain,
      audience: undefined,
    });
    return payload;
  } catch {
    return null;
  }
}

function isAdmin(payload: JWTPayload): boolean {
  const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
  return groups.includes("admins");
}

// A waitlist bypass is for staff reviewing a production deploy, not for every
// signed-in account: the `admins` group is the only allowlist, so an ordinary
// athlete session keeps seeing the waitlist.
function isSitePreviewer(payload: JWTPayload): boolean {
  return isAdmin(payload);
}

// A bypass response must never be cached. A shared cache that stored the staff
// view would hand the full site to the next anonymous visitor.
function withPrivateNoStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.headers.set("Vary", "Cookie");
  return res;
}

/** The waitlist page, or its legal-page copy, for a gated host. */
function waitlistResponse(req: NextRequest, pathname: string): NextResponse {
  if (isLegalPath(pathname)) {
    return NextResponse.rewrite(new URL(`/waitlist${pathname}`, req.url));
  }
  return NextResponse.rewrite(new URL("/waitlist", req.url));
}

// Paths a gated portal host still has to answer: signing in, provider
// callbacks, the APIs the portal calls, and Next's own assets. Each route
// enforces its own access rules, so the waitlist does not need to hide them.
function servesPortalInfrastructure(pathname: string): boolean {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/favicon")
  );
}

// Routing for any deployment that serves all three portals from one hostname:
// local dev, PR previews, staging, and a staff preview of production while the
// waitlist gate is on.
async function routeSingleHost(req: NextRequest, pathname: string): Promise<NextResponse> {
  if (pathname === "/organiser" || pathname === "/organiser-landing") {
    return NextResponse.rewrite(new URL("/organiser-landing", req.url));
  }

  if (ORGANISER_PROTECTED.some((p) => pathname.startsWith(p))) {
    const payload = await getVerifiedPayload(req);
    if (!payload) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (ADMIN_PROTECTED.some((p) => pathname.startsWith(p))) {
    const payload = await getVerifiedPayload(req);
    if (!payload || !isAdmin(payload)) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export async function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    const bypass = req.cookies.get("__e2e_bypass")?.value;
    if (bypass) return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  // The waitlist and its legal copies are the destination of every gate, so
  // they always pass through. Rewriting /waitlist to itself would loop, and the
  // organiser host would otherwise redirect it to the athlete site.
  if (pathname === "/waitlist" || pathname.startsWith("/waitlist/")) {
    return NextResponse.next();
  }

  if (host === ORGANISER_DOMAIN) {
    // Waitlist mode closes the whole portal, not only the athlete site. The
    // auth and API paths above stay open so an organiser can still sign in;
    // after that the portal's own routes decide what they may see.
    if (publicSiteMode() === "waitlist" && !servesPortalInfrastructure(pathname)) {
      const payload = await getVerifiedPayload(req);
      if (!payload) return waitlistResponse(req, pathname);
    }

    if (pathname === "/" || pathname === "/organiser") {
      return NextResponse.rewrite(new URL("/organiser-landing", req.url));
    }

    if (ORGANISER_PROTECTED.some((p) => pathname.startsWith(p))) {
      const payload = await getVerifiedPayload(req);
      // Stay on this host. Sending them to the athlete site landed them on the
      // waitlist with no way back and no way to sign in, which read as "clicking
      // organiser just reverts me to the home page" (issue #302).
      if (!payload) return NextResponse.redirect(new URL("/organiser-landing", req.url));
      return NextResponse.next();
    }

    if (
      !pathname.startsWith("/organiser") &&
      // Sign-in on the organiser landing page hands off to these for an
      // unverified email or a password reset; bouncing them to the athlete site
      // stranded the flow half-finished.
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/api") &&
      !pathname.startsWith("/images") &&
      !pathname.startsWith("/favicon")
    ) {
      return NextResponse.redirect(new URL(`https://${USER_DOMAIN}`));
    }

    return NextResponse.next();
  }

  if (host === ADMIN_DOMAIN) {
    // Waitlist mode hides the portal from everyone except staff. The login page
    // is the exception, or there would be no way to sign in and review the
    // deployment; auth, API and asset paths stay reachable for the same reason.
    if (
      publicSiteMode() === "waitlist" &&
      pathname !== "/admin/login" &&
      !servesPortalInfrastructure(pathname)
    ) {
      const payload = await getVerifiedPayload(req);
      if (!payload || !isSitePreviewer(payload)) {
        return waitlistResponse(req, pathname);
      }
    }

    if (ADMIN_PROTECTED.some((p) => pathname.startsWith(p))) {
      const payload = await getVerifiedPayload(req);
      if (!payload || !isAdmin(payload)) {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
      return NextResponse.next();
    }

    return NextResponse.next();
  }

  if (host === USER_DOMAIN || host === `www.${USER_DOMAIN}`) {
    if (servesWhileWaitlisted(pathname)) {
      return NextResponse.next();
    }

    // Live: the site is open to everyone. Portal protection still applies, so a
    // signed-out visitor to /organiser/dashboard is sent to sign in rather than
    // served the page.
    if (publicSiteMode() === "live") {
      return routeSingleHost(req, pathname);
    }

    // Waitlist. Staff in the `admins` group see the whole site on the production
    // host, which is how a deploy is reviewed before launch. Verification is the
    // usual Cognito check, so a stale or tampered token gets the waitlist with
    // everyone else rather than a bypass.
    const payload = await getVerifiedPayload(req);
    if (payload && isSitePreviewer(payload)) {
      const res = await routeSingleHost(req, pathname);
      // A redirect carries no content, so only a page response needs the
      // no-cache treatment.
      return res.headers.get("location") ? res : withPrivateNoStore(res);
    }

    return waitlistResponse(req, pathname);
  }

  return routeSingleHost(req, pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images/|favicon.ico).*)",
  ],
};
