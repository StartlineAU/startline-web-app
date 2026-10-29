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
  userUpsert: vi.fn(),
  notificationCreate: vi.fn(),
  paymentIntentCreate: vi.fn(),
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
    },
    user: { upsert: mocks.userUpsert },
    notification: { create: mocks.notificationCreate },
    // The capacity check and the insert share one transaction; the mock hands
    // the callback the same client so both are observed by the spies above.
    $transaction: (fn: (tx: unknown) => unknown) => fn(client),
  };
  return client;
});

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/turnstile", () => ({ assertTurnstile: async () => null }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));
vi.mock("@/lib/amplify-server", () => ({ getUserSession: async () => mocks.session() }));
vi.mock("@/lib/athlete-accounts", () => ({
  ensureAthleteCognitoUser: async () => "cognito-sub-1",
}));
vi.mock("@/lib/email", () => ({
  sendRegistrationConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ paymentIntents: { create: mocks.paymentIntentCreate } }),
}));

import { POST as registerFree } from "@/app/api/registrations/free/route";
import { POST as registerFreeRsvp } from "@/app/api/registrations/free/rsvp/route";
import { POST as checkout } from "@/app/api/checkout/route";

const participant = (over: Record<string, unknown> = {}) => ({
  firstName: "Jordan",
  lastName: "Clarke",
  dateOfBirth: "1990-01-01",
  gender: "female",
  email: "jordan@example.com",
  mobile: "0400000000",
  emergencyContactName: "Sam Reed",
  emergencyContactPhone: "0400000001",
  medicalNotes: "",
  estimatedFinish: "",
  waiverAccepted: true,
  waveLabel: "General",
  ...over,
});

const freeEvent = (over: Record<string, unknown> = {}) => ({
  id: "evt-free",
  title: "Riverside Parkrun",
  status: "APPROVED",
  feeStructure: "athlete",
  registrationType: "startline",
  waves: [{ label: "General", price: "0" }],
  cap: null,
  eventDate: "2026-12-01",
  startTime: "07:00",
  venue: "Riverside Park",
  city: "Melbourne",
  state: "VIC",
  // Never connected to Stripe: a free event has no money to route anywhere.
  organiser: { id: "org-1", stripeAccountId: null, stripeOnboardingComplete: false },
  ...over,
});

const post = (handler: (req: NextRequest) => Promise<Response>, path: string, body: unknown) =>
  handler(new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  }));

const postFree = (body: unknown) => post(registerFree, "/api/registrations/free", body);
const postRsvp = (body: unknown) => post(registerFreeRsvp, "/api/registrations/free/rsvp", body);
const postCheckout = (body: unknown) => post(checkout, "/api/checkout", body);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockReturnValue(null);
  mocks.registrationCount.mockResolvedValue(0);
  mocks.registrationGroupBy.mockResolvedValue([]);
  mocks.registrationFindFirst.mockResolvedValue(null);
  mocks.registrationFindMany.mockResolvedValue([]);
  mocks.registrationCreateMany.mockResolvedValue({ count: 1 });
  mocks.userUpsert.mockResolvedValue({ id: "user-1" });
  mocks.notificationCreate.mockResolvedValue({});
  mocks.paymentIntentCreate.mockResolvedValue({ id: "pi_1", client_secret: "cs_1" });
});

// Issue #308: a free event could be published but never registered for, because
// registrations were only ever written by the Stripe webhook.
describe("POST /api/registrations/free", () => {
  it("registers an athlete for a free event without charging them", async () => {
    mocks.eventFindUnique.mockResolvedValue(freeEvent());

    const res = await postFree({ eventId: "evt-free", participants: [participant()] });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registrationIds).toHaveLength(1);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();

    const [row] = mocks.registrationCreateMany.mock.calls[0][0].data;
    expect(row).toMatchObject({
      eventId: "evt-free",
      organiserId: "org-1",
      athleteEmail: "jordan@example.com",
      waveLabel: "General",
      amountCents: 0,
      platformFeeCents: 0,
      status: "CONFIRMED",
      stripePaymentIntentId: null,
    });
  });

  it("charges no platform fee under either fee structure", async () => {
    for (const feeStructure of ["athlete", "organiser"]) {
      vi.clearAllMocks();
      mocks.registrationCreateMany.mockResolvedValue({ count: 1 });
      mocks.userUpsert.mockResolvedValue({ id: "user-1" });
      mocks.registrationFindMany.mockResolvedValue([]);
      mocks.eventFindUnique.mockResolvedValue(freeEvent({ feeStructure }));

      const res = await postFree({ eventId: "evt-free", participants: [participant()] });
      expect(res.status).toBe(200);
      const [row] = mocks.registrationCreateMany.mock.calls[0][0].data;
      expect(row.amountCents).toBe(0);
      expect(row.platformFeeCents).toBe(0);
    }
  });

  it("gives a guest an account so the entry shows on Activity", async () => {
    mocks.eventFindUnique.mockResolvedValue(freeEvent());

    await postFree({ eventId: "evt-free", participants: [participant()] });

    expect(mocks.userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "jordan@example.com" } })
    );
    const [row] = mocks.registrationCreateMany.mock.calls[0][0].data;
    expect(row.userId).toBe("user-1");
  });

  it("refuses an order that is not actually free", async () => {
    mocks.eventFindUnique.mockResolvedValue(
      freeEvent({
        waves: [{ label: "General", price: "25" }],
        organiser: { id: "org-1", stripeAccountId: "acct_1", stripeOnboardingComplete: true },
      })
    );

    const res = await postFree({ eventId: "evt-free", participants: [participant()] });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("has to be paid for");
    expect(mocks.registrationCreateMany).not.toHaveBeenCalled();
  });

  it("holds the event cap inside the transaction, not just before it", async () => {
    mocks.eventFindUnique.mockResolvedValue(freeEvent({ cap: 1 }));
    // Room at the pre-check, taken by the time the insert runs.
    mocks.registrationCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    const res = await postFree({ eventId: "evt-free", participants: [participant()] });

    expect(res.status).toBe(409);
    expect(mocks.registrationCreateMany).not.toHaveBeenCalled();
  });

  it("refuses a second entry for someone already registered", async () => {
    mocks.eventFindUnique.mockResolvedValue(freeEvent());
    mocks.registrationFindMany.mockResolvedValue([
      {
        athleteEmail: "Jordan@example.com",
        firstName: "Jordan",
        lastName: "Clarke",
        dateOfBirth: "1990-01-01",
      },
    ]);

    const res = await postFree({ eventId: "evt-free", participants: [participant()] });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("already registered");
    expect(mocks.registrationCreateMany).not.toHaveBeenCalled();
  });

  it("lets one email carry entries for different people", async () => {
    mocks.eventFindUnique.mockResolvedValue(freeEvent());
    mocks.registrationFindMany.mockResolvedValue([
      {
        athleteEmail: "jordan@example.com",
        firstName: "Jordan",
        lastName: "Clarke",
        dateOfBirth: "1990-01-01",
      },
    ]);

    const res = await postFree({
      eventId: "evt-free",
      participants: [participant({ firstName: "Ash", dateOfBirth: "2008-05-04" })],
    });

    expect(res.status).toBe(200);
  });
});

// A free RSVP is a signed-in athlete's entry, so the account is the identity and
// the request carries no participant details at all.
describe("POST /api/registrations/free/rsvp", () => {
  const account = (over: Record<string, unknown> = {}) => ({
    sub: "user-1",
    email: "jordan@example.com",
    name: "Jordan Clarke",
    ...over,
  });

  it("requires a signed-in account", async () => {
    mocks.session.mockReturnValue(null);

    const res = await postRsvp({
      eventId: "evt-free",
      waveLabel: "General",
      acceptedTerms: true,
    });

    expect(res.status).toBe(401);
    expect(mocks.registrationCreateMany).not.toHaveBeenCalled();
  });

  it("requires the terms and waiver to be accepted", async () => {
    mocks.session.mockReturnValue(account());
    mocks.eventFindUnique.mockResolvedValue(freeEvent());

    const res = await postRsvp({
      eventId: "evt-free",
      waveLabel: "General",
      acceptedTerms: false,
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("terms and waiver");
    expect(mocks.registrationCreateMany).not.toHaveBeenCalled();
  });

  it("uses the account name and email for the registration", async () => {
    mocks.session.mockReturnValue(account());
    mocks.eventFindUnique.mockResolvedValue(freeEvent());

    const res = await postRsvp({
      eventId: "evt-free",
      waveLabel: "General",
      acceptedTerms: true,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      participantCount: 1,
      email: "jordan@example.com",
      name: "Jordan Clarke",
    });

    const [row] = mocks.registrationCreateMany.mock.calls[0][0].data;
    expect(row).toMatchObject({
      eventId: "evt-free",
      userId: "user-1",
      athleteName: "Jordan Clarke",
      athleteEmail: "jordan@example.com",
      firstName: "Jordan",
      lastName: "Clarke",
      waveLabel: "General",
      amountCents: 0,
      platformFeeCents: 0,
      waiverAccepted: true,
    });
    expect(mocks.userUpsert).not.toHaveBeenCalled();
  });

  it("falls back to the account email when there is no display name", async () => {
    mocks.session.mockReturnValue(account({ name: null, email: "fallback@example.com" }));
    mocks.eventFindUnique.mockResolvedValue(freeEvent());

    const res = await postRsvp({
      eventId: "evt-free",
      waveLabel: "General",
      acceptedTerms: true,
    });

    expect(res.status).toBe(200);
    const [row] = mocks.registrationCreateMany.mock.calls[0][0].data;
    expect(row.athleteName).toBe("fallback@example.com");
    expect(row.athleteEmail).toBe("fallback@example.com");
  });

  it("refuses a second RSVP for the same account", async () => {
    mocks.session.mockReturnValue(account());
    mocks.eventFindUnique.mockResolvedValue(freeEvent());
    mocks.registrationFindFirst.mockResolvedValue({ id: "existing-registration" });

    const res = await postRsvp({
      eventId: "evt-free",
      waveLabel: "General",
      acceptedTerms: true,
    });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("already registered");
    expect(mocks.registrationCreateMany).not.toHaveBeenCalled();
  });

  it("leaves paid and mixed-price events on the standard registration flow", async () => {
    mocks.session.mockReturnValue(account());
    mocks.eventFindUnique.mockResolvedValue(
      freeEvent({
        waves: [{ label: "General", price: "20" }],
        organiser: { id: "org-1", stripeAccountId: "acct_1", stripeOnboardingComplete: true },
      })
    );

    const res = await postRsvp({
      eventId: "evt-free",
      waveLabel: "General",
      acceptedTerms: true,
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("not a free event");
    expect(mocks.registrationCreateMany).not.toHaveBeenCalled();
  });

  it("refuses a closed free tier", async () => {
    mocks.session.mockReturnValue(account());
    mocks.eventFindUnique.mockResolvedValue(
      freeEvent({ waves: [{ label: "General", price: "0", closes: "2020-01-01" }] })
    );

    const res = await postRsvp({
      eventId: "evt-free",
      waveLabel: "General",
      acceptedTerms: true,
    });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("closed");
    expect(mocks.registrationCreateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/checkout — free and mixed orders", () => {
  it("creates no payment intent for a free order", async () => {
    mocks.eventFindUnique.mockResolvedValue(freeEvent());

    const res = await postCheckout({ eventId: "evt-free", participants: [participant()] });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.free).toBe(true);
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("charges only the paid tier when a cart mixes free and paid tickets", async () => {
    mocks.eventFindUnique.mockResolvedValue(
      freeEvent({
        waves: [{ label: "General", price: "0" }, { label: "Timed", price: "20" }],
        organiser: { id: "org-1", stripeAccountId: "acct_1", stripeOnboardingComplete: true },
      })
    );

    const res = await postCheckout({
      eventId: "evt-free",
      participants: [
        participant(),
        participant({ firstName: "Ash", email: "ash@example.com", waveLabel: "Timed" }),
      ],
    });

    expect(res.status).toBe(200);
    // $20 ticket + its 3.95% + $1.45 fee. The free ticket adds nothing at all.
    const args = mocks.paymentIntentCreate.mock.calls[0][0];
    expect(args.amount).toBe(2224);
    expect(args.application_fee_amount).toBe(224);
  });
});
