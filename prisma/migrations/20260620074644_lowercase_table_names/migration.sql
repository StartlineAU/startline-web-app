-- Rename LegacyEvent's table first to free up the "events" name
ALTER TABLE events RENAME TO legacy_events;

-- Rename all PascalCase tables to snake_case
ALTER TABLE "Admin" RENAME TO admins;
ALTER TABLE "Athlete" RENAME TO athletes;
ALTER TABLE "Announcement" RENAME TO announcements;
ALTER TABLE "Event" RENAME TO events;
ALTER TABLE "Notification" RENAME TO notifications;
ALTER TABLE "Organiser" RENAME TO organisers;
ALTER TABLE "Registration" RENAME TO registrations;
ALTER TABLE "Review" RENAME TO reviews;
