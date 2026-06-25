import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendGuestEmailVerificationCode } from "@/lib/guest-email-verification";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { eventId?: string; email?: string };
    const { eventId, email } = body;

    if (!eventId || !email) {
      return NextResponse.json({ error: "Missing event or email." }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, status: true, registrationType: true },
    });

    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (event.status !== "APPROVED" || event.registrationType !== "startline") {
      return NextResponse.json({ error: "This event is not accepting registrations." }, { status: 409 });
    }

    const result = await sendGuestEmailVerificationCode(email, eventId, event.title);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Guest verify send error:", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    const needsSchemaSync =
      detail.includes("guestEmailVerification") ||
      detail.includes("guest_email_verifications") ||
      detail.includes("does not exist");

    const error =
      process.env.NODE_ENV === "development" && needsSchemaSync
        ? "Registration email verification is not set up yet. Run `pnpm exec prisma db push`, then restart `pnpm dev`."
        : process.env.NODE_ENV === "development"
          ? detail
          : "Failed to send verification code.";

    return NextResponse.json({ error }, { status: 503 });
  }
}
