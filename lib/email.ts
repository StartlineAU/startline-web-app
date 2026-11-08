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

// ── Event changed (athlete) ───────────────────────────────────────────────────
// The organiser moved the date, time or venue, or changed the type of an event
// this athlete had already entered. There is no automatic refund: anyone
// affected is told to raise it through Support, where the organiser and
// Startline review it.
export interface EventChangeLine {
  label: string;
  from: string;
  to: string;
}

export interface EventChangedEmailData {
  athleteName?: string | null;
  eventId: string;
  eventTitle: string;
  organiserName: string;
  changes: EventChangeLine[];
}

function changeRowsHtml(changes: EventChangeLine[]): string {
  return changes
    .map(
      (c) => `
        <tr>
          <td style="padding:6px 8px 6px 0;font-size:13px;color:#555;vertical-align:top;white-space:nowrap">${escapeHtml(c.label)}</td>
          <td style="padding:6px 8px;font-size:13px;color:#555;text-decoration:line-through;vertical-align:top">${escapeHtml(c.from)}</td>
          <td style="padding:6px 0 6px 8px;font-size:14px;font-weight:700;vertical-align:top">${escapeHtml(c.to)}</td>
        </tr>`,
    )
    .join("");
}

export function buildEventChangedEmail(data: EventChangedEmailData, { siteUrl = SITE }: { siteUrl?: string } = {}) {
  const greeting = data.athleteName ? `Hi ${escapeHtml(data.athleteName.split(" ")[0])},` : "Hi,";
  return {
    subject: `${data.eventTitle} has changed`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7AA820">Event changed</p>
        <h2 style="margin:4px 0 12px">${escapeHtml(data.eventTitle)}</h2>
        <p style="font-size:15px;line-height:1.6">${greeting}</p>
        <p style="font-size:15px;line-height:1.6">
          <strong>${escapeHtml(data.organiserName)}</strong> has changed the details of an event you entered:
        </p>
        <table style="border-collapse:collapse;margin:8px 0 16px">${changeRowsHtml(data.changes)}</table>
        <p style="font-size:15px;line-height:1.6">
          Your entry still stands and you don't need to do anything to keep it.
          If the new details don't work for you, ask for a refund through Support and
          Startline will review it with the organiser.
        </p>
        <a href="${siteUrl}/support" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Ask for a refund
        </a>
      </div>
    `,
  };
}

export async function sendEventChangedEmail(to: string, data: EventChangedEmailData) {
  const resend = getResend();
  if (!resend) return;
  const { subject, html } = buildEventChangedEmail(data);
  await resend.emails.send({ from: getEmailFrom(), to, subject, html });
}

// ── Edit of a published event waiting for review (admins) ─────────────────────
// An unverified organiser cannot change a live listing in place. Admins get
// this while the approved version stays on sale.
export interface EventEditPendingReviewEmailData {
  eventId: string;
  eventTitle: string;
  organiserName: string;
  changes: EventChangeLine[];
}

export function buildEventEditPendingReviewEmail(
  data: EventEditPendingReviewEmailData,
  { environment = process.env.ENV, siteUrl = SITE }: { environment?: string; siteUrl?: string } = {},
) {
  const tag = environment === "staging" ? "[Staging] " : "";
  const eventUrl = adminUrl(`/admin/events/${encodeURIComponent(data.eventId)}`, siteUrl);
  return {
    subject: `${tag}Event edit to review: ${data.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7AA820">${tag}Needs review</p>
        <h2 style="margin:4px 0 12px">${escapeHtml(data.eventTitle)}</h2>
        <p style="font-size:15px;line-height:1.6">
          <strong>${escapeHtml(data.organiserName)}</strong> is not verified and edited this published event.
          The listing athletes see is unchanged until you approve it.
        </p>
        <table style="border-collapse:collapse;margin:8px 0 16px">${changeRowsHtml(data.changes)}</table>
        <a href="${eventUrl}" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Review the edit
        </a>
      </div>
    `,
  };
}

export async function sendEventEditPendingReviewEmails(
  recipients: string[],
  data: EventEditPendingReviewEmailData,
) {
  await sendToEachAdmin(recipients, buildEventEditPendingReviewEmail(data), "event edit review notification");
}

export async function sendEventEditDecisionEmail(
  to: string,
  data: { eventTitle: string; approved: boolean; reason?: string; eventUrl: string },
) {
  const resend = getResend();
  if (!resend) return;
  const { subject, html } = buildEventEditDecisionEmail(data);
  await resend.emails.send({ from: getEmailFrom(), to, subject, html });
}

export function buildEventEditDecisionEmail(data: {
  eventTitle: string;
  approved: boolean;
  reason?: string;
  eventUrl: string;
}) {
  return {
    subject: data.approved
      ? `Your changes to ${data.eventTitle} are live`
      : `Changes to ${data.eventTitle} were not approved`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <h2 style="margin:4px 0 12px">${escapeHtml(data.eventTitle)}</h2>
        <p style="font-size:15px;line-height:1.6">
          ${data.approved
            ? "Startline approved your changes. They are now the live listing. The event was not taken off sale while they waited."
            : `Startline did not approve your changes, so the live listing is unchanged.${data.reason ? ` Reason: ${escapeHtml(data.reason)}` : ""}`}
        </p>
        <a href="${data.eventUrl}" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Open the event
        </a>
      </div>
    `,
  };
}

// ── Refund request (organiser and admins) ─────────────────────────────────────
// A refund is reviewed from a support ticket: the organisation whose event it
// is, and Startline. Nothing is issued from the form.
export interface RefundRequestEmailData {
  ticketId: string;
  athleteName: string;
  athleteEmail: string;
  eventTitle: string;
  eventDate: string | null;
  reason: string;
  eventUrl: string;
}

export function buildRefundRequestEmail(data: RefundRequestEmailData) {
  return {
    subject: `Refund request: ${data.eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#141414">
        <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7AA820">Refund requested</p>
        <h2 style="margin:4px 0 12px">${escapeHtml(data.eventTitle)}</h2>
        <p style="font-size:15px;line-height:1.6">
          <strong>${escapeHtml(data.athleteName)}</strong>
          (${escapeHtml(data.athleteEmail)}) asked for a refund${data.eventDate ? ` for the event on ${escapeHtml(data.eventDate)}` : ""}.
        </p>
        <p style="font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(data.reason)}</p>
        <a href="${data.eventUrl}" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Review the request
        </a>
        <p style="font-size:13px;line-height:1.6;color:#555">Ticket ${escapeHtml(data.ticketId)}.</p>
      </div>
    `,
  };
}

export async function sendRefundRequestEmail(to: string, data: RefundRequestEmailData) {
  const resend = getResend();
  if (!resend) return;
  const { subject, html } = buildRefundRequestEmail(data);
  await resend.emails.send({ from: getEmailFrom(), to, subject, html });
}
