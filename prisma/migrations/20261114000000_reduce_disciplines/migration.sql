-- #536: the site lists Running, Run Clubs and Other only. Events stored under a
-- discipline that is no longer offered move to "other" so the server-side type
-- filter still finds them. One way: the original discipline is not kept.
UPDATE "events"
SET "discipline" = 'other'
WHERE "discipline" NOT IN ('running', 'run_club', 'other');
