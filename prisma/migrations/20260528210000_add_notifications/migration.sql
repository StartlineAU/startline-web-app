-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EVENT_APPROVED', 'EVENT_REJECTED', 'NEW_REGISTRATION');

-- CreateTable
CREATE TABLE "Notification" (
    "id"          TEXT             NOT NULL,
    "organiserId" TEXT             NOT NULL,
    "type"        "NotificationType" NOT NULL,
    "title"       TEXT             NOT NULL,
    "body"        TEXT             NOT NULL,
    "eventId"     TEXT,
    "read"        BOOLEAN          NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organiserId_fkey"
    FOREIGN KEY ("organiserId") REFERENCES "Organiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
