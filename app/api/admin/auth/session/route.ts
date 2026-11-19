import { NextResponse } from "next/server";
import { getAdminSession, getServerSession } from "@/lib/amplify-server";
import { adminHasAuthenticator } from "@/lib/admin-mfa";

// Called after an admin signs in so their Admin row exists before the first
// review or audit entry needs it. getAdminSession creates or finds the row.
// An admin without an authenticator app is told so (MFA_REQUIRED), and the
// login page then sets one up before letting them in.
export async function POST() {
  const session = await getServerSession();
  if (!session || !session.groups.includes("admins")) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  if (!(await adminHasAuthenticator(session))) {
    return NextResponse.json(
      { error: "Admin accounts need an authenticator app.", code: "MFA_REQUIRED" },
      { status: 403 },
    );
  }

  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
