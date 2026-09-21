-- AlterTable
ALTER TABLE "event_add_ons" ADD COLUMN     "merchandiseId" TEXT;

-- CreateTable
CREATE TABLE "organiser_merchandise" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "optionLabel" TEXT NOT NULL DEFAULT 'Size',
    "options" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organiser_merchandise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organiser_merchandise_organiserId_idx" ON "organiser_merchandise"("organiserId");

-- CreateIndex
CREATE INDEX "event_add_ons_merchandiseId_idx" ON "event_add_ons"("merchandiseId");

-- AddForeignKey
ALTER TABLE "event_add_ons" ADD CONSTRAINT "event_add_ons_merchandiseId_fkey" FOREIGN KEY ("merchandiseId") REFERENCES "organiser_merchandise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organiser_merchandise" ADD CONSTRAINT "organiser_merchandise_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

