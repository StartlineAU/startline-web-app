-- Opaque credential for an athlete's ticket QR. Existing rows get one too, so
-- every confirmed entry can be shown and scanned after the deploy.
ALTER TABLE "registrations" ADD COLUMN "ticketToken" TEXT;

UPDATE "registrations"
SET "ticketToken" = gen_random_uuid()::text
WHERE "ticketToken" IS NULL;

ALTER TABLE "registrations" ALTER COLUMN "ticketToken" SET NOT NULL;

CREATE UNIQUE INDEX "registrations_ticketToken_key" ON "registrations"("ticketToken");
