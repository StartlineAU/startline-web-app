import { createHash, randomInt } from "crypto";
import prisma from "@/lib/prisma";
import { sendGuestRegistrationVerificationEmail } from "@/lib/email";
import { normalizeGuestEmail } from "@/lib/registration-form";

export const GUEST_EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
export const GUEST_EMAIL_VERIFICATION_VALID_MS = 2 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

export function generateVerificationCode(): string {
  return String(randomInt(100000, 1000000));
}

function getGuestEmailVerificationSecret(): string {
  const secret = process.env.GUEST_EMAIL_VERIFICATION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("GUEST_EMAIL_VERIFICATION_SECRET is not configured.");
  }
  return "dev-guest-email-secret";
}

export function hashVerificationCode(code: string, email: string, eventId: string): string {
  const secret = getGuestEmailVerificationSecret();
  return createHash("sha256")
    .update(`${code.trim()}:${normalizeGuestEmail(email)}:${eventId}:${secret}`)
    .digest("hex");
}

export async function sendGuestEmailVerificationCode(
  email: string,
  eventId: string,
  eventTitle: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeGuestEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const recent = await prisma.guestEmailVerification.findFirst({
    where: { email: normalized, eventId },
    orderBy: { lastSentAt: "desc" },
  });
  if (recent && Date.now() - recent.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait a minute before requesting another code." };
  }

  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(code, normalized, eventId);
  const expiresAt = new Date(Date.now() + GUEST_EMAIL_CODE_TTL_MS);

  await prisma.guestEmailVerification.create({
    data: {
      email: normalized,
      eventId,
      codeHash,
      expiresAt,
      lastSentAt: new Date(),
    },
  });

  try {
    await sendGuestRegistrationVerificationEmail({
      email: normalized,
      code,
      eventTitle,
      idempotencyKey: `${eventId}:${normalized}:${Date.now()}`,
    });
  } catch (err) {
    console.error("Failed to send guest verification email:", err);
    return { ok: false, error: "Could not send verification email. Please try again." };
  }

  return { ok: true };
}

export async function confirmGuestEmailVerificationCode(
  email: string,
  eventId: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeGuestEmail(email);
  const trimmedCode = code.trim();

  if (!/^\d{6}$/.test(trimmedCode)) {
    return { ok: false, error: "Enter the 6-digit code from your email." };
  }

  const record = await prisma.guestEmailVerification.findFirst({
    where: { email: normalized, eventId, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { ok: false, error: "No active verification code. Request a new one." };
  }
  if (record.expiresAt < new Date()) {
    return { ok: false, error: "That code has expired. Request a new one." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Request a new code." };
  }

  const expectedHash = hashVerificationCode(trimmedCode, normalized, eventId);
  if (expectedHash !== record.codeHash) {
    await prisma.guestEmailVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "That code is incorrect. Please check and try again." };
  }

  await prisma.guestEmailVerification.update({
    where: { id: record.id },
    data: { verifiedAt: new Date() },
  });

  return { ok: true };
}

export async function isGuestEmailVerifiedForEvent(email: string, eventId: string): Promise<boolean> {
  const normalized = normalizeGuestEmail(email);
  const record = await prisma.guestEmailVerification.findFirst({
    where: {
      email: normalized,
      eventId,
      verifiedAt: { not: null },
    },
    orderBy: { verifiedAt: "desc" },
  });

  if (!record?.verifiedAt) return false;
  return Date.now() - record.verifiedAt.getTime() < GUEST_EMAIL_VERIFICATION_VALID_MS;
}

export async function assertGuestEmailsVerifiedForCheckout(
  emails: string[],
  eventId: string
): Promise<string | null> {
  for (const email of emails) {
    const verified = await isGuestEmailVerifiedForEvent(email, eventId);
    if (!verified) {
      return `Email ${email} has not been verified.`;
    }
  }
  return null;
}
