-- Add profile fields to customers
ALTER TABLE "customers" ADD COLUMN "username" TEXT;
ALTER TABLE "customers" ADD COLUMN "bio" TEXT;
ALTER TABLE "customers" ADD COLUMN "profilePicUrl" TEXT;
ALTER TABLE "customers" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "customers_username_key" ON "customers"("username");

-- Link organisers to customers, add verified
ALTER TABLE "organisers" ADD COLUMN "customerId" TEXT;
ALTER TABLE "organisers" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

-- Create customer records for existing organisers and link them
DO $$
DECLARE
  org_record RECORD;
  new_customer_id TEXT;
BEGIN
  FOR org_record IN SELECT id, "cognitoSub", email FROM "organisers" WHERE "customerId" IS NULL LOOP
    -- Check if a customer already exists for this cognitoSub
    SELECT id INTO new_customer_id FROM "customers" WHERE "cognitoSub" = org_record."cognitoSub";
    
    IF new_customer_id IS NULL THEN
      -- Create a new customer record
      INSERT INTO "customers" ("id", "cognitoSub", "email", "username", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, org_record."cognitoSub", org_record."email", 
              lower(split_part(org_record."email", '@', 1)), NOW(), NOW())
      RETURNING id INTO new_customer_id;
    END IF;

    -- Link the organiser to the customer
    UPDATE "organisers" SET "customerId" = new_customer_id WHERE id = org_record.id;
  END LOOP;
END $$;

-- Now make customerId not null
ALTER TABLE "organisers" ALTER COLUMN "customerId" SET NOT NULL;
CREATE UNIQUE INDEX "organisers_customerId_key" ON "organisers"("customerId");
ALTER TABLE "organisers" ADD CONSTRAINT "organisers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the old cognitoSub column (now redundant)
ALTER TABLE "organisers" DROP COLUMN "cognitoSub";

-- Add customerId to registrations
ALTER TABLE "registrations" ADD COLUMN "customerId" TEXT;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
