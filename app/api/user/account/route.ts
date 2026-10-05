import { NextResponse } from "next/server";
import { DeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { cognito, describeCognitoError, getAccessToken } from "@/lib/cognito-user";
import { accountDeletionStatus } from "@/lib/account-deletion";
import { z } from "zod";

const deleteSchema = z.object({ confirm: z.literal("DELETE") });

// GET /api/user/account
// What deleting this account would run into: the organisations that have to be
// handed over or closed first, and the upcoming entries the person would lose
// access to. The delete screen shows these before anything is removed.
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    return NextResponse.json({ email: session.email, ...(await accountDeletionStatus(session.sub)) });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// DELETE /api/user/account
// Body: { confirm: "DELETE" }. Removes the sign-in and the account record.
//
// What goes: the profile, private details, follows, saved events,
// notifications and organisation memberships. What stays: entries the person
// made, detached from the account (Registration.userId becomes null), because
// they are the organiser's entry list and financial record. Reviews stay
// without an author for the same reason.
export async function DELETE(req: Request) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  let status;
  try {
    status = await accountDeletionStatus(session.sub);
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
  if (status.blockers.length > 0) {
    return NextResponse.json(
      {
        error: "You are the only owner of an organisation. Transfer ownership or delete it first.",
        code: "OWNS_ORGANISATION",
        blockers: status.blockers,
      },
      { status: 409 },
    );
  }

  // The sign-in goes first. If it cannot be removed nothing else is touched,
  // so nobody is left with a login that has no account behind it.
  const accessToken = await getAccessToken();
  if (!accessToken) return NextResponse.json({ error: "No session." }, { status: 401 });
  try {
    await cognito.send(new DeleteUserCommand({ AccessToken: accessToken }));
  } catch (err) {
    const { status: code, error } = describeCognitoError(err);
    return NextResponse.json({ error }, { status: code });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Organisations they set up but no longer own keep running. Their
      // account email is where notifications go, so move it to a current
      // owner. One at a time: the column is unique and a clash must not
      // undo the rest.
      const organisations = await tx.organiser.findMany({
        where: { email: session.email },
        select: {
          id: true,
          members: { where: { role: "OWNER", userId: { not: session.sub } }, select: { user: { select: { email: true } } }, take: 1 },
        },
      });
      for (const organisation of organisations) {
        const owner = organisation.members[0]?.user.email;
        if (!owner) continue;
        const clash = await tx.organiser.findUnique({ where: { email: owner }, select: { id: true } });
        if (!clash) await tx.organiser.update({ where: { id: organisation.id }, data: { email: owner } });
      }
      await tx.user.delete({ where: { id: session.sub } });
    });
  } catch (err) {
    // The login is already gone, so the person cannot retry. Log loudly: an
    // admin has to remove the leftover record by hand.
    console.error("Account record survived a deleted login:", session.sub, err);
    return NextResponse.json({ ok: true, partial: true });
  }

  return NextResponse.json({ ok: true });
}
