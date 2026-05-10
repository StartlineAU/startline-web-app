-- Add columns that exist in schema.prisma but were missing from the DB

ALTER TABLE "Organiser" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Organiser" ADD COLUMN IF NOT EXISTS "tiktok" TEXT;
ALTER TABLE "Organiser" ADD COLUMN IF NOT EXISTS "eventTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
