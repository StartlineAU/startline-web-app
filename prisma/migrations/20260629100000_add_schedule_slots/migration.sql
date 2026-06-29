-- AlterTable
ALTER TABLE "events" ADD COLUMN "scheduleSlots" JSONB NOT NULL DEFAULT '[]';
