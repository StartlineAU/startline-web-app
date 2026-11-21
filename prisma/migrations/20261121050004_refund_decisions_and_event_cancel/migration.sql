-- AlterEnum
ALTER TYPE "EventStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'REFUND_TICKET_OVERRIDE';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_CANCELLED';
ALTER TYPE "UserNotificationType" ADD VALUE 'EVENT_CANCELLED';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "cancelledByRole" TEXT;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "cancelRefundError" TEXT,
ADD COLUMN     "cancelRefundId" TEXT,
ADD COLUMN     "cancelRefundStatus" TEXT,
ADD COLUMN     "cancelRefundAttemptAt" TIMESTAMP(3);

-- AlterTable: the organiser's decision and Startline's decision get their own
-- columns (#570), so an admin decision can no longer overwrite the organiser's.
ALTER TABLE "support_tickets" ADD COLUMN     "adminDecidedAt" TIMESTAMP(3),
ADD COLUMN     "adminDecidedById" TEXT,
ADD COLUMN     "adminDecisionKind" TEXT,
ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "organiserDecidedAt" TIMESTAMP(3),
ADD COLUMN     "organiserDecidedById" TEXT,
ADD COLUMN     "organiserDecision" "SupportTicketStatus",
ADD COLUMN     "organiserNote" TEXT;

-- Backfill. Both routes wrote decidedById: an Organiser id from the organiser
-- route, an Admin id from the admin route. Which table the id is in says who
-- decided. An admin approve or decline made before this change predates the
-- override rule, so it is recorded as an override with the note it carried.
-- An admin marking a ticket REFUNDED issued the money; it was not a decision,
-- so it carries no decision kind. (The old columns kept only the last writer,
-- so whatever the organiser said before that is not recoverable.)
UPDATE "support_tickets" t
SET "organiserDecision"    = t."status",
    "organiserDecidedById" = t."decidedById",
    "organiserDecidedAt"   = t."decidedAt",
    "organiserNote"        = t."decisionNote"
WHERE t."decidedById" IS NOT NULL
  AND t."status" IN ('APPROVED', 'DECLINED')
  AND EXISTS (SELECT 1 FROM "organisers" o WHERE o."id" = t."decidedById");

UPDATE "support_tickets" t
SET "adminDecisionKind" = CASE WHEN t."status" = 'REFUNDED' THEN NULL ELSE 'OVERRIDE' END,
    "adminDecidedById"  = t."decidedById",
    "adminDecidedAt"    = t."decidedAt",
    "adminNote"         = t."decisionNote"
WHERE t."decidedById" IS NOT NULL
  AND t."organiserDecidedById" IS NULL;

ALTER TABLE "support_tickets" DROP COLUMN "decidedAt",
DROP COLUMN "decidedById",
DROP COLUMN "decisionNote";

-- CreateIndex
CREATE INDEX "registrations_cancelRefundStatus_idx" ON "registrations"("cancelRefundStatus");

-- CreateIndex
CREATE INDEX "support_tickets_eventId_status_idx" ON "support_tickets"("eventId", "status");
