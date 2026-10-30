-- Venue-local fields stay the editable source. These columns hold the same
-- moments in UTC for lifecycle transitions, registration cutoffs and public
-- listing filters, plus the IANA zone needed to render them back locally.
ALTER TABLE "events"
  ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
  ADD COLUMN "startsAtUtc" TIMESTAMP(3),
  ADD COLUMN "endsAtUtc" TIMESTAMP(3);

UPDATE "events"
SET "timeZone" = CASE lower(coalesce("state", ''))
  WHEN 'nsw' THEN 'Australia/Sydney'
  WHEN 'vic' THEN 'Australia/Melbourne'
  WHEN 'act' THEN 'Australia/Sydney'
  WHEN 'tas' THEN 'Australia/Hobart'
  WHEN 'qld' THEN 'Australia/Brisbane'
  WHEN 'sa' THEN 'Australia/Adelaide'
  WHEN 'nt' THEN 'Australia/Darwin'
  WHEN 'wa' THEN 'Australia/Perth'
  ELSE 'Australia/Sydney'
END;

-- Backfill rows with complete local values. A missing end time has always meant
-- "until the end of the event day", so 23:59 is the same boundary the old
-- date-only archiver applied.
WITH windows AS (
  SELECT
    "id",
    (("eventDate" || ' ' || "startTime")::timestamp AT TIME ZONE "timeZone") AS "startsAtUtc",
    ((
      CASE
        WHEN "endDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN "endDate"
        ELSE "eventDate"
      END
      || ' '
      || CASE
        WHEN "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN "endTime"
        ELSE '23:59'
      END
    )::timestamp AT TIME ZONE "timeZone") AS "endsAtUtc"
  FROM "events"
  WHERE "eventDate" ~ '^\d{4}-\d{2}-\d{2}$'
    AND "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
)
UPDATE "events" AS e
SET
  "startsAtUtc" = w."startsAtUtc",
  "endsAtUtc" = w."endsAtUtc"
FROM windows AS w
WHERE e."id" = w."id";

-- Catch up rows whose window has already moved while no request was there to
-- write from a read path.
UPDATE "events"
SET "status" = 'ARCHIVED'
WHERE "status" = 'APPROVED'
  AND "endsAtUtc" IS NOT NULL
  AND "endsAtUtc" <= NOW();

UPDATE "events"
SET "status" = 'IN_PROGRESS'
WHERE "status" = 'APPROVED'
  AND "startsAtUtc" IS NOT NULL
  AND "startsAtUtc" <= NOW()
  AND ("endsAtUtc" IS NULL OR "endsAtUtc" > NOW());

CREATE INDEX "events_status_endsAtUtc_idx" ON "events"("status", "endsAtUtc");
CREATE INDEX "events_status_startsAtUtc_idx" ON "events"("status", "startsAtUtc");
