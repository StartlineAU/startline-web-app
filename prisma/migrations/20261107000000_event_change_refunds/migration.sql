-- Organiser event editing (part of #490): an append-only change log for
-- events, and the full-refund entitlement a material change gives the
-- athletes who had already entered.
-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('NORMAL', 'FULL');

-- CreateEnum
CREATE TYPE "EventChangeSource" AS ENUM ('ORGANISER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EventChangeKind" AS ENUM ('BASELINE', 'EDIT');

-- AlterEnum
ALTER TYPE "UserNotificationType" ADD VALUE 'EVENT_CHANGED';

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "fullRefundChangeId" TEXT,
ADD COLUMN     "fullRefundUntil" TIMESTAMP(3),
ADD COLUMN     "organiserRecoveredCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "organiserRecoveryOwedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundType" "RefundType",
ADD COLUMN     "stripeRefundId" TEXT;

-- CreateTable
CREATE TABLE "event_changes" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "eventTitle" TEXT NOT NULL,
    "source" "EventChangeSource" NOT NULL,
    "kind" "EventChangeKind" NOT NULL,
    "changedById" TEXT,
    "changedByEmail" TEXT,
    "organiserVerified" BOOLEAN NOT NULL DEFAULT false,
    "statusAtChange" "EventStatus" NOT NULL,
    "changes" JSONB NOT NULL,
    "material" BOOLEAN NOT NULL DEFAULT false,
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "fullRefundUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_changes_eventId_createdAt_idx" ON "event_changes"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "event_changes" ADD CONSTRAINT "event_changes_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

