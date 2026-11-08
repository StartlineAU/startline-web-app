-- Unverified organisers' edits to a published event wait here instead of
-- changing the live listing. The event row stays as last approved until an
-- admin applies the revision.

CREATE TYPE "EventRevisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');

CREATE TABLE "event_revisions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "EventRevisionStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "material" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "submittedById" TEXT,
    "submittedByEmail" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_revisions_eventId_status_idx" ON "event_revisions"("eventId", "status");

-- One open revision per event. A later save supersedes the previous one first.
CREATE UNIQUE INDEX "event_revisions_one_pending_idx" ON "event_revisions"("eventId") WHERE "status" = 'PENDING';

ALTER TABLE "event_revisions" ADD CONSTRAINT "event_revisions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
