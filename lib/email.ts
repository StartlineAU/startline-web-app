import { Resend } from "resend";
import { render } from "@react-email/render";
import { RegistrationConfirmationEmail } from "@/emails/registration-confirmation";
import { adminUrl, organiserUrl } from "@/lib/portal-domains";

const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const FROM = "Startline <events@startlineau.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function getEmailFrom(): string {
  return process.env.RESEND_FROM ?? FROM;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Registration Confirmation ─────────────────────────────────────────────────
export interface RegistrationEmailData {
  eventName: string;
  eventSeries?: string;
  eventDate: string;
  startTime: string;
  category: string;
  location: string;
  bib?: string;
  registrationFee: string;
  serviceFee: string;
  total: string;
  userEmail: string;
}

export async function sendRegistrationConfirmationEmail(to: string, data: RegistrationEmailData) {
  const resend = getResend();
  if (!resend) return;
  const html = await render(RegistrationConfirmationEmail(data));
  await resend.emails.send({
    from: FROM,
    to,
    subject: `You're registered for ${data.eventName}`,
    html,
  });
}

// ── Event approved ────────────────────────────────────────────────────────────
// `to` is every recipient on one message. They all belong to the same
// organisation, so seeing each other's address is expected.
export async function sendEventApprovedEmail(email: string | string[], eventTitle: string) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: getEmailFrom(),
    to: email,
    subject: `Your event "${eventTitle}" is now live`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#B3E153">Event approved!</h2>
        <p>Your event <strong>${eventTitle}</strong> has been approved and is now live on Startline.</p>
        <a href="${organiserUrl("/organiser/dashboard", SITE)}" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          View dashboard
        </a>
      </div>
    `,
  });
}

// ── Event submitted for review (admins) ───────────────────────────────────────
export interface EventSubmittedForReviewEmailData {
  eventId: string;
  eventTitle: string;
  organiserName: string;
  eventDate?: string | null;
  city?: string | null;
  state?: string | null;
  discipline?: string | null;
  /** From approvalBlocker(): why approve will be unavailable, if it will be. */
  blocker?: string | null;
}

export function buildEventSubmittedForReviewEmail(
  data: EventSubmittedForReviewEmailData,
  { environment = process.env.ENV, siteUrl = SITE }: { environment?: string; siteUrl?: string } = {},
) {
  // Staging shares the Resend key, so without the tag a test submission there
  // reads exactly like a real organiser waiting on prod.
  const tag = environment === "staging" ? "[Staging] " : "";
  const previewUrl = adminUrl(`/admin/events/${encodeURIComponent(data.eventId)}`, siteUrl);
  const queueUrl = adminUrl("/admin/events?status=PENDING", siteUrl);
  const where = [data.city, data.state?.toUpperCase()].filter(Boolean).join(", ");
  const meta = [data.eventDate, where, data.discipline].filter(Boolean).join(" · ");

  return {
    subject: `${tag}New event to review: ${data.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7AA820">${tag}Needs review</p>
        <h2 style="margin:4px 0 12px">${escapeHtml(data.eventTitle)}</h2>
        <p style="font-size:15px;line-height:1.6">
          <strong>${escapeHtml(data.organiserName)}</strong> has listed a new event and it is waiting for approval.
        </p>
        ${meta ? `<p style="font-size:14px;line-height:1.6;color:#555">${escapeHtml(meta)}</p>` : ""}
        ${data.blocker
          ? `<p style="font-size:14px;line-height:1.6;color:#8A5A00;background:#FFF4D6;border-radius:6px;padding:10px 12px">
               Cannot be approved yet: ${escapeHtml(data.blocker)}.
             </p>`
          : ""}
        <a href="${previewUrl}" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Preview and review
        </a>
        <p style="font-size:13px;line-height:1.6;color:#555">
          Or open the <a href="${queueUrl}" style="color:#141414">pending queue</a>.
        </p>
      </div>
    `,
  };
}

/**
 * One email per admin rather than one to all of them, so each lands as a
 * personal notification. Resend's batch endpoint takes up to 100 per call and
 * keeps a burst of sends clear of its per-second rate limit.
 */
export async function sendEventSubmittedForReviewEmails(
  recipients: string[],
  data: EventSubmittedForReviewEmailData,
) {
  await sendToEachAdmin(recipients, buildEventSubmittedForReviewEmail(data), "admin review notification");
}

async function sendToEachAdmin(
  recipients: string[],
  { subject, html }: { subject: string; html: string },
  what: string,
) {
  if (recipients.length === 0) return;
  const resend = getResend();
  if (!resend) {
    console.warn(`RESEND_API_KEY not configured — skipping ${what}`);
    return;
  }
  const from = getEmailFrom();
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    const result = await resend.batch.send(chunk.map((to) => ({ from, to, subject, html })));
    if (result.error) throw new Error(`Resend error: ${result.error.message}`);
  }
}

// ── Review reported (admins) ──────────────────────────────────────────────────
export interface ReviewReportedEmailData {
  reviewTitle: string;
  reviewBody: string;
  reviewerName: string;
  organiserName: string;
  eventTitle?: string | null;
  reason: string;
  /** Reports on this review so far, including this one. */
  reportCount: number;
}

export function buildReviewReportedEmail(
  data: ReviewReportedEmailData,
  { environment = process.env.ENV, siteUrl = SITE }: { environment?: string; siteUrl?: string } = {},
) {
  const tag = environment === "staging" ? "[Staging] " : "";
  const queueUrl = adminUrl("/admin/reviews?filter=reported", siteUrl);
  const about = [data.organiserName, data.eventTitle].filter(Boolean).join(" · ");
  const excerpt = data.reviewBody.length > 300 ? `${data.reviewBody.slice(0, 300)}…` : data.reviewBody;
  const count = data.reportCount > 1 ? ` (${data.reportCount} reports)` : "";

  return {
    subject: `${tag}Review reported: ${data.reviewTitle}${count}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#B42318">${tag}Review reported${escapeHtml(count)}</p>
        <h2 style="margin:4px 0 12px">${escapeHtml(data.reviewTitle)}</h2>
        <p style="font-size:14px;line-height:1.6;color:#555">By ${escapeHtml(data.reviewerName)} · ${escapeHtml(about)}</p>
        <p style="font-size:14px;line-height:1.6;background:#F4F4F4;border-radius:6px;padding:10px 12px">${escapeHtml(excerpt)}</p>
        <p style="font-size:15px;line-height:1.6"><strong>Reason:</strong> ${escapeHtml(data.reason)}</p>
        <a href="${queueUrl}" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Open reported reviews
        </a>
      </div>
    `,
  };
}

export async function sendReviewReportedEmails(recipients: string[], data: ReviewReportedEmailData) {
  await sendToEachAdmin(recipients, buildReviewReportedEmail(data), "review report notification");
}

// ── Wave update (athlete) ─────────────────────────────────────────────────────
export interface WaveUpdateEmailData {
  athleteName?: string | null;
  eventTitle: string;
  eventId: string;
  waveLabel: string;
  waveTime?: string | null; // start time for the wave, if known
  eventDate?: string | null;
}

export async function sendWaveUpdateEmail(to: string, data: WaveUpdateEmailData) {
  const resend = getResend();
  if (!resend) return;
  const greeting = data.athleteName ? `Hi ${escapeHtml(data.athleteName.split(" ")[0])},` : "Hi,";
  const when = [data.eventDate, data.waveTime].filter(Boolean).join(" · ");
  await resend.emails.send({
    from: getEmailFrom(),
    to,
    subject: `Your start wave for ${data.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7AA820">Start wave update</p>
        <h2 style="margin:4px 0 12px">You're in the ${escapeHtml(data.waveLabel)} wave</h2>
        <p style="font-size:15px;line-height:1.6">${greeting}</p>
        <p style="font-size:15px;line-height:1.6">
          Your start wave for <strong>${escapeHtml(data.eventTitle)}</strong> is
          <strong>${escapeHtml(data.waveLabel)}</strong>${when ? `, ${escapeHtml(when)}` : ""}.
        </p>
        <p style="font-size:14px;line-height:1.6;color:#555">
          Please arrive in good time for your wave. If anything changes, we'll let you know.
        </p>
        <a href="${SITE}/activity" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          View your registration
        </a>
      </div>
    `,
  });
}

// ── Followed organiser event live ─────────────────────────────────────────────
export interface FollowedOrganiserEventEmailData {
  followerName?: string | null;
  organiserName: string;
  eventTitle: string;
  eventId: string;
  eventDate?: string | null;
  city?: string | null;
}

export async function sendFollowedOrganiserEventEmail(
  to: string,
  data: FollowedOrganiserEventEmailData,
) {
  const resend = getResend();
  if (!resend) return;
  const greeting = data.followerName
    ? `Hi ${escapeHtml(data.followerName.split(" ")[0])},`
    : "Hi,";
  const meta = [data.eventDate, data.city].filter(Boolean).join(" · ");
  await resend.emails.send({
    from: getEmailFrom(),
    to,
    subject: `${data.organiserName} posted ${data.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7AA820">New event</p>
        <h2 style="margin:4px 0 12px">${escapeHtml(data.organiserName)} just went live</h2>
        <p style="font-size:15px;line-height:1.6">${greeting}</p>
        <p style="font-size:15px;line-height:1.6">
          <strong>${escapeHtml(data.organiserName)}</strong> posted
          <strong>${escapeHtml(data.eventTitle)}</strong>${meta ? ` — ${escapeHtml(meta)}` : ""}.
        </p>
        <a href="${SITE}/events/${encodeURIComponent(data.eventId)}" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          View event
        </a>
      </div>
    `,
  });
}

// ── Event rejected ────────────────────────────────────────────────────────────
export async function sendEventRejectedEmail(email: string | string[], eventTitle: string, reason?: string) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: getEmailFrom(),
    to: email,
    subject: `Update on your event "${eventTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#141414">Event update</h2>
        <p>Your event <strong>${eventTitle}</strong> was not approved.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>Please log into your dashboard to make the required changes and resubmit.</p>
        <a href="${organiserUrl("/organiser/dashboard", SITE)}" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Go to dashboard
        </a>
      </div>
    `,
  });
}
