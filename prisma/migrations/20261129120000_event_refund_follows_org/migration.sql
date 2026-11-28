-- An event can keep the organisation's refund policy or set its own.
ALTER TABLE "events" ADD COLUMN "refundFollowsOrg" BOOLEAN NOT NULL DEFAULT true;

-- An event whose tiers already differ from its organisation's saved policy
-- has a policy of its own; following would replace it on the next edit.
-- Empty or missing tiers are not one: the editor saved [] for free events.
UPDATE "events" AS e
SET "refundFollowsOrg" = false
FROM "organisers" AS o
WHERE e."organiserId" = o.id
  AND o."refundTiers" IS NOT NULL
  AND e."refundTiers" IS NOT NULL
  AND e."refundTiers" <> '[]'::jsonb
  AND e."refundTiers" IS DISTINCT FROM o."refundTiers";
