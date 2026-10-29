import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { JWTPayload } from "jose";
import { USER_DOMAIN, ORGANISER_DOMAIN, ADMIN_DOMAIN } from "@/lib/portal-domains";

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

// The paths the organiser sign-up flow needs on the athlete site. The organiser
// portal's landing page sends people here, so the waitlist gate below has to let
// them through or the only route into the product dead-ends (issue #302).
const ORGANISER_SIGNUP_PATHS = ["/organiser-setup", "/api/organiser/setup"];

// Readable on the apex domain even while it shows the waitlist: the legal
// pages have to be public before launch, and the waitlist footer links to
// them. They are served from app/waitlist/(legal), which drops the site header.
const LEGAL_PATHS = ["/terms", "/privacy", "/cookies"];

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

export async function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    const bypass = req.cookies.get("__e2e_bypass")?.value;
    if (bypass) return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  if (host === ORGANISER_DOMAIN) {
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
    if (pathname === "/waitlist"
        || pathname.startsWith("/api/waitlist")
        || pathname.startsWith("/checkin")
        || pathname.startsWith("/api/checkin")
        // Stripe posts to the apex domain, and the rewrite below would answer
        // with the waitlist page: a 200 Stripe reads as delivered while no
        // payment is ever confirmed and no onboarding ever completes. Safe to
        // expose — both handlers verify the Stripe signature before anything.
        // account-events is the Accounts v2 event destination (#379).
        || pathname === "/api/stripe/webhook"
        || pathname === "/api/stripe/account-events"
        || ORGANISER_SIGNUP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
        // Google and Apple hand back here from /organiser-setup, the one page
        // that can sign people in while the apex is in waitlist mode, and the
        // onboarding step a first provider sign-up still owes has to be reachable.
        || pathname === "/auth/callback"
        || pathname === "/auth/onboarding"
        // Linking a provider to an already signed-in account has its own
        // callback so it never becomes a sign-in as that provider's user.
        || pathname === "/auth/link/callback"
        // Settings reads and changes the account's sign-in methods from here.
        || pathname.startsWith("/api/user/sign-in-methods")
        || pathname.startsWith("/_next")
        || pathname.startsWith("/images")
        || pathname.startsWith("/favicon")) {
      return NextResponse.next();
    }
    if (LEGAL_PATHS.includes(pathname)) {
      return NextResponse.rewrite(new URL(`/waitlist${pathname}`, req.url));
    }
    return NextResponse.rewrite(new URL("/waitlist", req.url));
  }

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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images/|favicon.ico).*)",
  ],
};
