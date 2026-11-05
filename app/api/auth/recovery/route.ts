import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { resetAuthenticatorWithRecoveryCode } from "@/lib/authenticator-recovery";

const recoverySchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(1).max(256),
  code: z.string().min(4).max(64),
});

// Someone who has lost the authenticator app cannot sign in with their password
// (Cognito asks for the code), so this is unauthenticated by necessity. The
// password is verified by Cognito before a code is even looked at, and the rate
// limit keeps a guessed code sheet from being worked through.
export async function POST(req: NextRequest) {
  const parsed = recoverySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your email, password and a recovery code." },
      { status: 400 },
    );
  }
  const { email, password, code } = parsed.data;

  const limited = await rateLimit(req, {
    prefix: "mfa-recovery",
    limit: 5,
    windowSeconds: 300,
    identifier: email.trim().toLowerCase(),
  });
  if (limited) return limited;

  try {
    const outcome = await resetAuthenticatorWithRecoveryCode({ email, password, code });
    switch (outcome.kind) {
      case "reset":
        return NextResponse.json({ ok: true });
      case "bad-credentials":
        return NextResponse.json({ error: "That email or password did not match." }, { status: 401 });
      case "bad-code":
        return NextResponse.json({ error: "That recovery code did not match. Check it and try again." }, { status: 401 });
      case "no-codes":
        return NextResponse.json(
          { error: "This account has no recovery codes left. Contact support." },
          { status: 409 },
        );
      case "unavailable":
        return NextResponse.json(
          { error: "Account recovery is not available on this deployment." },
          { status: 503 },
        );
    }
  } catch (error) {
    console.error("MFA recovery failed:", error);
    return NextResponse.json(
      { error: "Could not reset the authenticator app. Please try again." },
      { status: 500 },
    );
  }
}
