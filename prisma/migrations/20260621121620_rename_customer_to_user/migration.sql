-- Rename customers table to users
ALTER TABLE "customers" RENAME TO "users";

-- Rename customerId to userId in organisers (data is preserved)
ALTER TABLE "organisers" RENAME CONSTRAINT "organisers_customerId_fkey" TO "organisers_userId_fkey";
ALTER TABLE "organisers" RENAME CONSTRAINT "organisers_customerId_key" TO "organisers_userId_key";
ALTER INDEX "organisers_customerId_key" RENAME TO "organisers_userId_key";
ALTER TABLE "organisers" RENAME COLUMN "customerId" TO "userId";

-- Rename customerId to userId in registrations
ALTER TABLE "registrations" RENAME CONSTRAINT "registrations_customerId_fkey" TO "registrations_userId_fkey";
ALTER TABLE "registrations" RENAME COLUMN "customerId" TO "userId";
