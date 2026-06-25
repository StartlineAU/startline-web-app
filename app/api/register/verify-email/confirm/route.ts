import { NextRequest, NextResponse } from "next/server";
import { confirmGuestEmailVerificationCode } from "@/lib/guest-email-verification";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { eventId?: string; email?: string; code?: string };
    const { eventId, email, code } = body;

    if (!eventId || !email || !code) {
      return NextResponse.json({ error: "Missing event, email, or code." }, { status: 400 });
    }

    const result = await confirmGuestEmailVerificationCode(email, eventId, code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Guest verify confirm error:", err);
    return NextResponse.json({ error: "Failed to verify code." }, { status: 503 });
  }
}
