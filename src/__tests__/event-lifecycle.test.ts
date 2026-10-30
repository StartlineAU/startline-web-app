import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    event: {
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  effectiveEventStatus,
  isPubliclyDiscoverable,
  publicDiscoveryWhere,
  refreshEventLifecycle,
  registrationOpenAt,
  transitionDueEvents,
} from "@/lib/event-lifecycle";

const event = (over: Record<string, unknown> = {}) => ({
  status: "APPROVED",
  startsAtUtc: "2026-10-30T00:00:00.000Z",
  endsAtUtc: "2026-10-30T02:00:00.000Z",
  ...over,
});

const at = (value: string) => new Date(value);

describe("effective event status", () => {
  it("is approved before the start", () => {
    expect(effectiveEventStatus(event(), at("2026-10-29T23:59:59.000Z"))).toBe("APPROVED");
  });

  it("is in progress at the start and until the end", () => {
    expect(effectiveEventStatus(event(), at("2026-10-30T00:00:00.000Z"))).toBe("IN_PROGRESS");
    expect(effectiveEventStatus(event(), at("2026-10-30T01:59:59.000Z"))).toBe("IN_PROGRESS");
  });

  it("is archived at the end", () => {
    expect(effectiveEventStatus(event(), at("2026-10-30T02:00:00.000Z"))).toBe("ARCHIVED");
  });

  it("leaves draft, pending, rejected and archived states alone", () => {
    for (const status of ["DRAFT", "PENDING", "REJECTED", "ARCHIVED"]) {
      expect(effectiveEventStatus(event({ status }), at("2030-01-01T00:00:00.000Z")))
        .toBe(status);
    }
  });

  it("treats a multi-day event as in progress through its end date", () => {
    const multiDay = event({
      startsAtUtc: "2026-10-30T00:00:00.000Z",
      endsAtUtc: "2026-11-01T02:00:00.000Z",
    });
    expect(effectiveEventStatus(multiDay, at("2026-10-31T12:00:00.000Z")))
      .toBe("IN_PROGRESS");
  });
});

describe("registration and discovery rules", () => {
  it("closes registration when the event starts", () => {
    expect(registrationOpenAt(event(), at("2026-10-29T23:59:59.000Z"))).toBe(true);
    expect(registrationOpenAt(event(), at("2026-10-30T00:00:00.000Z"))).toBe(false);
  });

  it("keeps a running event discoverable but hides it once it ends", () => {
    expect(isPubliclyDiscoverable(event(), at("2026-10-30T01:00:00.000Z"))).toBe(true);
    expect(isPubliclyDiscoverable(event(), at("2026-10-30T02:00:00.000Z"))).toBe(false);
  });

  it("builds a public where clause that cannot surface an expired row", () => {
    const now = at("2026-10-30T00:00:00.000Z");
    expect(publicDiscoveryWhere(now)).toEqual({
      status: { in: ["APPROVED", "IN_PROGRESS"] },
      endsAtUtc: { gt: now },
    });
  });
});

describe("persisting transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUnique.mockResolvedValue(event());
    mocks.transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  });

  it("archives finished events and starts due events in one transaction", async () => {
    const now = at("2026-10-30T00:00:00.000Z");
    const result = await transitionDueEvents(now);

    expect(result).toEqual({ archived: 1, started: 1 });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ endsAtUtc: { lte: now } }),
      data: { status: "ARCHIVED" },
    }));
    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ status: "APPROVED", startsAtUtc: { lte: now } }),
      data: { status: "IN_PROGRESS" },
    }));
  });

  it("refreshes one event only when its effective status changed", async () => {
    mocks.findUnique.mockResolvedValue(event({ status: "APPROVED" }));

    await refreshEventLifecycle("evt-1", at("2026-10-30T00:30:00.000Z"));

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "evt-1", status: "APPROVED" },
      data: { status: "IN_PROGRESS" },
    });
  });

  it("does not write when the event is already in the right state", async () => {
    mocks.findUnique.mockResolvedValue(event({ status: "IN_PROGRESS" }));

    await refreshEventLifecycle("evt-1", at("2026-10-30T00:30:00.000Z"));

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
