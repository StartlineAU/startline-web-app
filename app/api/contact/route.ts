import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { assertTurnstile } from "@/lib/turnstile";
import { renderEmail } from "@/emails/render";
import { ContactMessageEmail } from "@/emails/contact-message";

const ADMIN_EMAIL = "admin@startlineau.com";
const DEFAULT_FROM = "Startline <events@startlineau.com>";

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().min(1).max(255),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  turnstileToken: z.string().max(4000).optional(),
});


export async function POST(request: NextRequest) {
  const blocked = await rateLimit(request, { prefix: "contact", limit: 3, windowSeconds: 60 });
  if (blocked) return blocked;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "Email service is not configured yet. Please try again shortly." },
      { status: 500 }
    );
  }

  const resend = new Resend(resendApiKey);
  const from = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;

  const parsed = contactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill out all fields." }, { status: 400 });
  }

  const botBlocked = await assertTurnstile(request, parsed.data, "contact");
  if (botBlocked) return botBlocked;

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim();
  const subject = parsed.data.subject.trim();
  const message = parsed.data.message.trim();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "Please fill out all fields." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  try {
    const { html, text } = await renderEmail(ContactMessageEmail({ name, email, subject, message }));
    const { data, error } = await resend.emails.send({
      from,
      to: ADMIN_EMAIL,
      replyTo: email,
      subject: `[Contact] ${subject}`,
      html,
      text,
    });

    if (error) {
      console.error("Contact email Resend error:", error);
      return NextResponse.json(
        { error: "Could not send your message right now. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data?.id ?? null });
  } catch (error) {
    console.error("Contact email send error:", error);
    return NextResponse.json(
      { error: "Could not send your message right now. Please try again." },
      { status: 500 }
    );
  }
}
