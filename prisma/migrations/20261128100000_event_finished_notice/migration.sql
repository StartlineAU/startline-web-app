-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_FINISHED';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "finishedNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organisers" ADD COLUMN     "notifyEventFinished" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: events that finished before this notice existed are not announced
-- now. Without this the first worker sweep after deploy would tell every
-- organisation about every race it has ever run. That includes an event whose
-- end has passed but that the worker has not archived yet.
UPDATE "events"
SET "finishedNotifiedAt" = COALESCE("endsAtUtc", CURRENT_TIMESTAMP)
WHERE "status" = 'ARCHIVED'
   OR ("endsAtUtc" IS NOT NULL AND "endsAtUtc" <= CURRENT_TIMESTAMP);
