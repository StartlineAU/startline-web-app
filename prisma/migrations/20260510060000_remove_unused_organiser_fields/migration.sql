-- Remove fields not collected in the UI

ALTER TABLE "Organiser" DROP COLUMN IF EXISTS "tiktok";
ALTER TABLE "Organiser" DROP COLUMN IF EXISTS "insuranceUrl";
ALTER TABLE "Organiser" DROP COLUMN IF EXISTS "pastEventsUrl";
ALTER TABLE "Organiser" DROP COLUMN IF EXISTS "certifications";
ALTER TABLE "Organiser" DROP COLUMN IF EXISTS "eventTypes";
