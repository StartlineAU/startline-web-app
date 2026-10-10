import { NextResponse } from "next/server";
import {
  GetUserCommand,
  UpdateUserAttributesCommand,
  VerifyUserAttributeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { cognito, describeCognitoError, getAccessToken } from "@/lib/cognito-user";
import { z } from "zod";

const emailActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), email: z.string().max(255) }),
  z.object({ action: z.literal("confirm"), code: z.string().min(1).max(10) }),
]);

// POST /api/user/email
// Changing the address you sign in with, in two steps so a typo cannot lock
// anyone out:
//   { action: "request", email } - Cognito emails a code to the NEW address.
//                                  The pool keeps the old address in force
//                                  until that code comes back (see
//                                  user_attribute_update_settings in Terraform).
//   { action: "confirm", code }  - Cognito switches the address, and our own
//                                  records follow what Cognito now reports.
export async function POST(req: Request) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = emailActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const body = parsed.data;

  try {
    if (body.action === "request") {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
      }
      if (email === session.email.toLowerCase()) {
        return NextResponse.json({ error: "That is already your email address." }, { status: 400 });
      }
      const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (taken && taken.id !== session.sub) {
        return NextResponse.json({ error: "That email address is already used by another account." }, { status: 409 });
      }

      const accessToken = await getAccessToken();
      if (!accessToken) return NextResponse.json({ error: "No session." }, { status: 401 });
      await cognito.send(new UpdateUserAttributesCommand({
        AccessToken: accessToken,
        UserAttributes: [{ Name: "email", Value: email }],
      }));
      return NextResponse.json({ ok: true, email });
    }

    const accessToken = await getAccessToken();
    if (!accessToken) return NextResponse.json({ error: "No session." }, { status: 401 });
    await cognito.send(new VerifyUserAttributeCommand({
      AccessToken: accessToken,
      AttributeName: "email",
      Code: body.code.trim(),
    }));

    // Take the address from Cognito, not from the browser: it is the one the
    // code was actually sent to and that sign-in will now accept.
    const current = await cognito.send(new GetUserCommand({ AccessToken: accessToken }));
    const email = current.UserAttributes?.find(a => a.Name === "email")?.Value?.toLowerCase();
    if (!email) return NextResponse.json({ error: "Could not read your new email address." }, { status: 500 });

    const previous = session.email;
    await prisma.user.update({ where: { id: session.sub }, data: { email } });
    // An organisation records its creator's login email and is notified on it.
    // Best effort: it is unique, so it stays put if the new address is taken.
    await prisma.organiser
      .updateMany({ where: { email: previous, createdBy: session.sub }, data: { email } })
      .catch((err: unknown) => console.error("Could not move organiser account email:", err));

    return NextResponse.json({ ok: true, email });
  } catch (err) {
    const { status, error } = describeCognitoError(err);
    return NextResponse.json({ error }, { status });
  }
}
