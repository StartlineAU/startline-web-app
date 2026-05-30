import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet, JWTPayload } from "jose";

const region     = process.env.NEXT_PUBLIC_AWS_REGION          ?? "";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const clientId   = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID    ?? "";

const JWKS = createRemoteJWKSet(
  new URL(`https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`)
);

const ORGANISER_PROTECTED = [
  "/organiser/dashboard",
  "/organiser/listings",
  "/organiser/profile",
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
];

const CUSTOMER_DOMAIN = "startlineau.com";
const ORGANISER_DOMAIN = "organiser.startlineau.com";

async function getVerifiedPayload(req: NextRequest): Promise<JWTPayload | null> {
  const lastAuthUser = req.cookies.get(
    `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`
  )?.value;
  if (!lastAuthUser) return null;

  const accessToken = req.cookies.get(
    `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`
  )?.value;
  if (!accessToken) return null;

  try {
    const { payload } = await jwtVerify(accessToken, JWKS, {
      issuer:   `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      audience: undefined,
    });
    return payload;
  } catch {
    return null;
  }
}

function isAdmin(payload: JWTPayload): boolean {
  const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
  return groups.includes("admin-nonprod-users");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Dev mode: skip domain routing, skip auth ─────────────────────────
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // ── Domain-based routing (production only) ───────────────────────────
  const host = req.headers.get("host") ?? "";

  // Organiser subdomain: serve organiser portal
  if (host === ORGANISER_DOMAIN) {
    // Rewrite root to organiser login
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/organiser", req.url));
    }

    // Protect organiser routes
    if (ORGANISER_PROTECTED.some((p) => pathname.startsWith(p))) {
      const payload = await getVerifiedPayload(req);
      if (!payload) return NextResponse.redirect(new URL("/organiser", req.url));
      return NextResponse.next();
    }

    if (ADMIN_PROTECTED.some((p) => pathname.startsWith(p))) {
      const payload = await getVerifiedPayload(req);
      if (!payload || !isAdmin(payload)) {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
      return NextResponse.next();
    }

    // Everything else on organiser subdomain → organiser login
    if (
      !pathname.startsWith("/organiser") &&
      !pathname.startsWith("/admin") &&
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/api") &&
      !pathname.startsWith("/images") &&
      !pathname.startsWith("/favicon")
    ) {
      return NextResponse.redirect(new URL("/organiser", req.url));
    }

    return NextResponse.next();
  }

  // Customer domain: redirect organiser/admin paths to organiser subdomain
  if (host === CUSTOMER_DOMAIN || host === `www.${CUSTOMER_DOMAIN}`) {
    if (pathname.startsWith("/organiser") || pathname.startsWith("/admin")) {
      return NextResponse.redirect(
        `https://${ORGANISER_DOMAIN}${pathname}${req.nextUrl.search}`
      );
    }
    return NextResponse.next();
  }

  // ── Fallback (any other domain / Amplify preview) ────────────────────
  // Serve customer site by default, protect organiser/admin routes
  if (ORGANISER_PROTECTED.some((p) => pathname.startsWith(p))) {
    const payload = await getVerifiedPayload(req);
    if (!payload) return NextResponse.redirect(new URL("/organiser", req.url));
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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images/|favicon.ico).*)",
  ],
};
