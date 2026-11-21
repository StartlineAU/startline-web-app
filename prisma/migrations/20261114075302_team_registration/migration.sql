-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "teamId" TEXT;

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticketLabel" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "captainRegistrationId" TEXT,
    "bibNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teams_eventId_idx" ON "teams"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_eventId_bibNumber_key" ON "teams"("eventId", "bibNumber");

-- CreateIndex
CREATE INDEX "registrations_teamId_idx" ON "registrations"("teamId");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
