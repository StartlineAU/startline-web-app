-- Published events now have a distinct in-progress state between start and end.
-- Kept in its own migration so the new enum value is committed before the
-- backfill in the next migration reads or writes it.
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
