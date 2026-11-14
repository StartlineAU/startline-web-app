import { Resend } from "resend";
import { renderEmail, type RenderedEmail } from "@/emails/render";
import { RegistrationConfirmationEmail } from "@/emails/registration-confirmation";
import { EventApprovedEmail } from "@/emails/event-approved";
import { EventRejectedEmail } from "@/emails/event-rejected";
import { EventSubmittedForReviewEmail } from "@/emails/event-submitted-for-review";
import { ReviewReportedEmail } from "@/emails/review-reported";
import { WaveUpdateEmail } from "@/emails/wave-update";
import { FollowedOrganiserEventEmail } from "@/emails/followed-organiser-event";
import { EventChangedEmail } from "@/emails/event-changed";
import { EventEditPendingReviewEmail } from "@/emails/event-edit-pending-review";
import { EventEditDecisionEmail } from "@/emails/event-edit-decision";
import { RefundRequestEmail } from "@/emails/refund-request";
import { formatEmailDate, formatEmailTime } from "@/lib/email-format";
import { formatEventPlace } from "@/lib/event-place";
import { adminUrl, organiserUrl } from "@/lib/portal-domains";

// Every email is a React Email template under emails/, rendered to HTML plus
// a plain-text part. Templates escape whatever they are given, so nothing here
// builds HTML by hand.

const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const FROM = "Startline <events@startlineau.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function getEmailFrom(): string {
  return process.env.RESEND_FROM ?? FROM;
}

export interface BuiltEmail extends RenderedEmail {
  subject: string;
}

const firstNameGreeting = (name?: string | null) => {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hi ${first},` : "Hi,";
};

async function sendOne(to: string | string[], { subject, html, text }: BuiltEmail) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({ from: getEmailFrom(), to, subject, html, text });
}

// ── Registration Confirmation ─────────────────────────────────────────────────
export interface RegistrationEmailData {
  eventId: string;
  eventName: string;
  eventSeries?: string;
  /** `yyyy-mm-dd` as stored, or already formatted. */
  eventDate: string;
  /** `HH:mm` as stored, or already formatted. */
  startTime: string;
  category: string;
  /** Display-ready; see formatEventPlace. */
  location: string;
  bib?: string;
  registrationFee: string;
  serviceFee: string;
  total: string;
  userEmail: string;
  calendarUrl?: string | null;
}

export async function buildRegistrationConfirmationEmail(data: RegistrationEmailData): Promise<BuiltEmail> {
  const rendered = await renderEmail(
    RegistrationConfirmationEmail({
      ...data,
      eventDate: formatEmailDate(data.eventDate),
      startTime: formatEmailTime(data.startTime),
    }),
  );
  return { subject: `You're registered for ${data.eventName}`, ...rendered };
}

export async function sendRegistrationConfirmationEmail(to: string, data: RegistrationEmailData) {
  if (!getResend()) return;
  await sendOne(to, await buildRegistrationConfirmationEmail(data));
}

// ── Event approved / rejected (organiser) ─────────────────────────────────────
// `to` is every recipient on one message. They all belong to the same
// organisation, so seeing each other's address is expected.
export async function buildEventApprovedEmail(eventTitle: string, { siteUrl = SITE } = {}): Promise<BuiltEmail> {
  const rendered = await renderEmail(
    EventApprovedEmail({ eventTitle, dashboardUrl: organiserUrl("/organiser/dashboard", siteUrl) }),
  );
  return { subject: `Your event "${eventTitle}" is now live`, ...rendered };
}

export async function sendEventApprovedEmail(email: string | string[], eventTitle: string) {
  if (!getResend()) return;
  await sendOne(email, await buildEventApprovedEmail(eventTitle));
}

export async function buildEventRejectedEmail(
  eventTitle: string,
  reason?: string,
  { siteUrl = SITE } = {},
): Promise<BuiltEmail> {
  const rendered = await renderEmail(
    EventRejectedEmail({ eventTitle, reason, dashboardUrl: organiserUrl("/organiser/dashboard", siteUrl) }),
  );
  return { subject: `Update on your event "${eventTitle}"`, ...rendered };
}

export async function sendEventRejectedEmail(email: string | string[], eventTitle: string, reason?: string) {
  if (!getResend()) return;
  await sendOne(email, await buildEventRejectedEmail(eventTitle, reason));
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

interface AdminEmailOptions {
  environment?: string;
  siteUrl?: string;
}

// Staging shares the Resend key, so without the tag a test submission there
// reads exactly like a real organiser waiting on prod.
const stagingTag = (environment: string | undefined) => (environment === "staging" ? "[Staging] " : "");

export async function buildEventSubmittedForReviewEmail(
  data: EventSubmittedForReviewEmailData,
  { environment = process.env.ENV, siteUrl = SITE }: AdminEmailOptions = {},
): Promise<BuiltEmail> {
  const tag = stagingTag(environment);
  const rendered = await renderEmail(
    EventSubmittedForReviewEmail({
      tag,
      eventTitle: data.eventTitle,
      organiserName: data.organiserName,
      eventDate: formatEmailDate(data.eventDate),
      location: formatEventPlace({ city: data.city, state: data.state }) || null,
      discipline: data.discipline,
      blocker: data.blocker,
      previewUrl: adminUrl(`/admin/events/${encodeURIComponent(data.eventId)}`, siteUrl),
      queueUrl: adminUrl("/admin/events?status=PENDING", siteUrl),
    }),
  );
  return { subject: `${tag}New event to review: ${data.eventTitle}`, ...rendered };
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
  if (recipients.length === 0) return;
  await sendToEachAdmin(recipients, await buildEventSubmittedForReviewEmail(data), "admin review notification");
}

async function sendToEachAdmin(recipients: string[], { subject, html, text }: BuiltEmail, what: string) {
  if (recipients.length === 0) return;
  const resend = getResend();
  if (!resend) {
    console.warn(`RESEND_API_KEY not configured — skipping ${what}`);
    return;
  }
  const from = getEmailFrom();
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    const result = await resend.batch.send(chunk.map((to) => ({ from, to, subject, html, text })));
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

export async function buildReviewReportedEmail(
  data: ReviewReportedEmailData,
  { environment = process.env.ENV, siteUrl = SITE }: AdminEmailOptions = {},
): Promise<BuiltEmail> {
  const tag = stagingTag(environment);
  const count = data.reportCount > 1 ? ` (${data.reportCount} reports)` : "";
  const rendered = await renderEmail(
    ReviewReportedEmail({
      tag,
      count,
      reviewTitle: data.reviewTitle,
      reviewerName: data.reviewerName,
      about: [data.organiserName, data.eventTitle].filter(Boolean).join(" · "),
      excerpt: data.reviewBody.length > 300 ? `${data.reviewBody.slice(0, 300)}…` : data.reviewBody,
      reason: data.reason,
      queueUrl: adminUrl("/admin/reviews?filter=reported", siteUrl),
    }),
  );
  return { subject: `${tag}Review reported: ${data.reviewTitle}${count}`, ...rendered };
}

export async function sendReviewReportedEmails(recipients: string[], data: ReviewReportedEmailData) {
  if (recipients.length === 0) return;
  await sendToEachAdmin(recipients, await buildReviewReportedEmail(data), "review report notification");
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

export async function buildWaveUpdateEmail(
  to: string,
  data: WaveUpdateEmailData,
  { siteUrl = SITE } = {},
): Promise<BuiltEmail> {
  const rendered = await renderEmail(
    WaveUpdateEmail({
      greeting: firstNameGreeting(data.athleteName),
      eventTitle: data.eventTitle,
      waveLabel: data.waveLabel,
      waveTime: formatEmailTime(data.waveTime),
      eventDate: formatEmailDate(data.eventDate),
      activityUrl: `${siteUrl}/activity`,
      sentTo: to,
    }),
  );
  return { subject: `Your start wave for ${data.eventTitle}`, ...rendered };
}

export async function sendWaveUpdateEmail(to: string, data: WaveUpdateEmailData) {
  if (!getResend()) return;
  await sendOne(to, await buildWaveUpdateEmail(to, data));
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

export async function buildFollowedOrganiserEventEmail(
  to: string,
  data: FollowedOrganiserEventEmailData,
  { siteUrl = SITE } = {},
): Promise<BuiltEmail> {
  const rendered = await renderEmail(
    FollowedOrganiserEventEmail({
      greeting: firstNameGreeting(data.followerName),
      organiserName: data.organiserName,
      eventTitle: data.eventTitle,
      eventDate: formatEmailDate(data.eventDate),
      city: data.city,
      eventUrl: `${siteUrl}/events/${encodeURIComponent(data.eventId)}`,
      sentTo: to,
    }),
  );
  return { subject: `${data.organiserName} posted ${data.eventTitle}`, ...rendered };
}

export async function sendFollowedOrganiserEventEmail(to: string, data: FollowedOrganiserEventEmailData) {
  if (!getResend()) return;
  await sendOne(to, await buildFollowedOrganiserEventEmail(to, data));
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

export async function buildEventChangedEmail(
  data: EventChangedEmailData,
  { siteUrl = SITE }: { siteUrl?: string } = {},
): Promise<BuiltEmail> {
  const rendered = await renderEmail(
    EventChangedEmail({
      greeting: firstNameGreeting(data.athleteName),
      eventTitle: data.eventTitle,
      organiserName: data.organiserName,
      changes: data.changes,
      supportUrl: `${siteUrl}/support`,
    }),
  );
  return { subject: `${data.eventTitle} has changed`, ...rendered };
}

export async function sendEventChangedEmail(to: string, data: EventChangedEmailData) {
  if (!getResend()) return;
  await sendOne(to, await buildEventChangedEmail(data));
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

export async function buildEventEditPendingReviewEmail(
  data: EventEditPendingReviewEmailData,
  { environment = process.env.ENV, siteUrl = SITE }: AdminEmailOptions = {},
): Promise<BuiltEmail> {
  const tag = stagingTag(environment);
  const rendered = await renderEmail(
    EventEditPendingReviewEmail({
      tag,
      eventTitle: data.eventTitle,
      organiserName: data.organiserName,
      changes: data.changes,
      eventUrl: adminUrl(`/admin/events/${encodeURIComponent(data.eventId)}`, siteUrl),
    }),
  );
  return { subject: `${tag}Event edit to review: ${data.eventTitle}`, ...rendered };
}

export async function sendEventEditPendingReviewEmails(
  recipients: string[],
  data: EventEditPendingReviewEmailData,
) {
  if (recipients.length === 0) return;
  await sendToEachAdmin(recipients, await buildEventEditPendingReviewEmail(data), "event edit review notification");
}

// ── Edit decision (organiser) ─────────────────────────────────────────────────
export interface EventEditDecisionEmailData {
  eventTitle: string;
  approved: boolean;
  reason?: string;
  eventUrl: string;
}

export async function buildEventEditDecisionEmail(data: EventEditDecisionEmailData): Promise<BuiltEmail> {
  const rendered = await renderEmail(EventEditDecisionEmail(data));
  return {
    subject: data.approved
      ? `Your changes to ${data.eventTitle} are live`
      : `Changes to ${data.eventTitle} were not approved`,
    ...rendered,
  };
}

export async function sendEventEditDecisionEmail(to: string, data: EventEditDecisionEmailData) {
  if (!getResend()) return;
  await sendOne(to, await buildEventEditDecisionEmail(data));
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

export async function buildRefundRequestEmail(data: RefundRequestEmailData): Promise<BuiltEmail> {
  const rendered = await renderEmail(
    RefundRequestEmail({ ...data, eventDate: formatEmailDate(data.eventDate) }),
  );
  return { subject: `Refund request: ${data.eventTitle}`, ...rendered };
}

export async function sendRefundRequestEmail(to: string, data: RefundRequestEmailData) {
  if (!getResend()) return;
  await sendOne(to, await buildRefundRequestEmail(data));
}
