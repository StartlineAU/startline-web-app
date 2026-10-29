import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";
import { getAccountSignInState } from "@/lib/account-sign-in";

// GET /api/user/security
// What the settings screen needs to render the right controls: whether this
// profile has a password, which providers are linked, and the local MFA flag.
export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const state = await getAccountSignInState(session);
  if (!state) {
    return NextResponse.json({ error: "Could not read your sign-in methods." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where:  { cognitoSub: session.sub },
    select: { mfaEnabled: true },
  });

  return NextResponse.json({
    providers:   [...new Set(state.identities.map((identity) => identity.provider))],
    hasPassword: state.hasPassword,
    mfaEnabled:  user?.mfaEnabled ?? false,
  });
}
