import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Resend } from "resend";
import { renderEmail } from "@/emails/render";
import { WaitlistConfirmationEmail } from "@/emails/waitlist-confirmation";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { assertTurnstile } from "@/lib/turnstile";

const waitlistSchema = z.object({
  email: z.string().max(255),
  turnstileToken: z.string().max(4000).optional(),
});

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY environment variable.");
  return new Resend(key);
}

export async function POST(req: NextRequest) {
  const parsed = waitlistSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  const { email } = parsed.data;

  const botBlocked = await assertTurnstile(req, parsed.data, "waitlist");
  if (botBlocked) return botBlocked;

  // Per address, so one address is not mailed over and over, and per caller,
  // so one caller cannot walk through a list of other people's addresses.
  // Each one sends an email, so an unreadable counter refuses.
  const blocked =
    (await rateLimit(req, { prefix: "waitlist-ip", limit: 5, windowSeconds: 600, failClosed: true })) ??
    (await rateLimit(req, {
      prefix: "waitlist",
      limit: 3,
      windowSeconds: 60,
      identifier: email?.toLowerCase(),
      failClosed: true,
    }));
  if (blocked) return blocked;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  try {
    await prisma.waitlistSubscriber.create({ data: { email } });
  } catch (e) {
    // Already on the list: the same answer as a new sign-up, so the endpoint
    // cannot be used to find out who has signed up. No second email.
    if ((e as Record<string, unknown>).code === "P2002") {
      return NextResponse.json({ success: true });
    }
    console.error("DB error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  try {
    const { html, text } = await renderEmail(WaitlistConfirmationEmail());
    const result = await getResend().emails.send({
      from:    "Startline <waitlist@startlineau.com>",
      to:      email,
      subject: "You're on the Startline waitlist",
      html,
      text,
    });
    if (result.error) {
      console.error("Resend error:", result.error);
    } else {
      console.log("Email sent successfully, id:", result.data?.id);
    }
  } catch (emailError) {
    console.error("Email send failed:", emailError);
  }

  return NextResponse.json({ success: true });
}
