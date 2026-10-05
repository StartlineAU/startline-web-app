-- AlterTable
ALTER TABLE "organisers" ADD COLUMN     "notifyEventApproved" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyEventRejected" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyNewRegistration" BOOLEAN NOT NULL DEFAULT true;
