-- An organiser-chosen check-in opening time (#543). Null keeps the default
-- of 60 minutes before the event starts.
ALTER TABLE "events" ADD COLUMN "checkInOpensAt" TIMESTAMP(3);
