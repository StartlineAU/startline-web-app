import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { assertTurnstile } from "@/lib/turnstile";
import { renderEmail } from "@/emails/render";
import { FeedbackSubmittedEmail } from "@/emails/feedback-submitted";

const ADMIN_EMAIL = "admin@startlineau.com";

const feedbackSchema = z.object({
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  details: z.string().min(1).max(5000),
  email: z.string().max(255).optional(),
  filenames: z.array(z.string().max(255)).optional(),
  turnstileToken: z.string().max(4000).optional(),
});


export async function POST(request: NextRequest) {
  const blocked = await rateLimit(request, { prefix: "feedback", limit: 3, windowSeconds: 60 });
  if (blocked) return blocked;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "Email service is not configured." },
      { status: 500 }
    );
  }

  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const botBlocked = await assertTurnstile(request, parsed.data, "feedback");
  if (botBlocked) return botBlocked;

  const type      = parsed.data.type.trim();
  const title     = parsed.data.title.trim();
  const details   = parsed.data.details.trim();
  const email     = (parsed.data.email ?? "").trim();
  const filenames = parsed.data.filenames ?? [];

  if (!type || !title || !details) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const ref = "SL-" + String(Math.floor(1000 + Math.random() * 9000));

  const { html, text } = await renderEmail(
    FeedbackSubmittedEmail({ reference: ref, type, title, details, email: email || undefined, filenames }),
  );

  const replyTo = email || undefined;
  const resend = new Resend(resendApiKey);

  const { data, error } = await resend.emails.send({
    from:    "Startline <noreply@startlineau.com>",
    to:      ADMIN_EMAIL,
    replyTo,
    subject: `[${type}] ${title} — ${ref}`,
    html,
    text,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json(
      { error: "Could not send your report right now. Please try again." },
      { status: 500 }
    );
  }

  console.log("Feedback email sent, Resend id:", data?.id);
  return NextResponse.json({ ref });
}
