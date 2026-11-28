-- Participant details for a paid checkout, held server-side instead of in
-- Stripe PaymentIntent metadata. Additive: in-flight intents created before
-- this release still carry their details in metadata, and the webhook reads
-- either shape.
CREATE TABLE "pending_orders" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pending_orders_expiresAt_idx" ON "pending_orders"("expiresAt");
