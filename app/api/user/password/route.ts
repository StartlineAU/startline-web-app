import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/amplify-server";
import { getAccountSignInState, setAccountPassword } from "@/lib/account-sign-in";
import { describeCognitoError } from "@/lib/cognito-user";
import { isPasswordValid, PASSWORD_POLICY_SUMMARY } from "@/lib/password-policy";

const setPasswordSchema = z.object({
  newPassword: z.string().min(1).max(256),
});

// POST /api/user/password
// Adds a password to a profile that only has a Google or Apple sign-in. The
// existing Cognito profile is reused, so the app account and its data stay put.
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (session.bypass) return NextResponse.json({ error: "No Cognito session." }, { status: 401 });

  const parsed = setPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  if (!isPasswordValid(parsed.data.newPassword)) {
    return NextResponse.json(
      { error: `Password must be ${PASSWORD_POLICY_SUMMARY}` },
      { status: 400 },
    );
  }

  const state = await getAccountSignInState(session);
  if (!state) {
    return NextResponse.json({ error: "Could not read your sign-in methods." }, { status: 503 });
  }
  if (state.hasPassword) {
    return NextResponse.json(
      { error: "You already have a password. Use Change password instead." },
      { status: 409 },
    );
  }

  try {
    await setAccountPassword(session, parsed.data.newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.name === "NotAuthorizedException") {
      console.error("Cognito AdminSetUserPassword failed:", err);
      return NextResponse.json(
        { error: "Could not set your password. Please try again." },
        { status: 500 },
      );
    }
    const { status, error } = describeCognitoError(err);
    return NextResponse.json({ error }, { status });
  }
}
