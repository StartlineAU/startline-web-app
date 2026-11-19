import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ eventFindUnique: vi.fn(), reviewGroupBy: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  default: {
    event: { findUnique: mocks.eventFindUnique },
    review: { groupBy: mocks.reviewGroupBy },
  },
}));

import { loadAthleteTicket, toTicketEntry } from "@/lib/athlete-ticket";

const session = { sub: "user-1", email: "Harper@Example.com", name: "Harper" };

const row = {
  id: "reg-1",
  athleteName: "Harper Jones",
  status: "CONFIRMED",
  waveLabel: "Sprint",
  startWaveLabel: null,
  bibNumber: "104",
  checkedInAt: null,
  startWave: null,
};

function eventWith(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    title: "Noosa Triathlon",
    discipline: "triathlon",
    status: "APPROVED",
    eventDate: "2026-10-31",
    endDate: null,
    startTime: "06:00",
    endTime: "16:00",
    timeZone: "Australia/Brisbane",
    venue: "Noosa Main Beach",
    address: null,
    city: "Noosa",
    state: "qld",
    coverImageUrl: null,
    showContactName: null,
    showContactEmail: null,
    showContactPhone: null,
    organiser: {
      id: "org-1", orgName: "Coastal", logoUrl: null,
      contactName: "Jade Nguyen", contactEmail: "hello@coastal.test", phone: "0400 111 222",
      showContactName: true, showContactEmail: true, showContactPhone: false,
    },
    registrations: [row],
    announcements: [],
    ...overrides,
  };
}

describe("toTicketEntry", () => {
  it("takes the wave and its start time from the StartWave row", () => {
    const entry = toTicketEntry(
      { ...row, startWaveLabel: "Old label", startWave: { label: "Wave A", startTime: "06:20" } },
      "06:00",
    );
    expect(entry).toMatchObject({ waveLabel: "Wave A", waveStartTime: "06:20", ticketLabel: "Sprint" });
  });

  it("falls back to the denormalised label and the event start", () => {
    const entry = toTicketEntry({ ...row, startWaveLabel: "Wave B" }, "06:00");
    expect(entry).toMatchObject({ waveLabel: "Wave B", waveStartTime: "06:00" });
  });

  it("has no start time while no wave is assigned", () => {
    const entry = toTicketEntry(row, "06:00");
    expect(entry).toMatchObject({ waveLabel: null, waveStartTime: null });
  });
});

describe("loadAthleteTicket", () => {
  beforeEach(() => {
    mocks.eventFindUnique.mockReset();
    mocks.reviewGroupBy.mockReset().mockResolvedValue([]);
  });

  it("carries only the contact details the organiser shows, and no raw columns", async () => {
    mocks.eventFindUnique.mockResolvedValue(eventWith({ showContactEmail: false }));
    const ticket = await loadAthleteTicket(session, "evt-1");

    expect(ticket?.event.organiser.contact).toEqual({ name: "Jade Nguyen", email: null, phone: null });
    // Hidden details must not travel to the browser under any other key.
    const json = JSON.stringify(ticket);
    expect(json).not.toContain("hello@coastal.test");
    expect(json).not.toContain("0400 111 222");
    expect(json).not.toContain("showContact");
  });

  it("carries the organiser's published rating, or null before any review", async () => {
    mocks.eventFindUnique.mockResolvedValue(eventWith());
    expect((await loadAthleteTicket(session, "evt-1"))?.event.organiser.rating).toBeNull();

    mocks.reviewGroupBy.mockResolvedValue([
      { organiserId: "org-1", _avg: { overallRating: 4.6 }, _count: { _all: 7 } },
    ]);
    const ticket = await loadAthleteTicket(session, "evt-1");
    expect(ticket?.event.organiser.rating).toEqual({ average: 4.6, count: 7 });
    expect(mocks.reviewGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true, organiserId: { in: ["org-1"] } } }),
    );
  });

  it("only reads the athlete's own entries, by account or email", async () => {
    mocks.eventFindUnique.mockResolvedValue(eventWith());
    await loadAthleteTicket(session, "evt-1");

    const where = mocks.eventFindUnique.mock.calls[0][0].select.registrations.where;
    expect(where.OR).toEqual([
      { userId: "user-1" },
      { athleteEmail: { equals: "Harper@Example.com", mode: "insensitive" } },
    ]);
    expect(where.status.in).not.toContain("CANCELLED");
  });

  it("returns null when the athlete holds no entry for the event", async () => {
    mocks.eventFindUnique.mockResolvedValue(eventWith({ registrations: [] }));
    expect(await loadAthleteTicket(session, "evt-1")).toBeNull();
  });

  it("returns null for an unknown event", async () => {
    mocks.eventFindUnique.mockResolvedValue(null);
    expect(await loadAthleteTicket(session, "nope")).toBeNull();
  });

  it("sanitises announcement bodies on the way out", async () => {
    mocks.eventFindUnique.mockResolvedValue(
      eventWith({
        announcements: [{
          id: "a-1",
          title: "Parking",
          body: '<p>Use lot B</p><script>alert(1)</script><img src=x onerror="alert(1)">',
          createdAt: new Date("2026-10-30T00:00:00Z"),
        }],
      }),
    );
    const ticket = await loadAthleteTicket(session, "evt-1");
    expect(ticket?.announcements[0].bodyHtml).toBe("<p>Use lot B</p>");
    expect(ticket?.entries).toHaveLength(1);
    expect(ticket?.event).not.toHaveProperty("registrations");
  });
});
