-- CreateEnum
CREATE TYPE "RefundDecisionReason" AS ENUM ('WITHIN_POLICY', 'EVENT_CHANGED', 'NOT_DELIVERED', 'GOODWILL', 'OUTSIDE_POLICY', 'OTHER');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('POLICY', 'FULL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserNotificationType" ADD VALUE 'REFUND_REQUESTED';
ALTER TYPE "UserNotificationType" ADD VALUE 'REFUND_APPROVED';
ALTER TYPE "UserNotificationType" ADD VALUE 'REFUND_DECLINED';

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "organiserReason" "RefundDecisionReason",
ADD COLUMN     "policyRefundCents" INTEGER,
ADD COLUMN     "policyRefundPercent" INTEGER,
ADD COLUMN     "refundCents" INTEGER,
ADD COLUMN     "refundError" TEXT,
ADD COLUMN     "refundIssuedAt" TIMESTAMP(3),
ADD COLUMN     "refundType" "RefundType",
ADD COLUMN     "registrationId" TEXT;

-- CreateIndex
CREATE INDEX "support_tickets_registrationId_idx" ON "support_tickets"("registrationId");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
