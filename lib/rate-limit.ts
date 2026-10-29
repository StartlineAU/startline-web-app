import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { NextRequest, NextResponse } from "next/server";

export type RateLimitBudget = {
  /** Namespaces the shared counter, e.g. "billable-lookup". */
  prefix: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitOptions = {
  /** Namespaces the keys, e.g. "verify-email-send". */
  prefix: string;
  limit: number;
  windowSeconds: number;
  /** Overrides the default IP key. Use user/email id once authenticated. */
  identifier?: string;
  /**
   * Refuse the request when the counter cannot be read. Paid routes use this:
   * letting traffic through during a database outage is how an outage becomes
   * an unbounded bill.
   */
  failClosed?: boolean;
  /**
   * A second, caller-independent budget shared by every request that reaches
   * the same paid upstream. Per-IP limits throttle one source; this caps the
   * total damage from many sources.
   */
  aggregate?: RateLimitBudget;
};

type Row = { count: number; resetAt: Date };

/**
 * The circuit breaker for every route that can spend money with a third party.
 * One budget covers all of them, so a flood spread across IPs or endpoints
 * still stops after the same number of calls.
 *
 * 120/minute is deliberately above normal organiser typing and public search
 * use, but low enough to put a hard ceiling on accidental or malicious spend.
 */
export const BILLABLE_LOOKUP_BUDGET: RateLimitBudget = {
  prefix: "billable-lookup",
  limit: 120,
  windowSeconds: 60,
};

/**
 * Fixed-window rate limit keyed by client IP by default. Returns a 429
 * response with Retry-After + X-RateLimit-* headers when blocked, or null to
 * let the request through. Fail-open by default: existing routes rely on the
 * limiter never being the reason a password reset or contact form fails.
 */
export async function rateLimit(
  req: NextRequest,
  opts: RateLimitOptions,
): Promise<NextResponse | null> {
  const key = `${opts.prefix}:${opts.identifier ?? getClientIp(req)}`;

  const caller = await bump(key, opts.windowSeconds);
  if (!caller) return opts.failClosed ? unavailable() : null;
  if (caller.count > opts.limit) return blocked(opts.limit, caller.resetAt);

  if (opts.aggregate) {
    const shared = await bump(`${opts.aggregate.prefix}:all`, opts.aggregate.windowSeconds);
    if (!shared) return opts.failClosed ? unavailable() : null;
    if (shared.count > opts.aggregate.limit) {
      return blocked(opts.aggregate.limit, shared.resetAt);
    }
  }

  return null;
}

/**
 * Limiter for routes that can invoke a billed third-party service. Always
 * fails closed and always spends from the shared billable-lookup budget.
 */
export async function rateLimitPaid(
  req: NextRequest,
  opts: Omit<RateLimitOptions, "failClosed" | "aggregate">,
): Promise<NextResponse | null> {
  return rateLimit(req, {
    ...opts,
    failClosed: true,
    aggregate: BILLABLE_LOOKUP_BUDGET,
  });
}

/**
 * Increment one fixed-window counter atomically. Returns null when the counter
 * cannot be read, so the caller decides whether that is fatal.
 */
async function bump(key: string, windowSeconds: number): Promise<Row | null> {
  try {
    const rows = await prisma.$queryRaw<Row[]>`
      INSERT INTO "rate_limits" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
      ON CONFLICT ("key") DO UPDATE
      SET "count" = CASE
            WHEN "rate_limits"."resetAt" <= now() THEN 1
            ELSE "rate_limits"."count" + 1
          END,
          "resetAt" = CASE
            WHEN "rate_limits"."resetAt" <= now()
              THEN now() + make_interval(secs => ${windowSeconds})
            ELSE "rate_limits"."resetAt"
          END
      RETURNING "count", "resetAt"
    `;
    return rows[0] ?? null;
  } catch (err) {
    console.error("[rate-limit] counter unavailable:", err);
    return null;
  }
}

function blocked(limit: number, resetAt: Date): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(resetAt.getTime()),
      },
    },
  );
}

function unavailable(): NextResponse {
  return NextResponse.json(
    {
      error: "This lookup is temporarily unavailable. Please try again shortly.",
      code: "LIMIT_UNAVAILABLE",
    },
    { status: 503 },
  );
}
