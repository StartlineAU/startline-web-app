-- AlterTable
ALTER TABLE "organisers" ADD COLUMN     "pendingClaim" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "organiser_invites" ADD COLUMN     "role" "OrganiserRole" NOT NULL DEFAULT 'MANAGER';
