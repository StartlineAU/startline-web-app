-- Waves and bibs become opt-in per event (#566).
CREATE TYPE "RaceFeatureMode" AS ENUM ('OFF', 'PRIVATE', 'SHARED');

ALTER TABLE "events"
  ADD COLUMN "waveMode" "RaceFeatureMode" NOT NULL DEFAULT 'OFF',
  ADD COLUMN "bibMode"  "RaceFeatureMode" NOT NULL DEFAULT 'OFF';

-- Existing events already showed waves and bibs to athletes. Keep that for
-- any event that uses them, so nothing disappears on deploy.
UPDATE "events" e SET "waveMode" = 'SHARED'
WHERE EXISTS (SELECT 1 FROM "start_waves" w WHERE w."eventId" = e."id");

-- A team entry's bib lives on the team, so count those too.
UPDATE "events" e SET "bibMode" = 'SHARED'
WHERE EXISTS (
  SELECT 1 FROM "registrations" r
  WHERE r."eventId" = e."id" AND r."bibNumber" IS NOT NULL AND btrim(r."bibNumber") <> ''
) OR EXISTS (
  SELECT 1 FROM "teams" t
  WHERE t."eventId" = e."id" AND t."bibNumber" IS NOT NULL AND btrim(t."bibNumber") <> ''
);
