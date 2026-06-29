-- CreateTable
CREATE TABLE "event_basics" (
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,

    CONSTRAINT "event_basics_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "event_schedules" (
    "eventId" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "endDate" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "venue" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "event_schedules_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "event_formats" (
    "eventId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "categories" JSONB NOT NULL DEFAULT '[]',
    "cap" INTEGER,
    "minAge" INTEGER NOT NULL DEFAULT 16,

    CONSTRAINT "event_formats_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "event_tickets" (
    "eventId" TEXT NOT NULL,
    "waves" JSONB NOT NULL DEFAULT '[]',
    "inclusions" TEXT,
    "extras" TEXT,
    "activations" TEXT,
    "refundPolicy" TEXT,
    "registrationType" TEXT NOT NULL DEFAULT 'startline',
    "feeStructure" TEXT NOT NULL DEFAULT 'athlete',
    "registrationUrl" TEXT,

    CONSTRAINT "event_tickets_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "event_details" (
    "eventId" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "bagDrop" TEXT,
    "parking" TEXT,
    "accessibilityInfo" TEXT,
    "additionalNotes" TEXT,

    CONSTRAINT "event_details_pkey" PRIMARY KEY ("eventId")
);

-- AddForeignKey
ALTER TABLE "event_basics" ADD CONSTRAINT "event_basics_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_schedules" ADD CONSTRAINT "event_schedules_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_formats" ADD CONSTRAINT "event_formats_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing events table
INSERT INTO "event_basics" ("eventId", "title", "tagline", "description")
SELECT "id", "title", "tagline", "description" FROM "events";

INSERT INTO "event_schedules" ("eventId", "eventDate", "endDate", "startTime", "endTime", "venue", "address", "city", "state")
SELECT "id", "eventDate", "endDate", "startTime", NULLIF("endTime", ''), "venue", "address", "city", "state" FROM "events";

INSERT INTO "event_formats" ("eventId", "discipline", "format", "level", "categories", "cap", "minAge")
SELECT "id", "discipline", "format", "level", "categories", "cap", "minAge" FROM "events";

INSERT INTO "event_tickets" ("eventId", "waves", "inclusions", "extras", "activations", "refundPolicy", "registrationType", "feeStructure", "registrationUrl")
SELECT "id", "waves", "inclusions", "extras", "activations", "refundPolicy", "registrationType", "feeStructure", "registrationUrl" FROM "events";

INSERT INTO "event_details" ("eventId", "coverImageUrl", "bagDrop", "parking", "accessibilityInfo", "additionalNotes")
SELECT "id", "coverImageUrl", "bagDrop", "parking", "accessibilityInfo", "additionalNotes" FROM "events";
