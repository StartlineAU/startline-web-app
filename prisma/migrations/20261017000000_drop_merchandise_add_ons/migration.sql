-- Remove the paid add-ons (event merchandise) and organiser-profile merchandise
-- features. The create migrations for these tables have been deleted, so a
-- database built from this tree never has them; this migration drops them from
-- any database that was migrated while the feature existed.
--
-- IF EXISTS keeps it a no-op on a fresh database. Order matters: the purchase
-- rows reference both the products and their variants with ON DELETE RESTRICT,
-- so they must go first.
DROP TABLE IF EXISTS "registration_add_ons";
DROP TABLE IF EXISTS "event_add_on_variants";
DROP TABLE IF EXISTS "event_add_ons";
DROP TABLE IF EXISTS "organiser_merchandise";

DROP TYPE IF EXISTS "AddOnItemStatus";
