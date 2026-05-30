-- AlterTable: add Stripe Connect and compliance fields to Organiser
ALTER TABLE "Organiser" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Organiser" ADD COLUMN "insuranceDeclared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organiser" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "Organiser" ADD COLUMN "stripeOnboardingComplete" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: stripeAccountId must be unique when set
CREATE UNIQUE INDEX "Organiser_stripeAccountId_key" ON "Organiser"("stripeAccountId");
