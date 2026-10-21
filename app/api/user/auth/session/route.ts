import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/amplify-server";
import { resolveUserRow } from "@/lib/user-session";

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const user = await resolveUserRow(session.sub, session.email, session.name);
    // No row means this identity was never linked to the account that holds the
    // email. The caller is signed in to Cognito but has no app account, which is
    // a refusal, not an error they can fix by retrying.
    if (!user) {
      return NextResponse.json({ error: "No account for this identity." }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("User session upsert error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
