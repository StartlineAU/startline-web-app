import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "change-this-secret-in-production"
);

// Routes an approved organiser can access
const ORGANISER_PROTECTED = ["/organiser/dashboard", "/organiser/new-listing"];

// Routes only accessible after email verification + profile completion
const ONBOARDING_ROUTES = ["/organiser/onboarding"];

// Admin routes
const ADMIN_PROTECTED = ["/admin/dashboard", "/admin/organisers", "/admin/events"];

async function getPayload(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; role: string; status: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Admin routes ────────────────────────────────────────────────────────────
  if (ADMIN_PROTECTED.some((p) => pathname.startsWith(p))) {
    const token   = req.cookies.get("sl-admin-token")?.value;
    const payload = await getPayload(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  // ── Organiser protected routes (must be APPROVED) ───────────────────────────
  if (ORGANISER_PROTECTED.some((p) => pathname.startsWith(p))) {
    const token   = req.cookies.get("sl-token")?.value;
    const payload = await getPayload(token);

    if (!payload || payload.role !== "organiser") {
      return NextResponse.redirect(new URL("/organiser", req.url));
    }

    // Redirect based on account status
    if (payload.status === "PENDING_EMAIL") {
      return NextResponse.redirect(new URL("/organiser/verify-email", req.url));
    }
    if (payload.status === "PENDING_PROFILE") {
      return NextResponse.redirect(new URL("/organiser/onboarding", req.url));
    }
    if (payload.status === "PENDING_REVIEW" || payload.status === "REJECTED") {
      return NextResponse.redirect(new URL("/organiser/pending", req.url));
    }

    return NextResponse.next();
  }

  // ── Onboarding route (must be PENDING_PROFILE) ───────────────────────────────
  if (ONBOARDING_ROUTES.some((p) => pathname.startsWith(p))) {
    const token   = req.cookies.get("sl-token")?.value;
    const payload = await getPayload(token);
    if (!payload || payload.role !== "organiser") {
      return NextResponse.redirect(new URL("/organiser", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/organiser/dashboard/:path*",
    "/organiser/new-listing/:path*",
    "/organiser/onboarding/:path*",
    "/admin/dashboard/:path*",
    "/admin/organisers/:path*",
    "/admin/events/:path*",
  ],
};
