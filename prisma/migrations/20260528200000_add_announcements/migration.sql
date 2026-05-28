-- CreateTable: Announcement (per-event organiser announcements)
CREATE TABLE "Announcement" (
    "id"          TEXT         NOT NULL,
    "eventId"     TEXT         NOT NULL,
    "organiserId" TEXT         NOT NULL,
    "title"       TEXT         NOT NULL,
    "body"        TEXT         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organiserId_fkey"
    FOREIGN KEY ("organiserId") REFERENCES "Organiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
