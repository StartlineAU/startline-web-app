import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/amplify-server";
import {
  getSignInMethods,
  setPassword,
  SignInMethodError,
} from "@/lib/cognito-sign-in-methods";
import { isPasswordValid, PASSWORD_POLICY_SUMMARY } from "@/lib/password-policy";
import { enabledSocialProviders } from "@/lib/social-providers";

const setPasswordSchema = z.object({
  newPassword: z.string().min(1).max(256),
});

// POST /api/user/password
// Adds a password to a profile that only has a Google or Apple sign-in. The
// existing Cognito profile is reused, so the app account and its data stay put.
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (!session.username) {
    return NextResponse.json(
      { error: "Sign-in methods cannot be managed in this environment." },
      { status: 503 },
    );
  }

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

  try {
    const methods = await getSignInMethods(session.username, enabledSocialProviders());
    if (methods.hasPassword) {
      return NextResponse.json(
        { error: "You already have a password. Use Change password instead." },
        { status: 409 },
      );
    }

    await setPassword(session.username, parsed.data.newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SignInMethodError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Could not set a Cognito password:", error);
    return NextResponse.json({ error: "Could not set your password. Please try again." }, { status: 500 });
  }
}
