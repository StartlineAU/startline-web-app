import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registrationFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    registration: { findUnique: mocks.registrationFindUnique },
    user: { findUnique: mocks.userFindUnique, findFirst: mocks.userFindFirst },
  },
}));

import { getRaceSummary } from "@/lib/race-summary";

const NOW = new Date("2027-04-01T00:00:00Z").getTime();

const harper = { id: "user-harper", username: "harperj", name: "Harper Jones", isPublic: true };

function entry(overrides: Record<string, unknown> = {}, event: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    status: "CONFIRMED",
    userId: "user-harper",
    athleteUserId: "user-harper",
    athleteName: "Harper Jones",
    athleteEmail: "harper@startline.test",
    detailsPending: false,
    resultTime: "00:48:22",
    resultPlacement: "43rd",
    resultDistance: "10K",
    isPersonalBest: true,
    isTopResult: false,
    startWaveLabel: "Wave 2",
    waveLabel: "General",
    bibNumber: "1042",
    team: null,
    event: {
      id: "evt-1",
      slug: "harbour-10k",
      title: "Harbour 10K",
      discipline: "running",
      eventDate: "2027-03-21",
      venue: "Barangaroo Reserve",
      city: "Sydney",
      state: "nsw",
      coverImageUrl: null,
      status: "ARCHIVED",
      startsAtUtc: new Date("2027-03-20T20:00:00Z"),
      endsAtUtc: new Date("2027-03-20T23:00:00Z"),
      organiser: { id: "org-1", orgName: "Apex", logoUrl: null },
      ...event,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.registrationFindUnique.mockResolvedValue(entry());
  mocks.userFindUnique.mockResolvedValue(harper);
  mocks.userFindFirst.mockResolvedValue(null);
});

describe("getRaceSummary", () => {
  it("shows the owner their race with their name", async () => {
    const result = await getRaceSummary("reg-1", "user-harper", NOW);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.summary).toMatchObject({
      isOwner: true,
      athleteLabel: "Harper Jones",
      resultTime: "00:48:22",
      resultPlacement: "43rd",
      wave: "Wave 2",
      bibNumber: "1042",
    });
    // The lifecycle columns stay on the server.
    expect(result.summary.event).not.toHaveProperty("status");
  });

  it("shows a public profile's race to anyone, under the handle only", async () => {
    const result = await getRaceSummary("reg-1", null, NOW);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.summary.isOwner).toBe(false);
    expect(result.summary.athleteLabel).toBe("harperj");
    // Not on the public profile, so not here either.
    expect(result.summary.bibNumber).toBeNull();
    expect(result.summary.teamName).toBeNull();
  });

  it("hides a private profile's race from everyone but its owner", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...harper, isPublic: false });
    expect((await getRaceSummary("reg-1", "someone-else", NOW)).kind).toBe("not_found");
    expect((await getRaceSummary("reg-1", "user-harper", NOW)).kind).toBe("ok");
  });

  it("does not treat the buyer of someone else's ticket as the athlete", async () => {
    // Harper bought a ticket for a friend with no account.
    mocks.registrationFindUnique.mockResolvedValue(
      entry({ athleteUserId: null, athleteName: "Friend", athleteEmail: "friend@x.test" }),
    );
    expect((await getRaceSummary("reg-1", "user-harper", NOW)).kind).toBe("not_found");
  });

  it("does not treat a buyer's unmarked purchase on their own email as their race", async () => {
    // A child entered on the parent's address, not marked as the parent's.
    mocks.registrationFindUnique.mockResolvedValue(entry({ athleteUserId: null, athleteName: "Child" }));
    mocks.userFindFirst.mockResolvedValue(harper);
    expect((await getRaceSummary("reg-1", "user-harper", NOW)).kind).toBe("not_found");
  });

  it("finds the athlete by email when a friend bought the entry", async () => {
    mocks.registrationFindUnique.mockResolvedValue(entry({ athleteUserId: null, userId: "user-buyer" }));
    mocks.userFindFirst.mockResolvedValue(harper);
    const result = await getRaceSummary("reg-1", "user-harper", NOW);
    expect(result.kind).toBe("ok");
    expect(mocks.userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: "harper@startline.test", mode: "insensitive" } } }),
    );
  });

  it("ignores a team place whose details are still pending", async () => {
    mocks.registrationFindUnique.mockResolvedValue(
      entry({ athleteUserId: null, userId: "user-buyer", detailsPending: true }),
    );
    mocks.userFindFirst.mockResolvedValue(harper);
    expect((await getRaceSummary("reg-1", "user-harper", NOW)).kind).toBe("not_found");
  });

  it("sends a race that has not happened yet to the event page", async () => {
    mocks.registrationFindUnique.mockResolvedValue(
      entry({}, {
        status: "APPROVED",
        startsAtUtc: new Date("2027-05-01T00:00:00Z"),
        endsAtUtc: new Date("2027-05-01T03:00:00Z"),
      }),
    );
    expect(await getRaceSummary("reg-1", "user-harper", NOW)).toEqual({
      kind: "not_finished",
      eventPath: "/events/harbour-10k",
    });
  });

  it("does not give a cancelled event a race summary", async () => {
    mocks.registrationFindUnique.mockResolvedValue(entry({}, { status: "CANCELLED" }));
    expect((await getRaceSummary("reg-1", "user-harper", NOW)).kind).toBe("not_finished");
  });

  it("treats an entry that is no longer confirmed as missing", async () => {
    mocks.registrationFindUnique.mockResolvedValue(entry({ status: "REFUNDED" }));
    expect((await getRaceSummary("reg-1", "user-harper", NOW)).kind).toBe("not_found");
  });

  it("uses the team's bib for a team member", async () => {
    mocks.registrationFindUnique.mockResolvedValue(
      entry({ bibNumber: null, team: { name: "Fast Feet", bibNumber: "T12" } }),
    );
    const result = await getRaceSummary("reg-1", "user-harper", NOW);
    if (result.kind !== "ok") throw new Error(result.kind);
    expect(result.summary).toMatchObject({ bibNumber: "T12", teamName: "Fast Feet" });
  });
});
