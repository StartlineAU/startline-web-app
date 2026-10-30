-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_organiserId_fkey";

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
