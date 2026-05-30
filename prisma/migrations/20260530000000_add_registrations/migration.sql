-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Registration" (
    "id"                    TEXT                 NOT NULL,
    "eventId"               TEXT                 NOT NULL,
    "organiserId"           TEXT                 NOT NULL,
    "athleteName"           TEXT                 NOT NULL,
    "athleteEmail"          TEXT                 NOT NULL,
    "category"              TEXT,
    "waveLabel"             TEXT,
    "amountCents"           INTEGER              NOT NULL DEFAULT 0,
    "platformFeeCents"      INTEGER              NOT NULL DEFAULT 0,
    "feeStructure"          TEXT                 NOT NULL DEFAULT 'athlete',
    "status"                "RegistrationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "stripePaymentIntentId" TEXT,
    "createdAt"             TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_stripePaymentIntentId_key" ON "Registration"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Registration_eventId_idx" ON "Registration"("eventId");

-- CreateIndex
CREATE INDEX "Registration_organiserId_idx" ON "Registration"("organiserId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_organiserId_fkey"
    FOREIGN KEY ("organiserId") REFERENCES "Organiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
