-- Checkout no longer asks participants for an emailed code before payment
-- (issue #387). The table only ever held short-lived verification codes.
DROP TABLE IF EXISTS "guest_email_verifications";
