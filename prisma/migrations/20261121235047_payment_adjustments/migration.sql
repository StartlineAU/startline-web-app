-- CreateEnum
CREATE TYPE "PaymentAdjustmentKind" AS ENUM ('REFUND', 'DISPUTE');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "payment_adjustments" (
    "id" TEXT NOT NULL,
    "stripeObjectId" TEXT NOT NULL,
    "kind" "PaymentAdjustmentKind" NOT NULL,
    "eventId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "unallocatedCents" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "disputeStatus" "DisputeStatus",
    "afterPayout" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_adjustments_stripeObjectId_key" ON "payment_adjustments"("stripeObjectId");

-- CreateIndex
CREATE INDEX "payment_adjustments_eventId_idx" ON "payment_adjustments"("eventId");

-- CreateIndex
CREATE INDEX "payment_adjustments_stripePaymentIntentId_idx" ON "payment_adjustments"("stripePaymentIntentId");

-- AddForeignKey
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
