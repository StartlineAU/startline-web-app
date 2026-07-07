import { Resend } from 'resend'
import { render } from '@react-email/render'
import { OtpVerificationEmail } from '@/emails/otp-verification'
import { PasswordResetEmail } from '@/emails/password-reset'
import { RegistrationConfirmationEmail } from '@/emails/registration-confirmation'
import { RaceDayUpdateEmail } from '@/emails/race-day-update'
import { EventCancelledEmail } from '@/emails/event-cancelled'
import { WaitlistSpotEmail } from '@/emails/waitlist-spot'

const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = 'Startline <events@startlineau.com>'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// ── OTP Verification ──────────────────────────────────────────────────────────
export async function sendOtpEmail(to: string, otpCode: string, expiryMinutes = 10) {
  const resend = getResend()
  if (!resend) return
  const html = await render(OtpVerificationEmail({ otpCode, expiryMinutes }))
  await resend.emails.send({
    from:    FROM,
    to,
    subject: `${otpCode} — Your Startline verification code`,
    html,
  })
}

// ── Password Reset ────────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, resetUrl: string, expiryHours = 24) {
  const resend = getResend()
  if (!resend) return
  const html = await render(PasswordResetEmail({ resetUrl, expiryHours }))
  await resend.emails.send({
    from:    FROM,
    to,
    subject: 'Reset your Startline password',
    html,
  })
}

// ── Registration Confirmation ─────────────────────────────────────────────────
export interface RegistrationEmailData {
  eventName: string
  eventSeries?: string
  eventDate: string
  startTime: string
  category: string
  location: string
  bib?: string
  registrationFee: string
  serviceFee: string
  total: string
  userEmail: string
}

export async function sendRegistrationConfirmationEmail(to: string, data: RegistrationEmailData) {
  const resend = getResend()
  if (!resend) return
  const html = await render(RegistrationConfirmationEmail(data))
  await resend.emails.send({
    from:    FROM,
    to,
    subject: `You're registered for ${data.eventName}`,
    html,
  })
}

// ── Race Day Update ───────────────────────────────────────────────────────────
export interface RaceDayUpdateData {
  eventName: string
  eventDate: string
  fieldChanged: string
  oldValue: string
  newValue: string
  organiserNote: string
}

export async function sendRaceDayUpdateEmail(to: string, data: RaceDayUpdateData) {
  const resend = getResend()
  if (!resend) return
  const html = await render(RaceDayUpdateEmail(data))
  await resend.emails.send({
    from:    FROM,
    to,
    subject: `Important update: ${data.eventName}`,
    html,
  })
}

// ── Event Cancelled ───────────────────────────────────────────────────────────
export interface EventCancelledData {
  eventName: string
  eventDate: string
  location: string
  registrationRefund: string
  serviceFee: string
  refundTotal: string
}

export async function sendEventCancelledEmail(to: string, data: EventCancelledData) {
  const resend = getResend()
  if (!resend) return
  const html = await render(EventCancelledEmail(data))
  await resend.emails.send({
    from:    FROM,
    to,
    subject: `${data.eventName} has been cancelled`,
    html,
  })
}

// ── Waitlist Spot Available ───────────────────────────────────────────────────
export interface WaitlistSpotData {
  eventName: string
  category: string
  eventDate: string
  entryFee: string
  location: string
  offerExpiryDatetime: string
  confirmUrl: string
}

export async function sendWaitlistSpotEmail(to: string, data: WaitlistSpotData) {
  const resend = getResend()
  if (!resend) return
  const html = await render(WaitlistSpotEmail(data))
  await resend.emails.send({
    from:    FROM,
    to,
    subject: `Your spot for ${data.eventName} is ready`,
    html,
  })
}

// ── Email verification (organiser account) ────────────────────────────────────
export async function sendVerificationEmail(email: string, token: string) {
  const resend = getResend()
  if (!resend) return
  const link = `${SITE}/organiser/verify-email?token=${token}`
  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: 'Verify your Startline organiser account',
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
  })
}

// ── Event approved ────────────────────────────────────────────────────────────
export async function sendEventApprovedEmail(email: string, eventTitle: string) {
  const resend = getResend()
  if (!resend) return
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
  })
}

// ── Event rejected ────────────────────────────────────────────────────────────
export async function sendEventRejectedEmail(email: string, eventTitle: string, reason?: string) {
  const resend = getResend()
  if (!resend) return
  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: `Update on your event "${eventTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#141414">Event update</h2>
        <p>Your event <strong>${eventTitle}</strong> was not approved.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>Please log into your dashboard to make the required changes and resubmit.</p>
        <a href="${SITE}/organiser/dashboard" style="display:inline-block;margin:16px 0;background:#B3E153;color:#141414;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
          Go to dashboard
        </a>
      </div>
    `,
  })
}
