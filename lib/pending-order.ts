import type Stripe from "stripe";
import prisma from "@/lib/prisma";

/**
 * Participant details for a paid checkout live here, not on Stripe.
 *
 * Stripe gets `orderId` and the order's non-personal facts (event, tiers,
 * fees). Participant details are kept in our own database for as long as the
 * checkout needs them, and the webhook reads them back from this table.
 *
 * The stored fields keep the metadata's own shape (participantN, teams,
 * userName, userEmail, userId), so the webhook's parsing is unchanged and an
 * intent created before this change still confirms from its metadata.
 */

/**
 * How long an unpaid checkout keeps its details. An athlete who leaves the
 * review step open longer starts again: accept-terms refuses an expired order,
 * and a payment that still lands is refunded by the webhook.
 */
export const PENDING_ORDER_TTL_MS = 24 * 60 * 60 * 1000;

/** The metadata keys that hold personal information and so stay off Stripe. */
export function isPrivateOrderKey(key: string): boolean {
  return /^participant\d+$/.test(key) || ["teams", "userName", "userEmail", "userId"].includes(key);
}

/** Split checkout's metadata into what goes to Stripe and what stays here. */
export function splitOrderMetadata(metadata: Record<string, string>): {
  stripe: Record<string, string>;
  private: Record<string, string>;
} {
  const stripe: Record<string, string> = {};
  const privateFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isPrivateOrderKey(key)) privateFields[key] = value;
    else stripe[key] = value;
  }
  return { stripe, private: privateFields };
}

export async function createPendingOrder(
  eventId: string,
  fields: Record<string, string>,
  now = new Date(),
): Promise<string> {
  const order = await prisma.pendingOrder.create({
    data: { eventId, fields, expiresAt: new Date(now.getTime() + PENDING_ORDER_TTL_MS) },
    select: { id: true },
  });
  return order.id;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    if (typeof field === "string") out[key] = field;
  }
  return out;
}

/**
 * The PaymentIntent's metadata with the order's stored fields put back. An
 * intent with no `orderId` predates this table and is returned as it is. One
 * whose order is gone (expired and swept) comes back without participants, so
 * the webhook refuses and refunds it.
 */
export async function orderMetadata(meta: Stripe.Metadata): Promise<{
  meta: Stripe.Metadata;
  missing: boolean;
}> {
  if (!meta.orderId) return { meta, missing: false };
  const order = await prisma.pendingOrder.findUnique({
    where: { id: meta.orderId },
    select: { eventId: true, fields: true },
  });
  if (!order || order.eventId !== meta.eventId) return { meta, missing: true };
  return { meta: { ...meta, ...asStringRecord(order.fields) }, missing: false };
}

/** True while the checkout behind this intent can still be paid. */
export async function pendingOrderIsLive(meta: Stripe.Metadata, now = new Date()): Promise<boolean> {
  if (!meta.orderId) return true;
  const order = await prisma.pendingOrder.findUnique({
    where: { id: meta.orderId },
    select: { eventId: true, expiresAt: true },
  });
  return Boolean(order && order.eventId === meta.eventId && order.expiresAt > now);
}

/** The webhook reached a final outcome, so the details are no longer needed. */
export async function deletePendingOrder(orderId: string | undefined): Promise<void> {
  if (!orderId) return;
  await prisma.pendingOrder.deleteMany({ where: { id: orderId } });
}

/**
 * Abandoned checkouts. Kept an hour past expiry, so a payment confirmed just
 * before the deadline still finds its order when the webhook arrives.
 */
export async function purgeExpiredPendingOrders(now = new Date()): Promise<number> {
  const { count } = await prisma.pendingOrder.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } },
  });
  return count;
}
