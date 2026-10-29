import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  syncEventSchedules: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    event: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/event-scheduler", () => ({
  syncEventSchedules: mocks.syncEventSchedules,
}));

import { POST } from "@/app/api/internal/events/lifecycle/route";

const SECRET = "test-lifecycle-secret";

const request = (query = "sweep=1", secret: string | null = SECRET) =>
  POST(new NextRequest(`http://localhost/api/internal/events/lifecycle?${query}`, {
    method: "POST",
    headers: secret == null ? {} : { "x-event-lifecycle-secret": secret },
  }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EVENT_LIFECYCLE_SECRET = SECRET;
  mocks.findMany.mockResolvedValue([
    {
      id: "evt-1",
      status: "APPROVED",
      startsAtUtc: new Date("2026-10-30T00:00:00.000Z"),
      endsAtUtc: new Date("2026-10-30T02:00:00.000Z"),
    },
  ]);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  mocks.syncEventSchedules.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.EVENT_LIFECYCLE_SECRET;
});

describe("POST /api/internal/events/lifecycle", () => {
  it("rejects a request without the shared secret", async () => {
    const res = await request("sweep=1", null);
    expect(res.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const res = await request("sweep=1", "wrong");
    expect(res.status).toBe(401);
  });

  it("advances due transitions and reconciles live schedules", async () => {
    const res = await request();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ checked: 1, archived: 1, started: 1, scheduleFailures: 0 });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.syncEventSchedules).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt-1" }),
      expect.any(Date),
    );
  });

  it("refreshes a targeted event without running the full sweep", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "evt-1",
      status: "IN_PROGRESS",
      startsAtUtc: new Date("2026-10-30T00:00:00.000Z"),
      endsAtUtc: new Date("2026-10-30T02:00:00.000Z"),
    });

    const res = await request("eventId=evt-1");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.findUnique).toHaveBeenCalled();
    expect(body).toMatchObject({ checked: 1, archived: 0, started: 0 });
  });
});
