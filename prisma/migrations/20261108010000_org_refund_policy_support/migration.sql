-- Organisation-scoped change-of-mind refund policy, a snapshot so a later
-- change does not rewrite what an athlete already paid against, and the
-- support tickets athletes open instead of refunding themselves.

ALTER TABLE "organisers" ADD COLUMN "refundTiers" JSONB,
ADD COLUMN "refundPolicy" TEXT;

ALTER TABLE "registrations" ADD COLUMN "soldRefundTiers" JSONB;

CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "requestType" TEXT NOT NULL,
    "eventName" TEXT,
    "eventDate" TEXT,
    "eventId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");
