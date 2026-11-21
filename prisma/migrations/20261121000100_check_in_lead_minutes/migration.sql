-- How many minutes before the start athlete check-in opens, when the
-- organiser opens it earlier than the default 60 (#543). Null keeps the
-- default. A lead rather than a time, so it moves with the event.
ALTER TABLE "events" ADD COLUMN "checkInLeadMinutes" INTEGER;
