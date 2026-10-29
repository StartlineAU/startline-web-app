import { NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { organisationDeletionBlocker, organisationRegistrationCount } from "@/lib/account-deletion";

// DELETE /api/organiser
// Deletes the active organiser. Owner only. Memberships cascade, and so do its
// events and their entries, so it is refused once any entry has been taken.
export async function DELETE() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const blocker = organisationDeletionBlocker(await organisationRegistrationCount(session.sub));
    if (blocker) return NextResponse.json({ error: blocker, code: "HAS_ENTRIES" }, { status: 409 });

    await prisma.organiser.delete({ where: { id: session.sub } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete organiser." }, { status: 500 });
  }
}
