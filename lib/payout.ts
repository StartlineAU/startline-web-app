import { PayoutAttemptStatus, PayoutStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

const PAYOUT_CURRENCY = "aud";

/**
 * A payout request can only be resumed automatically while Stripe can still
 * recognise its idempotency key. Stripe retains API v1 keys for at least 24
 * hours, but may prune them after that.
 */
export const PAYOUT_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * How long a request may sit in SUBMITTING before another request may resume
 * it with the same idempotency key. This stops two concurrent admin clicks from
 * both calling Stripe, while still allowing a retry after a process died.
 */
export const PAYOUT_LEASE_MS = 2 * 60 * 1000;

const operationSelect = {
  id: true,
  eventId: true,
  stripeAccountId: true,
  amountCents: true,
  currency: true,
  status: true,
  stripePayoutId: true,
} as const;

const attemptSelect = {
  id: true,
  operationId: true,
  attemptNumber: true,
  idempotencyKey: true,
  status: true,
  stripePayoutId: true,
  createdAt: true,
} as const;

type PayoutOperationRecord = {
  id: string;
  eventId: string;
  stripeAccountId: string;
  amountCents: number;
  currency: string;
  status: PayoutStatus;
  stripePayoutId: string | null;
};

type PayoutAttemptRecord = {
  id: string;
  operationId: string;
  attemptNumber: number;
  idempotencyKey: string;
  status: PayoutAttemptStatus;
  stripePayoutId: string | null;
  createdAt: Date;
};

type PayoutEventRecord = {
  id: string;
  payoutTriggered: boolean;
  payoutAmountCents: number | null;
  organiser: { id: string; stripeAccountId: string | null };
  registrations: Array<{ amountCents: number }>;
  payoutOperation: PayoutOperationRecord | null;
};

export type PayoutEligibleEvent = {
  id: string;
  title: string;
  eventDate: string;
  endDate: string | null;
  organiser: { id: string; orgName: string | null; stripeAccountId: string | null };
  netCents: number;
};

export type PayoutAttention = {
  eventId: string;
  title: string;
  eventDate: string;
  endDate: string | null;
  organiser: { id: string; orgName: string | null };
  netCents: number;
  status: "SUBMITTING" | "NEEDS_RECONCILIATION";
  lastError: string | null;
  updatedAt: Date;
};

export type PayoutResult = {
  netCents: number;
  alreadyProcessed: boolean;
  stripePayoutId: string | null;
};

export class PayoutError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "PayoutError";
  }
}

/** The first attempt is the issue's suggested `payout-<eventId>` key. */
export function payoutIdempotencyKey(eventId: string, attemptNumber: number): string {
  return attemptNumber === 1
    ? `payout-${eventId}`
    : `payout-${eventId}-${attemptNumber}`;
}

/**
 * Events whose payout can be run today: the event has finished, the organiser
 * has an onboarded Stripe Express account, and we haven't already paid them.
 * In-flight and reconciliation-required operations are deliberately excluded;
 * they appear in getPayoutAttention() instead.
 */
export async function getPayoutEligibleEvents(): Promise<PayoutEligibleEvent[]> {
  const today = new Date().toISOString().split("T")[0];

  const events = await prisma.event.findMany({
    where: {
      registrationType: "startline",
      payoutTriggered: false,
      organiser: { stripeOnboardingComplete: true, stripeAccountId: { not: null } },
      OR: [
        { endDate: { not: null, lt: today } },
        { endDate: null, eventDate: { lt: today } },
      ],
    },
    select: {
      id: true,
      title: true,
      eventDate: true,
      endDate: true,
      organiser: { select: { id: true, orgName: true, stripeAccountId: true } },
      payoutOperation: { select: { status: true } },
      registrations: {
        where: { status: "CONFIRMED" },
        select: { amountCents: true },
      },
    },
  });

  const eligible: PayoutEligibleEvent[] = [];
  for (const event of events) {
    const status = event.payoutOperation?.status;
    if (status && status !== PayoutStatus.PENDING && status !== PayoutStatus.FAILED) {
      continue;
    }

    const netCents = event.registrations.reduce(
      (sum, registration) => sum + registration.amountCents,
      0,
    );
    if (netCents <= 0) continue;

    eligible.push({
      id: event.id,
      title: event.title,
      eventDate: event.eventDate,
      endDate: event.endDate,
      organiser: event.organiser,
      netCents,
    });
  }
  return eligible;
}

/** Payout operations that need an admin to look at Stripe before anyone retries. */
export async function getPayoutAttention(): Promise<PayoutAttention[]> {
  const operations = await prisma.payoutOperation.findMany({
    where: {
      status: { in: [PayoutStatus.SUBMITTING, PayoutStatus.NEEDS_RECONCILIATION] },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      eventId: true,
      amountCents: true,
      status: true,
      lastError: true,
      updatedAt: true,
      event: {
        select: {
          title: true,
          eventDate: true,
          endDate: true,
          organiser: { select: { id: true, orgName: true } },
        },
      },
    },
  });

  return operations.map((operation) => ({
    eventId: operation.eventId,
    title: operation.event.title,
    eventDate: operation.event.eventDate,
    endDate: operation.event.endDate,
    organiser: operation.event.organiser,
    netCents: operation.amountCents,
    status: operation.status as PayoutAttention["status"],
    lastError: operation.lastError,
    updatedAt: operation.updatedAt,
  }));
}

/**
 * Push the organiser's full net earnings for an event from their Stripe
 * Express balance to their nominated bank account, then mark the event paid.
 *
 * The process is split into a durable claim, the Stripe request, and the
 * recorded result. A retry after the result write fails resumes the same
 * attempt with the same idempotency key rather than starting a second payout.
 */
export async function runPayoutForEvent(eventId: string): Promise<PayoutResult> {
  const event = await loadEvent(eventId);

  if (event.payoutTriggered) {
    return storedResult(event, event.payoutOperation);
  }

  const existing = event.payoutOperation;
  if (existing?.status === PayoutStatus.SUBMITTED) {
    return storedResult(event, existing);
  }
  if (existing?.status === PayoutStatus.NEEDS_RECONCILIATION) {
    throw reconciliationRequired();
  }
  if (existing?.status === PayoutStatus.SUBMITTING) {
    return resumeSubmitting(event, existing);
  }

  const stripeAccountId = existing?.stripeAccountId ?? event.organiser.stripeAccountId;
  if (!stripeAccountId) {
    throw new PayoutError("Organiser has no Stripe account.", 422, "NO_STRIPE_ACCOUNT");
  }

  const netCents = existing?.amountCents ?? event.registrations.reduce(
    (sum, registration) => sum + registration.amountCents,
    0,
  );
  if (netCents <= 0) {
    throw new PayoutError("No confirmed registrations to pay out.", 422, "NOTHING_TO_PAY");
  }

  const started = await beginAttempt(event, netCents, stripeAccountId);
  if (started.kind === "attempt") {
    return submitAttempt(event.id, started.operation, started.attempt);
  }

  return continueOperation(event, started.operation);
}

async function loadEvent(eventId: string): Promise<PayoutEventRecord> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      payoutTriggered: true,
      payoutAmountCents: true,
      organiser: { select: { id: true, stripeAccountId: true } },
      registrations: {
        where: { status: "CONFIRMED" },
        select: { amountCents: true },
      },
      payoutOperation: { select: operationSelect },
    },
  });

  if (!event) throw new PayoutError("Event not found.", 404, "NOT_FOUND");
  return event as PayoutEventRecord;
}

function storedResult(
  event: PayoutEventRecord,
  operation: PayoutOperationRecord | null,
): PayoutResult {
  return {
    netCents: operation?.amountCents ?? event.payoutAmountCents ?? 0,
    alreadyProcessed: true,
    stripePayoutId: operation?.stripePayoutId ?? null,
  };
}

async function continueOperation(
  event: PayoutEventRecord,
  operation: PayoutOperationRecord,
): Promise<PayoutResult> {
  if (operation.status === PayoutStatus.SUBMITTED || event.payoutTriggered) {
    return storedResult(event, operation);
  }
  if (operation.status === PayoutStatus.SUBMITTING) {
    return resumeSubmitting(event, operation);
  }
  throw reconciliationRequired();
}

async function beginAttempt(
  event: PayoutEventRecord,
  netCents: number,
  stripeAccountId: string,
): Promise<
  | { kind: "attempt"; operation: PayoutOperationRecord; attempt: PayoutAttemptRecord }
  | { kind: "active"; operation: PayoutOperationRecord }
> {
  const operation = await ensureOperation(event, netCents, stripeAccountId);

  return prisma.$transaction(async (tx) => {
    const current = await tx.payoutOperation.findUnique({
      where: { id: operation.id },
      select: operationSelect,
    });
    if (!current) {
      throw new PayoutError("Payout operation not found.", 503, "OPERATION_MISSING");
    }

    if (current.status !== PayoutStatus.PENDING && current.status !== PayoutStatus.FAILED) {
      return { kind: "active" as const, operation: current };
    }

    const previousAttempts = await tx.payoutAttempt.count({
      where: { operationId: current.id },
    });
    const attemptNumber = previousAttempts + 1;

    const claimed = await tx.payoutOperation.updateMany({
      where: {
        id: current.id,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.FAILED] },
      },
      data: { status: PayoutStatus.SUBMITTING, lastError: null },
    });

    if (claimed.count !== 1) {
      const latest = await tx.payoutOperation.findUnique({
        where: { id: current.id },
        select: operationSelect,
      });
      if (!latest) {
        throw new PayoutError("Payout operation not found.", 503, "OPERATION_MISSING");
      }
      return { kind: "active" as const, operation: latest };
    }

    const attempt = await tx.payoutAttempt.create({
      data: {
        operationId: current.id,
        attemptNumber,
        idempotencyKey: payoutIdempotencyKey(event.id, attemptNumber),
        status: PayoutAttemptStatus.STARTED,
      },
      select: attemptSelect,
    });

    return {
      kind: "attempt" as const,
      operation: { ...current, status: PayoutStatus.SUBMITTING },
      attempt,
    };
  });
}

async function ensureOperation(
  event: PayoutEventRecord,
  netCents: number,
  stripeAccountId: string,
): Promise<PayoutOperationRecord> {
  if (event.payoutOperation) return event.payoutOperation;

  try {
    return await prisma.payoutOperation.create({
      data: {
        eventId: event.id,
        stripeAccountId,
        amountCents: netCents,
        currency: PAYOUT_CURRENCY,
      },
      select: operationSelect,
    });
  } catch (err) {
    // A concurrent request got there first. Load the winner and let the claim
    // transaction decide whether this request starts or resumes an attempt.
    if (!isUniqueConstraintError(err)) throw err;
    const existing = await prisma.payoutOperation.findUnique({
      where: { eventId: event.id },
      select: operationSelect,
    });
    if (!existing) throw err;
    return existing;
  }
}

async function resumeSubmitting(
  event: PayoutEventRecord,
  operation: PayoutOperationRecord,
): Promise<PayoutResult> {
  const attempt = await prisma.payoutAttempt.findFirst({
    where: { operationId: operation.id },
    orderBy: { attemptNumber: "desc" },
    select: attemptSelect,
  });

  if (!attempt) {
    return requireReconciliation(
      operation,
      null,
      "A payout request was started without an attempt record. Check Stripe before retrying.",
    );
  }

  if (attempt.status === PayoutAttemptStatus.SUCCEEDED && attempt.stripePayoutId) {
    return recordSubmission(event.id, operation, attempt, attempt.stripePayoutId);
  }

  if (attempt.status !== PayoutAttemptStatus.STARTED) {
    return requireReconciliation(
      operation,
      attempt,
      "The previous payout request has an unresolved outcome. Check Stripe before retrying.",
    );
  }

  const age = Date.now() - attempt.createdAt.getTime();
  if (age < PAYOUT_LEASE_MS) {
    throw new PayoutError(
      "This payout is already being processed. Refresh in a moment.",
      409,
      "IN_PROGRESS",
    );
  }

  if (age > PAYOUT_IDEMPOTENCY_WINDOW_MS) {
    return requireReconciliation(
      operation,
      attempt,
      "Stripe may have discarded the idempotency key. Check Stripe before retrying.",
    );
  }

  return submitAttempt(event.id, operation, attempt);
}

async function submitAttempt(
  eventId: string,
  operation: PayoutOperationRecord,
  attempt: PayoutAttemptRecord,
): Promise<PayoutResult> {
  let payoutId: string;

  try {
    const payout = await getStripe().payouts.create(
      {
        amount: operation.amountCents,
        currency: operation.currency,
        metadata: {
          eventId,
          payoutOperationId: operation.id,
        },
      },
      {
        stripeAccount: operation.stripeAccountId,
        idempotencyKey: attempt.idempotencyKey,
      },
    );
    payoutId = payout.id;
  } catch (err) {
    const details = describeStripeError(err);

    if (isAmbiguousStripeError(err)) {
      await markReconciliationRequired(operation, attempt, details);
      throw reconciliationRequired();
    }

    await markFailed(operation, attempt, details);
    throw new PayoutError("Stripe could not create the payout.", 422, "PAYOUT_FAILED");
  }

  return recordSubmission(eventId, operation, attempt, payoutId);
}

async function recordSubmission(
  eventId: string,
  operation: PayoutOperationRecord,
  attempt: PayoutAttemptRecord,
  stripePayoutId: string,
): Promise<PayoutResult> {
  try {
    await prisma.$transaction([
      prisma.payoutAttempt.update({
        where: { id: attempt.id },
        data: {
          status: PayoutAttemptStatus.SUCCEEDED,
          stripePayoutId,
          errorCategory: null,
          errorMessage: null,
        },
      }),
      prisma.payoutOperation.update({
        where: { id: operation.id },
        data: {
          status: PayoutStatus.SUBMITTED,
          stripePayoutId,
          lastError: null,
        },
      }),
      prisma.event.update({
        where: { id: eventId },
        data: {
          payoutTriggered: true,
          payoutAmountCents: operation.amountCents,
          payoutAt: new Date(),
        },
      }),
    ]);
  } catch (err) {
    // Stripe has the money request, but we could not record it. Leave the
    // operation in SUBMITTING so the next request resumes the same key.
    console.error("Payout submitted but could not be recorded:", err);
    throw new PayoutError(
      "The payout was sent but could not be recorded. Retry to confirm it.",
      503,
      "RECORD_FAILED",
    );
  }

  return {
    netCents: operation.amountCents,
    alreadyProcessed: false,
    stripePayoutId,
  };
}

async function markFailed(
  operation: PayoutOperationRecord,
  attempt: PayoutAttemptRecord,
  details: { category: string; message: string },
): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.payoutAttempt.update({
        where: { id: attempt.id },
        data: {
          status: PayoutAttemptStatus.FAILED,
          errorCategory: details.category,
          errorMessage: details.message,
        },
      }),
      prisma.payoutOperation.update({
        where: { id: operation.id },
        data: { status: PayoutStatus.FAILED, lastError: details.message },
      }),
    ]);
  } catch (err) {
    console.error("Could not record the failed payout attempt:", err);
  }
}

async function markReconciliationRequired(
  operation: PayoutOperationRecord,
  attempt: PayoutAttemptRecord,
  details: { category: string; message: string },
): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.payoutAttempt.update({
        where: { id: attempt.id },
        data: {
          status: PayoutAttemptStatus.UNKNOWN,
          errorCategory: details.category,
          errorMessage: details.message,
        },
      }),
      prisma.payoutOperation.update({
        where: { id: operation.id },
        data: { status: PayoutStatus.NEEDS_RECONCILIATION, lastError: details.message },
      }),
    ]);
  } catch (err) {
    console.error("Could not record the unresolved payout attempt:", err);
  }
}

async function requireReconciliation(
  operation: PayoutOperationRecord,
  attempt: PayoutAttemptRecord | null,
  reason: string,
): Promise<never> {
  try {
    if (attempt) {
      await prisma.$transaction([
        prisma.payoutOperation.update({
          where: { id: operation.id },
          data: { status: PayoutStatus.NEEDS_RECONCILIATION, lastError: reason },
        }),
        prisma.payoutAttempt.update({
          where: { id: attempt.id },
          data: {
            status: PayoutAttemptStatus.UNKNOWN,
            errorCategory: "RECONCILIATION_REQUIRED",
            errorMessage: reason,
          },
        }),
      ]);
    } else {
      await prisma.payoutOperation.update({
        where: { id: operation.id },
        data: { status: PayoutStatus.NEEDS_RECONCILIATION, lastError: reason },
      });
    }
  } catch (err) {
    console.error("Could not flag the payout for reconciliation:", err);
  }

  throw reconciliationRequired();
}

function reconciliationRequired(): PayoutError {
  return new PayoutError(
    "Stripe did not confirm this payout. Check the connected account in Stripe before retrying.",
    409,
    "RECONCILIATION_REQUIRED",
  );
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object"
    && err !== null
    && (err as { code?: string }).code === "P2002";
}

/** A connection/5xx/rate-limit failure may have reached Stripe. */
export function isAmbiguousStripeError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return true;

  const error = err as { type?: string; statusCode?: number };
  if (
    error.type === "StripeConnectionError"
    || error.type === "StripeAPIError"
    || error.type === "StripeRateLimitError"
    || error.type === "StripeIdempotencyError"
    || error.type === "StripeUnknownError"
  ) {
    return true;
  }
  return typeof error.statusCode === "number" && error.statusCode >= 500;
}

function describeStripeError(err: unknown): { category: string; message: string } {
  if (typeof err !== "object" || err === null) {
    return { category: "UNKNOWN", message: String(err) };
  }

  const error = err as {
    type?: string;
    code?: string;
    statusCode?: number;
    message?: string;
  };
  const category = [error.type, error.code, error.statusCode]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(":") || "UNKNOWN";

  return {
    category,
    message: error.message ?? String(err),
  };
}
