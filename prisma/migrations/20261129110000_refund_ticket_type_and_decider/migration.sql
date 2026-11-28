-- Goodwill refunds return the whole ticket price and keep the booking fee.
ALTER TYPE "RefundType" ADD VALUE 'TICKET';

-- The person who decided a refund request, not just the organisation (#610).
ALTER TABLE "support_tickets" ADD COLUMN "organiserDecidedByEmail" TEXT;
