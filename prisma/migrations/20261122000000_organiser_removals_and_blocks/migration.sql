-- CreateEnum
CREATE TYPE "RemovalReason" AS ENUM ('NO_SHOW_BRIEFING', 'CODE_OF_CONDUCT', 'INELIGIBLE', 'DUPLICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "RemovalRefund" AS ENUM ('FULL', 'NONE', 'NOT_PAID', 'REPLACED');

-- AlterEnum
ALTER TYPE "RegistrationStatus" ADD VALUE 'REMOVED';

-- AlterEnum
ALTER TYPE "UserNotificationType" ADD VALUE 'REMOVED_FROM_EVENT';

-- CreateTable
CREATE TABLE "registration_removals" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "athleteName" TEXT NOT NULL,
    "athleteEmail" TEXT NOT NULL,
    "replacedByName" TEXT,
    "replacedByEmail" TEXT,
    "removedByEmail" TEXT NOT NULL,
    "reason" "RemovalReason" NOT NULL,
    "note" TEXT,
    "noteShared" BOOLEAN NOT NULL DEFAULT false,
    "refund" "RemovalRefund" NOT NULL,
    "refundCents" INTEGER NOT NULL DEFAULT 0,
    "stripeRefundId" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_removals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organiser_blocks" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "note" TEXT,
    "createdByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organiser_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registration_removals_registrationId_idx" ON "registration_removals"("registrationId");

-- CreateIndex
CREATE INDEX "registration_removals_organiserId_createdAt_idx" ON "registration_removals"("organiserId", "createdAt");

-- CreateIndex
CREATE INDEX "organiser_blocks_organiserId_userId_idx" ON "organiser_blocks"("organiserId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "organiser_blocks_organiserId_email_key" ON "organiser_blocks"("organiserId", "email");

-- AddForeignKey
ALTER TABLE "registration_removals" ADD CONSTRAINT "registration_removals_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_removals" ADD CONSTRAINT "registration_removals_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organiser_blocks" ADD CONSTRAINT "organiser_blocks_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organiser_blocks" ADD CONSTRAINT "organiser_blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
