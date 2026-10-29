import { randomUUID } from "crypto";
import QRCode from "qrcode";
import prisma from "@/lib/prisma";

const FALLBACK_SITE_URL = "https://startlineau.com";

/** The public URL an athlete lands on after scanning an event's check-in QR. */
export function checkInUrl(eventId: string, checkInCode: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "");
  return `${baseUrl}/checkin/${eventId}/${checkInCode}`;
}

/**
 * Return the event's persisted check-in code, creating it on first use.
 *
 * `updateMany` rather than `update` keeps two simultaneous "Check-in QR" taps
 * from overwriting each other: the loser re-reads the code the winner wrote.
 */
export async function ensureCheckInCode(event: {
  id: string;
  checkInCode: string | null;
}): Promise<string> {
  if (event.checkInCode) return event.checkInCode;

  const checkInCode = randomUUID();
  const claimed = await prisma.event.updateMany({
    where: { id: event.id, checkInCode: null },
    data: { checkInCode },
  });
  if (claimed.count === 1) return checkInCode;

  const current = await prisma.event.findUnique({
    where: { id: event.id },
    select: { checkInCode: true },
  });
  return current?.checkInCode ?? checkInCode;
}

/** A black-on-white QR with a one-module quiet zone; safe to print. */
export async function buildCheckInQr(url: string, width = 512): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width });
}
