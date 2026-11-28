import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFindMany: vi.fn(),
  eventFindUnique: vi.fn(),
  eventUpdateMany: vi.fn(),
  registrationCount: vi.fn(),
  notificationCreate: vi.fn(),
  transaction: vi.fn(),
  sendEventFinishedEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    event: {
      findMany: mocks.eventFindMany,
      findUnique: mocks.eventFindUnique,
      updateMany: mocks.eventUpdateMany,
    },
    registration: { count: mocks.registrationCount },
    notification: { create: mocks.notificationCreate },
    $transaction: mocks.transaction,
  };
  return { default: client };
});

vi.mock("@/lib/email", () => ({ sendEventFinishedEmail: mocks.sendEventFinishedEmail }));

import prisma from "@/lib/prisma";
import {
  FINISHED_NOTICE_WINDOW_MS,
  eventFinishedNotice,
  finishedRecently,
  notifyEventFinished,
  notifyFinishedEvents,
} from "@/lib/notify-event-finished";

const NOW = new Date("2027-03-21T03:00:00Z");

const organiser = (overrides: Record<string, unknown> = {}) => ({
  notifyEventApproved: true,
  notifyEventRejected: true,
  notifyNewRegistration: true,
  notifyEventFinished: true,
  email: "owner@apex.test",
  contactEmail: "hello@apex.test",
  notifyManagers: true,
  pendingClaim: false,
  members: [],
  ...overrides,
});

const finishedEvent = (overrides: Record<string, unknown> = {}) => ({
  id: "evt-1",
  title: "Harbour 10K",
  status: "ARCHIVED",
  endsAtUtc: new Date("2027-03-21T01:00:00Z"),
  finishedNotifiedAt: null,
  organiserId: "org-1",
  organiser: organiser(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventFindUnique.mockResolvedValue(finishedEvent());
  mocks.eventUpdateMany.mockResolvedValue({ count: 1 });
  // The transaction runs its callback against the same client.
  mocks.transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  // entries, checked in, with results
  mocks.registrationCount
    .mockResolvedValueOnce(120)
    .mockResolvedValueOnce(104)
    .mockResolvedValueOnce(0);
  mocks.notificationCreate.mockResolvedValue({});
  mocks.sendEventFinishedEmail.mockResolvedValue(undefined);
});

describe("eventFinishedNotice", () => {
  it("reports turnout and asks for results", () => {
    const { title, body } = eventFinishedNotice("Harbour 10K", { entries: 120, checkedIn: 104, withResults: 0 });
    expect(title).toBe("Event finished");
    expect(body).toBe(
      '"Harbour 10K" has finished. 120 athletes entered and 104 checked in. Post results so athletes see their time and placing on their profile.',
    );
  });

  it("leaves out check-in when it was not used", () => {
    const { body } = eventFinishedNotice("Harbour 10K", { entries: 1, checkedIn: 0, withResults: 0 });
    expect(body).toContain("1 athlete entered.");
    expect(body).not.toContain("checked in");
  });

  it("counts partly posted results", () => {
    const { body } = eventFinishedNotice("Harbour 10K", { entries: 40, checkedIn: 0, withResults: 25 });
    expect(body).toContain("Results are posted for 25 of 40.");
  });

  it("says when every result is in", () => {
    const { body } = eventFinishedNotice("Harbour 10K", { entries: 40, checkedIn: 38, withResults: 40 });
    expect(body).toContain("Every result is posted.");
  });

  it("handles an event nobody entered", () => {
    const { body } = eventFinishedNotice("Harbour 10K", { entries: 0, checkedIn: 0, withResults: 0 });
    expect(body).toBe('"Harbour 10K" has finished. Nobody was entered this time.');
  });
});

describe("finishedRecently", () => {
  it("is true inside the window and false after it", () => {
    expect(finishedRecently(new Date(NOW.getTime() - FINISHED_NOTICE_WINDOW_MS), NOW)).toBe(true);
    expect(finishedRecently(new Date(NOW.getTime() - FINISHED_NOTICE_WINDOW_MS - 1), NOW)).toBe(false);
    expect(finishedRecently(null, NOW)).toBe(true);
  });
});

describe("notifyEventFinished", () => {
  it("claims the event, posts a feed entry and emails the organisation", async () => {
    expect(await notifyEventFinished("evt-1", NOW)).toBe(true);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.eventUpdateMany).toHaveBeenCalledWith({
      where: { id: "evt-1", status: "ARCHIVED", finishedNotifiedAt: null },
      data: { finishedNotifiedAt: NOW },
    });
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ organiserId: "org-1", eventId: "evt-1", type: "EVENT_FINISHED" }),
    });
    expect(mocks.sendEventFinishedEmail).toHaveBeenCalledWith(
      ["owner@apex.test", "hello@apex.test"],
      { eventId: "evt-1", eventTitle: "Harbour 10K", entries: 120, checkedIn: 104, withResults: 0 },
    );
  });

  it("sends nothing when the event was already announced", async () => {
    mocks.eventFindUnique.mockResolvedValue(finishedEvent({ finishedNotifiedAt: new Date() }));
    expect(await notifyEventFinished("evt-1", NOW)).toBe(false);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it("sends nothing when another sweep claims it first", async () => {
    mocks.eventUpdateMany.mockResolvedValue({ count: 0 });
    expect(await notifyEventFinished("evt-1", NOW)).toBe(false);
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
    expect(mocks.sendEventFinishedEmail).not.toHaveBeenCalled();
  });

  it("leaves an event that is not finished alone", async () => {
    mocks.eventFindUnique.mockResolvedValue(finishedEvent({ status: "IN_PROGRESS" }));
    expect(await notifyEventFinished("evt-1", NOW)).toBe(false);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("claims but stays silent when the organisation turned it off", async () => {
    mocks.eventFindUnique.mockResolvedValue(finishedEvent({ organiser: organiser({ notifyEventFinished: false }) }));
    expect(await notifyEventFinished("evt-1", NOW)).toBe(false);
    expect(mocks.eventUpdateMany).toHaveBeenCalled();
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
    expect(mocks.sendEventFinishedEmail).not.toHaveBeenCalled();
  });

  it("claims but stays silent for an event that ended days ago", async () => {
    mocks.eventFindUnique.mockResolvedValue(
      finishedEvent({ endsAtUtc: new Date(NOW.getTime() - FINISHED_NOTICE_WINDOW_MS - 60_000) }),
    );
    expect(await notifyEventFinished("evt-1", NOW)).toBe(false);
    expect(mocks.eventUpdateMany).toHaveBeenCalled();
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
    expect(mocks.sendEventFinishedEmail).not.toHaveBeenCalled();
  });

  it("does not email when the feed entry could not be written", async () => {
    mocks.notificationCreate.mockRejectedValue(new Error("db"));
    await expect(notifyEventFinished("evt-1", NOW)).rejects.toThrow("db");
    expect(mocks.sendEventFinishedEmail).not.toHaveBeenCalled();
  });

  it("does not email an organisation nobody has claimed yet", async () => {
    mocks.eventFindUnique.mockResolvedValue(finishedEvent({ organiser: organiser({ pendingClaim: true }) }));
    expect(await notifyEventFinished("evt-1", NOW)).toBe(true);
    expect(mocks.notificationCreate).toHaveBeenCalled();
    expect(mocks.sendEventFinishedEmail).not.toHaveBeenCalled();
  });

  it("keeps the feed entry when the email fails", async () => {
    mocks.sendEventFinishedEmail.mockRejectedValue(new Error("Resend down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await notifyEventFinished("evt-1", NOW)).toBe(true);
    expect(mocks.notificationCreate).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("notifyFinishedEvents", () => {
  it("announces each archived event nobody has been told about", async () => {
    mocks.eventFindMany.mockResolvedValue([{ id: "evt-1" }, { id: "evt-2" }]);
    mocks.eventUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    expect(await notifyFinishedEvents(NOW)).toBe(1);
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ARCHIVED", finishedNotifiedAt: null } }),
    );
  });

  it("carries on past an event that fails", async () => {
    mocks.eventFindMany.mockResolvedValue([{ id: "evt-bad" }, { id: "evt-1" }]);
    mocks.eventFindUnique
      .mockRejectedValueOnce(new Error("db"))
      .mockResolvedValueOnce(finishedEvent());
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await notifyFinishedEvents(NOW)).toBe(1);
    error.mockRestore();
  });
});
