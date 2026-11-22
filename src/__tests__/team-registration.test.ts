import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  eventFindUnique: vi.fn(),
  registrationCount: vi.fn(),
  registrationGroupBy: vi.fn(),
  registrationFindFirst: vi.fn(),
  registrationFindMany: vi.fn(),
  registrationCreateMany: vi.fn(),
  teamFindMany: vi.fn(),
  teamCreate: vi.fn(),
  userUpsert: vi.fn(),
  notificationCreate: vi.fn(),
  paymentIntentCreate: vi.fn(),
  registrationFindUnique: vi.fn(),
  userNotificationCreate: vi.fn(),
  executeRaw: vi.fn(async (_sql: TemplateStringsArray, ..._values: unknown[]) => 0),
}));

const prismaMock = vi.hoisted(() => {
  const client = {
    event: { findUnique: mocks.eventFindUnique },
    registration: {
      count: mocks.registrationCount,
      groupBy: mocks.registrationGroupBy,
      findFirst: mocks.registrationFindFirst,
      findMany: mocks.registrationFindMany,
      createMany: mocks.registrationCreateMany,
      findUnique: mocks.registrationFindUnique,
    },
    userNotification: { create: mocks.userNotificationCreate },
    team: { findMany: mocks.teamFindMany, create: mocks.teamCreate },
    user: { upsert: mocks.userUpsert, findMany: async () => [] },
    organiserBlock: { findFirst: async () => null },
    organiser: { findUnique: async () => ({ notifyNewRegistration: true }) },
    notification: { create: mocks.notificationCreate },
    $transaction: (fn: (tx: unknown) => unknown) => fn(client),
    // The per-event advisory lock the confirm transaction takes first.
    $executeRaw: mocks.executeRaw,
  };
  return client;
});

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/turnstile", () => ({ assertTurnstile: async () => null }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));
vi.mock("@/lib/amplify-server", () => ({ getUserSession: async () => mocks.session() }));
vi.mock("@/lib/athlete-accounts", () => ({ ensureAthleteCognitoUser: async () => "cognito-sub-1" }));
vi.mock("@/lib/email", () => ({
  sendRegistrationConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendTeamDetailsNeededEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ paymentIntents: { create: mocks.paymentIntentCreate } }),
}));

import { POST as registerFree } from "@/app/api/registrations/free/route";
import { POST as registerFreeRsvp } from "@/app/api/registrations/free/rsvp/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { sendRegistrationConfirmationEmail, sendTeamDetailsNeededEmail } from "@/lib/email";

const person = (n: number, over: Record<string, unknown> = {}) => ({
  firstName: `Member${n}`,
  lastName: "Smith",
  dateOfBirth: "1990-01-01",
  gender: "female",
  email: `member${n}@example.com`,
  mobile: "0400000000",
  emergencyContactName: "Sam Reed",
  emergencyContactPhone: "0400000001",
  medicalNotes: "",
  estimatedFinish: "",
  waiverAccepted: true,
  ...over,
});

const teamEvent = (over: Record<string, unknown> = {}) => ({
  id: "evt-team",
  title: "Coastal Relay",
  status: "APPROVED",
  feeStructure: "athlete",
  registrationType: "startline",
  waves: [
    { label: "Solo", price: "40" },
    { label: "Pairs", price: "50", teamSize: 2, qty: 3 },
  ],
  cap: null,
  eventDate: "2026-12-01",
  startTime: "07:00",
  venue: "Beach",
  city: "Sydney",
  state: "NSW",
  organiser: { id: "org-1", stripeAccountId: "acct_1", stripeOnboardingComplete: true },
  ...over,
});

const post = (handler: (req: NextRequest) => Promise<Response>, path: string, body: unknown) =>
  handler(new NextRequest(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body) }));

const pairOrder = (over: Record<string, unknown> = {}) => ({
  eventId: "evt-team",
  // The free path refuses an order without it; checkout ignores it.
  acceptedTerms: true,
  teams: [{ name: "Fast Feet" }],
  participants: [
    { ...person(1), waveLabel: "Pairs", team: 0 },
    { ...person(2), waveLabel: "Pairs", team: 0 },
  ],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockReturnValue(null);
  mocks.registrationCount.mockResolvedValue(0);
  mocks.registrationGroupBy.mockResolvedValue([]);
  mocks.registrationFindFirst.mockResolvedValue(null);
  mocks.registrationFindMany.mockResolvedValue([]);
  mocks.registrationCreateMany.mockResolvedValue({ count: 2 });
  mocks.teamFindMany.mockResolvedValue([]);
  mocks.teamCreate.mockResolvedValue({});
  mocks.userUpsert.mockResolvedValue({ id: "user-1" });
  mocks.notificationCreate.mockResolvedValue({});
  mocks.paymentIntentCreate.mockResolvedValue({ id: "pi_1", client_secret: "cs_1" });
  mocks.registrationFindUnique.mockResolvedValue({ userId: "user-1" });
  mocks.userNotificationCreate.mockResolvedValue({});
});

describe("team checkout (#541)", () => {
  it("charges the per-person price for every member and carries the team to the webhook", async () => {
    mocks.eventFindUnique.mockResolvedValue(teamEvent());
    const res = await post(checkout, "/api/checkout", pairOrder());
    expect(res.status).toBe(200);

    const args = mocks.paymentIntentCreate.mock.calls[0][0];
    // $50 per person, plus the athlete-paid fee (3.95% + $1.45) per person.
    const perPerson = 5000 + Math.round(5000 * 0.0395) + 145;
    expect(args.amount).toBe(perPerson * 2);
    expect(JSON.parse(args.metadata.teams)).toEqual(["Fast Feet"]);
    expect(JSON.parse(args.metadata.participant0).tm).toBe(0);
    expect(JSON.parse(args.metadata.participant1).tm).toBe(0);
  });

  it("refuses a team with the wrong number of members", async () => {
    mocks.eventFindUnique.mockResolvedValue(teamEvent());
    const res = await post(checkout, "/api/checkout", pairOrder({
      participants: [{ ...person(1), waveLabel: "Pairs", team: 0 }],
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/exactly 2 members/);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("refuses a team-ticket entry with no team", async () => {
    mocks.eventFindUnique.mockResolvedValue(teamEvent());
    const res = await post(checkout, "/api/checkout", {
      eventId: "evt-team",
      participants: [{ ...person(1), waveLabel: "Pairs" }, { ...person(2), waveLabel: "Pairs" }],
    });
    expect(res.status).toBe(400);
  });

  it("counts a team tier's quantity in teams", async () => {
    mocks.eventFindUnique.mockResolvedValue(teamEvent());
    // Three pairs already in: two members each for t1 and t2, one left on t3.
    mocks.registrationGroupBy.mockResolvedValue([
      { waveLabel: "Pairs", teamId: "t1", _count: { _all: 2 } },
      { waveLabel: "Pairs", teamId: "t2", _count: { _all: 2 } },
      { waveLabel: "Pairs", teamId: "t3", _count: { _all: 1 } },
    ]);
    const res = await post(checkout, "/api/checkout", pairOrder());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('"Pairs" is sold out.');
  });

  it("refuses a team name already entered in the event", async () => {
    mocks.eventFindUnique.mockResolvedValue(teamEvent());
    mocks.teamFindMany.mockResolvedValue([{ name: "fast feet" }]);
    const res = await post(checkout, "/api/checkout", pairOrder());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already entered/);
  });
});

describe("free team registration (#541)", () => {
  const freeTeamEvent = () =>
    teamEvent({
      waves: [{ label: "Pairs", price: "0", teamSize: 2 }],
      organiser: { id: "org-1", stripeAccountId: null, stripeOnboardingComplete: false },
    });

  it("writes the team and links each member to it, the first as captain", async () => {
    mocks.eventFindUnique.mockResolvedValue(freeTeamEvent());
    const res = await post(registerFree, "/api/registrations/free", pairOrder());
    expect(res.status).toBe(200);

    const team = mocks.teamCreate.mock.calls[0][0].data;
    expect(team).toMatchObject({ eventId: "evt-team", name: "Fast Feet", ticketLabel: "Pairs", size: 2 });

    const rows = mocks.registrationCreateMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0].teamId).toBe(team.id);
    expect(rows[1].teamId).toBe(team.id);
    expect(team.captainRegistrationId).toBe(rows[0].id);

    // Every member gets a receipt that names the team.
    const emails = vi.mocked(sendRegistrationConfirmationEmail).mock.calls;
    expect(emails).toHaveLength(2);
    expect(emails[0][1].team).toBe("Fast Feet (team of 2)");
  });

  it("locks the event before checking team names and capacity", async () => {
    mocks.eventFindUnique.mockResolvedValue(freeTeamEvent());
    const res = await post(registerFree, "/api/registrations/free", pairOrder());
    expect(res.status).toBe(200);

    // Two confirms for one event must not both pass the name and capacity
    // checks, so the lock is the first thing the transaction does.
    expect(mocks.executeRaw).toHaveBeenCalled();
    const sql = mocks.executeRaw.mock.calls[0][0].join("?");
    expect(sql).toMatch(/pg_advisory_xact_lock/);
    // The order resolver checks names once up front, outside the transaction;
    // the authoritative check is the last one, and it runs under the lock.
    const nameChecks = mocks.teamFindMany.mock.invocationCallOrder;
    expect(mocks.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(nameChecks[nameChecks.length - 1]);
    expect(mocks.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.registrationCreateMany.mock.invocationCallOrder[0],
    );
  });

  it("does not offer a one-tap RSVP for a team ticket", async () => {
    mocks.session.mockReturnValue({ sub: "user-1", email: "a@example.com", name: "A" });
    mocks.eventFindUnique.mockResolvedValue(freeTeamEvent());
    const res = await post(registerFreeRsvp, "/api/registrations/free/rsvp", {
      eventId: "evt-team",
      waveLabel: "Pairs",
      acceptedTerms: true,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/standard registration/);
  });
});

describe("team members added later (#541)", () => {
  /** A blank teammate the buyer will name from Activity. */
  const later = { ...person(0), firstName: "", lastName: "", email: "", dateOfBirth: "", mobile: "", emergencyContactName: "", emergencyContactPhone: "", detailsLater: true };

  it("writes the teammate as a pending place on the buyer's email", async () => {
    mocks.eventFindUnique.mockResolvedValue(teamEvent({ waves: [{ label: "Pairs", price: "0", teamSize: 2 }] }));
    const res = await post(registerFree, "/api/registrations/free", pairOrder({
      participants: [
        { ...person(1), waveLabel: "Pairs", team: 0 },
        { ...later, waveLabel: "Pairs", team: 0 },
      ],
    }));
    expect(res.status).toBe(200);

    const rows = mocks.registrationCreateMany.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({ athleteName: "Member1 Smith", athleteEmail: "member1@example.com" });
    expect(rows[1]).toMatchObject({
      athleteName: "Team member 2",
      athleteEmail: "member1@example.com",
      detailsPending: true,
    });
    expect(rows[1].firstName).toBeUndefined();
    expect(rows[1].dateOfBirth).toBeUndefined();
  });

  it("confirms only the named member and asks the buyer for the rest", async () => {
    mocks.eventFindUnique.mockResolvedValue(teamEvent({ waves: [{ label: "Pairs", price: "0", teamSize: 2 }] }));
    await post(registerFree, "/api/registrations/free", pairOrder({
      participants: [
        { ...person(1), waveLabel: "Pairs", team: 0 },
        { ...later, waveLabel: "Pairs", team: 0 },
      ],
    }));

    expect(vi.mocked(sendRegistrationConfirmationEmail)).toHaveBeenCalledTimes(1);
    const [to, data] = vi.mocked(sendTeamDetailsNeededEmail).mock.calls[0];
    expect(to).toBe("member1@example.com");
    expect(data.teams).toEqual([{ name: "Fast Feet", size: 2, missing: 1 }]);
    expect(mocks.userNotificationCreate.mock.calls[0][0].data).toMatchObject({
      userId: "user-1",
      type: "TEAM_DETAILS_NEEDED",
    });
  });

  it("refuses to leave a team's first member for later", async () => {
    mocks.eventFindUnique.mockResolvedValue(teamEvent());
    const res = await post(checkout, "/api/checkout", pairOrder({
      participants: [
        { ...person(1), waveLabel: "Solo" },
        { ...later, waveLabel: "Pairs", team: 0 },
        { ...person(2), waveLabel: "Pairs", team: 0 },
      ],
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/first member/);
  });

  it("refuses an individual ticket with no details", async () => {
    mocks.eventFindUnique.mockResolvedValue(teamEvent());
    const res = await post(checkout, "/api/checkout", pairOrder({
      teams: [],
      participants: [
        { ...person(1), waveLabel: "Solo" },
        { ...later, waveLabel: "Solo" },
      ],
    }));
    expect(res.status).toBe(400);
  });

  it("marks a later teammate in the PaymentIntent metadata without their details", async () => {
    mocks.eventFindUnique.mockResolvedValue(teamEvent());
    const res = await post(checkout, "/api/checkout", pairOrder({
      participants: [
        { ...person(1), waveLabel: "Pairs", team: 0 },
        { ...later, waveLabel: "Pairs", team: 0, firstName: "Typed" },
      ],
    }));
    expect(res.status).toBe(200);
    const metadata = mocks.paymentIntentCreate.mock.calls[0][0].metadata;
    const second = JSON.parse(metadata.participant1);
    expect(second).toMatchObject({ pnd: 1, tm: 0, em: "member1@example.com", fn: "" });
  });
});
