import { Resend } from "resend";
import { formatEventDate, formatTime } from "@/lib/utils";

const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const PRODUCTION_FROM = "Startline <events@startlineau.com>";
const DEVELOPMENT_FROM = "Startline <onboarding@resend.dev>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function getEmailFrom(): string {
  if (process.env.RESEND_FROM) return process.env.RESEND_FROM;
  if (process.env.NODE_ENV === "development") return DEVELOPMENT_FROM;
  return PRODUCTION_FROM;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAud(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export type RegistrationConfirmationDetails = {
  athleteEmail: string;
  athleteName: string;
  eventTitle: string;
  eventDate: string;
  startTime?: string | null;
  venue: string;
  city: string;
  waveLabel: string | null;
  amountCents: number;
  eventId: string;
  idempotencyKey: string;
};

export function buildRegistrationConfirmationEmail(details: RegistrationConfirmationDetails) {
  const dateLine = formatEventDate(details.eventDate);
  const timeLine = details.startTime ? formatTime(details.startTime) : null;
  const ticketLine = details.waveLabel
    ? `${details.waveLabel} — ${formatAud(details.amountCents)}`
    : formatAud(details.amountCents);
  const eventUrl = `${SITE}/events/${details.eventId}`;

  return {
    subject: `You're registered for ${details.eventTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:32px;background:#141414;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#1D1D1D;border:1px solid #2A2A2A;border-radius:12px;">
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 8px;font-size:24px;line-height:1.3;color:#B3E153;">You're registered!</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#8A8F98;">
                  Hi ${escapeHtml(details.athleteName)}, congratulations — your registration is confirmed.
                </p>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#141414;border:1px solid #2A2A2A;border-radius:8px;">
                  <tr>
                    <td style="padding:20px;">
                      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#B3E153;">Registration details</p>
                      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#F5F7FA;">${escapeHtml(details.eventTitle)}</p>
                      <p style="margin:0 0 6px;font-size:14px;color:#8A8F98;">${escapeHtml(dateLine)}${timeLine ? ` · ${escapeHtml(timeLine)}` : ""}</p>
                      <p style="margin:0 0 6px;font-size:14px;color:#8A8F98;">${escapeHtml(details.venue)}, ${escapeHtml(details.city)}</p>
                      <p style="margin:0;font-size:14px;color:#F5F7FA;">Ticket: ${escapeHtml(ticketLine)}</p>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#8A8F98;">
                  We look forward to seeing you on the start line. Save this email for your records.
                </p>

                <a href="${eventUrl}" style="display:inline-block;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
                  View event
                </a>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}

export async function sendRegistrationConfirmationEmail(details: RegistrationConfirmationDetails) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not configured — skipping registration confirmation email");
    return;
  }

  const { subject, html } = buildRegistrationConfirmationEmail(details);

  const result = await resend.emails.send(
    {
      from: getEmailFrom(),
      to: details.athleteEmail,
      subject,
      html,
    },
    {
      idempotencyKey: `registration-confirmation-${details.idempotencyKey}`,
    },
  );

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  console.log(
    `Registration confirmation email sent to ${details.athleteEmail} (id: ${result.data?.id ?? "unknown"})`,
  );
}

export type GuestRegistrationVerificationDetails = {
  email: string;
  code: string;
  eventTitle: string;
  idempotencyKey: string;
};

export function buildGuestRegistrationVerificationEmail(details: GuestRegistrationVerificationDetails) {
  return {
    subject: `Your Startline verification code: ${details.code}`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:32px;background:#141414;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#1D1D1D;border:1px solid #2A2A2A;border-radius:12px;">
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#B3E153;">Verify your email</p>
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#F5F7FA;">Enter this code to continue registration</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#8A8F98;">
                  Use this code to confirm your email address for <strong style="color:#F5F7FA;">${escapeHtml(details.eventTitle)}</strong>.
                  It expires in 15 minutes.
                </p>
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8A8F98;">Verification code</p>
                <p style="margin:0 0 24px;font-size:36px;line-height:1;font-weight:800;letter-spacing:0.35em;color:#B3E153;font-family:monospace;">${escapeHtml(details.code)}</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8A8F98;">
                  If you did not start an event registration, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}

export async function sendGuestRegistrationVerificationEmail(details: GuestRegistrationVerificationDetails) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not configured — skipping guest verification email");
    return;
  }

  const { subject, html } = buildGuestRegistrationVerificationEmail(details);

  const result = await resend.emails.send(
    {
      from: getEmailFrom(),
      to: details.email,
      subject,
      html,
    },
    {
      idempotencyKey: `guest-registration-verify-${details.idempotencyKey}`,
    },
  );

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// ── Email verification ────────────────────────────────────────────────────────
export async function sendVerificationEmail(email: string, token: string) {
  const resend = getResend();
  if (!resend) return;
  const link = `${SITE}/organiser/verify-email?token=${token}`;
  await resend.emails.send({
    from:    getEmailFrom(),
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
    from:    getEmailFrom(),
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
    from:    getEmailFrom(),
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
