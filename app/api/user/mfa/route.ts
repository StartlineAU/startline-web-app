import { NextResponse } from "next/server";
import { AssociateSoftwareTokenCommand, VerifySoftwareTokenCommand, SetUserMFAPreferenceCommand, ChangePasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";
import { cognito, describeCognitoError, getAccessToken } from "@/lib/cognito-user";
import { z } from "zod";

const mfaActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("disable") }),
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

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = mfaActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const body = parsed.data;

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
