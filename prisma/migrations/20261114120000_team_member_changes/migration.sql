-- CreateTable
CREATE TABLE "team_member_changes" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "registrationId" TEXT,
    "kind" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "changedByEmail" TEXT,
    "organiserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_member_changes_teamId_createdAt_idx" ON "team_member_changes"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "team_member_changes" ADD CONSTRAINT "team_member_changes_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
