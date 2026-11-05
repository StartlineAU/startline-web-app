import { NextResponse } from "next/server";
import { AssociateSoftwareTokenCommand, VerifySoftwareTokenCommand, SetUserMFAPreferenceCommand, ChangePasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";
import { canUseMfa } from "@/lib/sign-in-methods";
import { getSessionSignInMethods } from "@/lib/session-sign-in-methods";
import { SignInMethodError, verifyAuthenticatorStepUp } from "@/lib/cognito-sign-in-methods";
import { cognito, describeCognitoError, getAccessToken } from "@/lib/cognito-user";
import { z } from "zod";

const mfaActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enable") }),
  // Turning it off is a security downgrade, so it takes the password and a code.
  z.object({
    action: z.literal("disable"),
    password: z.string().min(1).max(256).optional(),
    code: z.string().regex(/^\d{6}$/).optional(),
  }),
  z.object({ action: z.literal("setup") }),
  z.object({ action: z.literal("verify-setup"), code: z.string().max(10) }),
  z.object({ action: z.literal("change-password"), currentPassword: z.string().min(1), newPassword: z.string().min(1) }),
]);

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { cognitoSub: session.sub } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({ mfaEnabled: user.mfaEnabled });
}

function stepUpError(error: unknown) {
  if (error instanceof SignInMethodError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("MFA step-up failed:", error);
  return NextResponse.json({ error: "Could not check your password and code." }, { status: 500 });
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = mfaActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const body = parsed.data;

  // Cognito decides whether sign-in asks for a code, so read the real state
  // rather than the database label: setup needs a password, and turning it off
  // needs the password and a code while the authenticator app is on.
  const methods = await getSessionSignInMethods(session);
  if (!methods) {
    return NextResponse.json({ error: "Could not read your sign-in methods." }, { status: 503 });
  }

  if (body.action === "disable") {
    if (methods.mfaRequired) {
      if (!methods.hasPassword) {
        return NextResponse.json(
          { error: "Set a password before turning off the authenticator app." },
          { status: 409 },
        );
      }
      if (!body.password || !body.code) {
        return NextResponse.json(
          { error: "Enter your password and a code from your authenticator app." },
          { status: 400 },
        );
      }
      if (!session.username) {
        return NextResponse.json(
          { error: "Sign-in methods cannot be managed in this environment." },
          { status: 503 },
        );
      }
      try {
        await verifyAuthenticatorStepUp({
          username: session.username,
          password: body.password,
          code: body.code,
        });
      } catch (error) {
        return stepUpError(error);
      }
    }
  } else if (!canUseMfa(methods)) {
    return NextResponse.json(
      { error: "Set a password before adding an authenticator app." },
      { status: 409 },
    );
  }

  const user = await prisma.user.findUnique({ where: { cognitoSub: session.sub } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  try {
    return await handleAction(body, user.id);
  } catch (err) {
    const { status, error } = describeCognitoError(err);
    return NextResponse.json({ error }, { status });
  }
}

async function handleAction(body: z.infer<typeof mfaActionSchema>, userId: string) {
  switch (body.action) {
    case "enable": {
      await prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      });
      return NextResponse.json({ ok: true });
    }

    case "disable": {
      // The flag alone is only a label: Cognito decides whether sign-in asks
      // for a code, so it has to be told first.
      const accessToken = await getAccessToken();
      if (!accessToken) return NextResponse.json({ error: "No session." }, { status: 401 });
      await cognito.send(new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false },
      }));
      await prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false },
      });
      return NextResponse.json({ ok: true });
    }

    case "setup": {
      const accessToken = await getAccessToken();
      if (!accessToken) return NextResponse.json({ error: "No session." }, { status: 401 });
      const cmd = new AssociateSoftwareTokenCommand({ AccessToken: accessToken });
      const res = await cognito.send(cmd);
      return NextResponse.json({ secretCode: res.SecretCode });
    }

    case "verify-setup": {
      const { code } = body;
      const accessToken = await getAccessToken();
      if (!accessToken) return NextResponse.json({ error: "No session." }, { status: 401 });
      await cognito.send(new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: code,
        FriendlyDeviceName: "Startline Authenticator",
      }));
      await cognito.send(new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
      }));
      await prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      });
      return NextResponse.json({ ok: true });
    }

    case "change-password": {
      const { currentPassword, newPassword } = body;
      const accessToken = await getAccessToken();
      if (!accessToken) return NextResponse.json({ error: "No session." }, { status: 401 });
      await cognito.send(new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: currentPassword,
        ProposedPassword: newPassword,
      }));
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
