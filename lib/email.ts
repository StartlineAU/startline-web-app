import { Resend } from "resend";

const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const FROM = "Startline <events@startlineau.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ── Email verification ────────────────────────────────────────────────────────
export async function sendVerificationEmail(email: string, token: string) {
  const resend = getResend();
  if (!resend) return;
  const link = `${SITE}/organiser/verify-email?token=${token}`;
  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: "Verify your Startline organiser account",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#B3E153">Verify your email</h2>
        <p>Click the link below to verify your email address and continue setting up your organiser account.</p>
        <a href="${link}" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Verify email address
        </a>
        <p style="color:#888;font-size:13px">This link expires in 24 hours. If you didn't sign up, ignore this email.</p>
      </div>
    `,
  });
}

// ── Event approved ────────────────────────────────────────────────────────────
export async function sendEventApprovedEmail(email: string, eventTitle: string) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: `Your event "${eventTitle}" is now live`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#B3E153">Event approved!</h2>
        <p>Your event <strong>${eventTitle}</strong> has been approved and is now live on Startline.</p>
        <a href="${SITE}/organiser/dashboard" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          View dashboard
        </a>
      </div>
    `,
  });
}

// ── Event rejected ────────────────────────────────────────────────────────────
export async function sendEventRejectedEmail(email: string, eventTitle: string, reason?: string) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: `Update on your event "${eventTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#141414">Event update</h2>
        <p>Your event <strong>${eventTitle}</strong> was not approved.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>Please log into your dashboard to make the required changes and resubmit.</p>
        <a href="${SITE}/organiser/dashboard" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Go to dashboard
        </a>
      </div>
    `,
  });
}
