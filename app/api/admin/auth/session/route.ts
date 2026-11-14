import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/amplify-server";

// Called after an admin signs in so their Admin row exists before the first
// review or audit entry needs it. getAdminSession creates or finds the row.
export async function POST() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
