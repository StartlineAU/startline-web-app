import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { getServerSession } from "@/lib/amplify-server";

const prisma = new PrismaClient();

/**
 * POST /api/organiser/auth/session
 *
 * Called by the sign-in page immediately after Amplify.signIn() succeeds.
 * - Verifies the Cognito session server-side
 * - Upserts the Prisma Organiser record (creates on first sign-in)
 * - Sets the sl-status cookie so middleware can do status-based redirects
 * - Returns { status } so the client can redirect appropriately
 */
export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const organiser = await prisma.organiser.upsert({
      where:  { cognitoSub: session.sub },
      update: { email: session.email },
      create: {
        cognitoSub: session.sub,
        email:      session.email,
        status:     "PENDING_PROFILE",
      },
      select: { id: true, status: true },
    });

    // Store the status in a plain cookie so middleware can read it without
    // hitting the database on every protected request.
    const jar = await cookies();
    jar.set("sl-status", organiser.status, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   60 * 60 * 24 * 7, // 7 days — refreshed on each sign-in
    });

    return NextResponse.json({ status: organiser.status });
  } catch (err) {
    console.error("Session upsert error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
