-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "athleteUserId" TEXT;

-- CreateIndex
CREATE INDEX "registrations_athleteUserId_idx" ON "registrations"("athleteUserId");

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_athleteUserId_fkey" FOREIGN KEY ("athleteUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (#592). Every entry in an order was stored with the buyer's account,
-- so a profile listed an event once per ticket bought. Mark one entry per
-- account and event as the account holder's own: a named entry (not a place
-- left for later) on the account's own email, preferring a confirmed one, then
-- the one whose name matches the account's, then the earliest. Checkout refuses a second
-- entry for one person in an event, so one per event is right. Entries that
-- match nothing stay NULL; a profile still finds entries bought by someone
-- else under the account's email.
UPDATE "registrations" AS r
SET "athleteUserId" = pick."userId"
FROM (
  SELECT DISTINCT ON (reg."userId", reg."eventId") reg."id", reg."userId"
  FROM "registrations" AS reg
  JOIN "users" AS u ON u."id" = reg."userId"
  WHERE reg."detailsPending" = false
    AND lower(reg."athleteEmail") = lower(u."email")
  ORDER BY
    reg."userId",
    reg."eventId",
    -- A live entry over an earlier cancelled one, or the profile loses the race.
    (reg."status" = 'CONFIRMED') DESC,
    (lower(trim(reg."athleteName")) = lower(trim(coalesce(u."name", '')))) DESC,
    reg."createdAt" ASC,
    reg."id" ASC
) AS pick
WHERE r."id" = pick."id";
