-- Which organiser contact details athletes see, per organisation with a
-- per-event override. Null on an event follows the organisation.
ALTER TABLE "organisers" ADD COLUMN "showContactName" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showContactEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showContactPhone" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "events" ADD COLUMN "showContactName" BOOLEAN,
ADD COLUMN "showContactEmail" BOOLEAN,
ADD COLUMN "showContactPhone" BOOLEAN;
