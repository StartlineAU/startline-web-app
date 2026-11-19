-- Entries and payout records are financial history: deleting an event or an
-- organisation must never take them with it. The app refuses those deletes
-- first; these constraints make sure nothing else can.

ALTER TABLE "registrations" DROP CONSTRAINT "registrations_eventId_fkey";
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registrations" DROP CONSTRAINT "registrations_organiserId_fkey";
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payout_operations" DROP CONSTRAINT "payout_operations_eventId_fkey";
ALTER TABLE "payout_operations" ADD CONSTRAINT "payout_operations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
