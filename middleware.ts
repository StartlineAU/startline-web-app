import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

const region     = process.env.NEXT_PUBLIC_AWS_REGION                 ?? "";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID        ?? "";
const clientId   = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID           ?? "";

/**
 * Cognito publishes its RS256 public keys at this well-known URL.
 * jose's createRemoteJWKSet fetches and caches the keyset automatically.
 */
const JWKS = createRemoteJWKSet(
  new URL(`https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`)
);

const ORGANISER_PROTECTED = [
  "/organiser/dashboard",
  "/organiser/listings",
  "/organiser/profile",
  "/organiser/new-listing",
  "/organiser/onboarding",
];

/**
 * Reads and verifies the Cognito access token from the Amplify cookie.
 * Amplify stores the access token under:
 *   CognitoIdentityServiceProvider.{clientId}.{lastAuthUser}.accessToken
 */
async function getVerifiedSub(req: NextRequest): Promise<string | null> {
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
      audience: undefined, // access tokens don't carry aud — idTokens do
    });
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Dev bypass — skip all auth checks locally ──────────────────────────────
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // ── Organiser protected routes (must be signed in) ─────────────────────────
  if (ORGANISER_PROTECTED.some((p) => pathname.startsWith(p))) {
    const sub = await getVerifiedSub(req);
    if (!sub) {
      return NextResponse.redirect(new URL("/organiser", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/organiser/dashboard/:path*",
    "/organiser/listings/:path*",
    "/organiser/profile/:path*",
    "/organiser/new-listing/:path*",
    "/organiser/onboarding/:path*",
  ],
};

