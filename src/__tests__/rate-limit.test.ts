import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: { $queryRaw: vi.fn() },
}));

import prisma from "@/lib/prisma";
import { rateLimit, rateLimitPaid, BILLABLE_LOOKUP_BUDGET } from "@/lib/rate-limit";

const queryRaw = prisma.$queryRaw as ReturnType<typeof vi.fn>;

function makeRequest(forwardedFor = "203.0.113.9") {
  return new NextRequest("http://localhost:3000/api/contact", {
    headers: { "x-forwarded-for": forwardedFor },
  });
}

describe("rateLimit", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 429 with Retry-After and X-RateLimit-* headers when blocked", async () => {
    const resetAt = new Date(Date.now() + 30_000);
    queryRaw.mockResolvedValue([{ count: 4, resetAt }]);

    const res = await rateLimit(makeRequest(), { prefix: "contact", limit: 3, windowSeconds: 60 });

    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("30");
    expect(res?.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(res?.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("lets requests through under the limit", async () => {
    queryRaw.mockResolvedValue([{ count: 2, resetAt: new Date() }]);

    const res = await rateLimit(makeRequest(), { prefix: "contact", limit: 3, windowSeconds: 60 });

    expect(res).toBeNull();
  });

  it("fails open when the database is unreachable", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));

    const res = await rateLimit(makeRequest(), { prefix: "contact", limit: 3, windowSeconds: 60 });

    expect(res).toBeNull();
  });

  it("keys the default counter on the nearest forwarded hop, not the caller-supplied first one", async () => {
    queryRaw.mockResolvedValue([{ count: 1, resetAt: new Date() }]);

    await rateLimit(makeRequest("203.0.113.9, 198.51.100.7"), {
      prefix: "contact",
      limit: 3,
      windowSeconds: 60,
    });

    expect(queryRaw.mock.calls[0][1]).toBe("contact:198.51.100.7");
  });
});

describe("rateLimitPaid", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails closed instead of spending when the counter is unavailable", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));

    const res = await rateLimitPaid(makeRequest(), {
      prefix: "places-geocode",
      limit: 30,
      windowSeconds: 60,
    });

    expect(res?.status).toBe(503);
    expect((await res?.json())?.code).toBe("LIMIT_UNAVAILABLE");
  });

  it("blocks on the shared budget even when this caller is under its own limit", async () => {
    const resetAt = new Date(Date.now() + 20_000);
    queryRaw
      .mockResolvedValueOnce([{ count: 1, resetAt }])
      .mockResolvedValueOnce([{ count: BILLABLE_LOOKUP_BUDGET.limit + 1, resetAt }]);

    const res = await rateLimitPaid(makeRequest(), {
      prefix: "places-geocode",
      limit: 30,
      windowSeconds: 60,
    });

    expect(res?.status).toBe(429);
    expect(res?.headers.get("X-RateLimit-Limit")).toBe(String(BILLABLE_LOOKUP_BUDGET.limit));
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("increments a shared counter independent of the caller", async () => {
    queryRaw.mockResolvedValue([{ count: 1, resetAt: new Date() }]);

    await rateLimitPaid(makeRequest("203.0.113.9"), {
      prefix: "places-geocode",
      limit: 30,
      windowSeconds: 60,
    });

    expect(queryRaw.mock.calls[1][1]).toBe(`${BILLABLE_LOOKUP_BUDGET.prefix}:all`);
  });
});
