import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";
import { resolveUserRow } from "@/lib/user-session";
import { needsProfileOnboarding } from "@/lib/onboarding";

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const user = await resolveUserRow(session.sub, session.email, session.name);
    // No row means this identity was never linked to the account that holds the
    // email. The caller is signed in to Cognito but has no app account, which is
    // a refusal, not an error they can fix by retrying.
    if (!user) {
      return NextResponse.json({ error: "No account for this identity." }, { status: 403 });
    }

    // Social sign-up skips the modal's onboarding step, so the caller sends
    // first-time provider users to /auth/onboarding before the app.
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { dateOfBirth: true },
    });

    return NextResponse.json({
      ok: true,
      needsOnboarding: needsProfileOnboarding(profile ?? {}),
    });
  } catch (err) {
    console.error("User session upsert error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
