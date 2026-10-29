-- Payout operations make the Stripe call and the event's paid state durable
-- across crashes and retries. One operation per event, with every Stripe
-- request recorded as an attempt carrying its idempotency key.

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SUBMITTING', 'SUBMITTED', 'FAILED', 'NEEDS_RECONCILIATION');

-- CreateEnum
CREATE TYPE "PayoutAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "payout_operations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'aud',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "stripePayoutId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_attempts" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PayoutAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "stripePayoutId" TEXT,
    "errorCategory" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_operations_eventId_key" ON "payout_operations"("eventId");

-- CreateIndex
CREATE INDEX "payout_operations_status_idx" ON "payout_operations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payout_attempts_idempotencyKey_key" ON "payout_attempts"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payout_attempts_operationId_attemptNumber_key" ON "payout_attempts"("operationId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "payout_operations" ADD CONSTRAINT "payout_operations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_attempts" ADD CONSTRAINT "payout_attempts_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "payout_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: events paid before this table existed are already submitted. The
-- attempt is just an audit marker; it has no Stripe payout id.
INSERT INTO "payout_operations" (
    "id", "eventId", "stripeAccountId", "amountCents", "currency", "status",
    "stripePayoutId", "lastError", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    e."id",
    o."stripeAccountId",
    COALESCE(e."payoutAmountCents", 0),
    'aud',
    'SUBMITTED',
    NULL,
    NULL,
    COALESCE(e."payoutAt", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "events" e
JOIN "organisers" o ON o."id" = e."organiserId"
WHERE e."payoutTriggered" = true
  AND o."stripeAccountId" IS NOT NULL;

INSERT INTO "payout_attempts" (
    "id", "operationId", "attemptNumber", "idempotencyKey", "status",
    "stripePayoutId", "errorCategory", "errorMessage", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    po."id",
    1,
    'legacy-' || po."eventId",
    'SUCCEEDED',
    NULL,
    NULL,
    NULL,
    po."createdAt",
    po."updatedAt"
FROM "payout_operations" po;
