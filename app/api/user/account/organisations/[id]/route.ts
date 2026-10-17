import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserRole, getUserSession } from "@/lib/amplify-server";
import { organisationDeletionBlocker, organisationRegistrationCount } from "@/lib/account-deletion";
import { idParams } from "@/lib/schemas";

// DELETE /api/user/account/organisations/[id]
// Closes an organisation the caller owns, as a step towards deleting their
// account. It names the organisation, unlike DELETE /api/organiser which acts
// on whichever one is active, so the wrong one cannot be removed by a stale
// cookie. Owner only, and only while it has never taken an entry.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    if ((await getOrganiserRole(id)) !== "OWNER") {
      return NextResponse.json({ error: "Only an Owner can delete an organisation." }, { status: 403 });
    }

    const blocker = organisationDeletionBlocker(await organisationRegistrationCount(id));
    if (blocker) return NextResponse.json({ error: blocker, code: "HAS_ENTRIES" }, { status: 409 });

    await prisma.organiser.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete the organisation." }, { status: 500 });
  }
}
