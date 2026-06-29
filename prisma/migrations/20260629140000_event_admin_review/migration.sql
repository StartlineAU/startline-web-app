-- CreateTable
CREATE TABLE "event_admin_reviews" (
    "eventId" TEXT NOT NULL,
    "adminNotes" TEXT,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "event_admin_reviews_pkey" PRIMARY KEY ("eventId")
);

-- AddForeignKey
ALTER TABLE "event_admin_reviews" ADD CONSTRAINT "event_admin_reviews_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_admin_reviews" ADD CONSTRAINT "event_admin_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from events
INSERT INTO "event_admin_reviews" ("eventId", "adminNotes", "rejectionReason", "reviewedById", "reviewedAt")
SELECT "id", "adminNotes", "rejectionReason", "reviewedById", "reviewedAt"
FROM "events"
WHERE "adminNotes" IS NOT NULL
   OR "rejectionReason" IS NOT NULL
   OR "reviewedById" IS NOT NULL
   OR "reviewedAt" IS NOT NULL;
