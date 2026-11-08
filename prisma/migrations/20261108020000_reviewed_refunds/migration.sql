-- Refunds are reviewed from a support ticket by the organiser and Startline.
-- The automatic full-refund entitlement from a material event change is gone.

ALTER TABLE "registrations" DROP COLUMN "fullRefundUntil",
DROP COLUMN "fullRefundChangeId",
DROP COLUMN "refundType",
DROP COLUMN "organiserRecoveryOwedCents",
DROP COLUMN "organiserRecoveredCents";

ALTER TABLE "event_changes" DROP COLUMN "affectedCount",
DROP COLUMN "fullRefundUntil";

ALTER TABLE "event_revisions" DROP COLUMN "acknowledged";

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'APPROVED', 'DECLINED', 'REFUNDED');

ALTER TABLE "support_tickets" ADD COLUMN "organiserId" TEXT,
ADD COLUMN "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "decidedById" TEXT,
ADD COLUMN "decidedAt" TIMESTAMP(3),
ADD COLUMN "decisionNote" TEXT;

CREATE INDEX "support_tickets_organiserId_status_idx" ON "support_tickets"("organiserId", "status");

DROP TYPE "RefundType";
