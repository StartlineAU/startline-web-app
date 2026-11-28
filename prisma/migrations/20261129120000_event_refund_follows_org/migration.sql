-- An event can keep the organisation's refund policy or set its own.
ALTER TABLE "events" ADD COLUMN "refundFollowsOrg" BOOLEAN NOT NULL DEFAULT true;
