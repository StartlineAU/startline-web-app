import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// #492: a refund asked from the athlete's own entry is linked to it, takes the
// policy quote then, and holds the entry until the organiser decides.

const mocks = vi.hoisted(() => {
  const tx = {
    registration: { updateMany: vi.fn() },
    supportTicket: { create: vi.fn() },
  };
  return {
    tx,
    getUserSession: vi.fn(),
    registration: { findUnique: vi.fn() },
    event: { findUnique: vi.fn() },
    supportTicket: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    sendRefundRequestEmail: vi.fn(),
    sendRefundDecisionEmail: vi.fn(),
  };
});

vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/turnstile", () => ({ assertTurnstile: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/amplify-server", () => ({ getUserSession: mocks.getUserSession }));
vi.mock("@/lib/admin-notification-recipients", () => ({
  listAdminReviewRecipients: vi.fn().mockResolvedValue(["admin@startline.test"]),
}));
vi.mock("@/lib/email", () => ({
  sendRefundRequestEmail: mocks.sendRefundRequestEmail,
  sendRefundDecisionEmail: mocks.sendRefundDecisionEmail,
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    registration: mocks.registration,
    event: mocks.event,
    supportTicket: mocks.supportTicket,
    $transaction: mocks.$transaction,
  },
}));

import { POST } from "@/app/api/support/route";

const REG = "0b5b8f4e-3a3c-4c55-9d2a-3f6f2b0d1a11";
// Far enough out that the 24-hour cutoff never applies.
const EVENT_DATE = "2099-06-01";

const body = (over: Record<string, unknown> = {}) => ({
  name: "Harper Jones",
  email: "harper@startline.test",
  requestType: "refund",
  registrationId: REG,
  reason: "Can't make it.",
  ...over,
});

const post = (data: unknown) =>
  POST(new NextRequest("http://localhost/api/support", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  }));

const ownEntry = (over: Record<string, unknown> = {}) => ({
  id: REG,
  eventId: "evt-1",
  status: "CONFIRMED",
  userId: "user-1",
  athleteEmail: "harper@startline.test",
  athleteName: "Harper Jones",
  amountCents: 5000,
  platformFeeCents: 300,
  feeStructure: "athlete",
  // Sold under: half back two weeks out.
  soldRefundTiers: [{ daysBefore: 14, percent: 50 }],
  event: { refundTiers: [{ daysBefore: 30, percent: 100 }] },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserSession.mockResolvedValue({ sub: "user-1", email: "harper@startline.test" });
  mocks.registration.findUnique.mockResolvedValue(ownEntry());
  mocks.event.findUnique.mockResolvedValue({
    id: "evt-1",
    title: "Harbour 10K",
    eventDate: EVENT_DATE,
    startsAtUtc: new Date(`${EVENT_DATE}T00:00:00Z`),
    organiserId: "org-1",
    status: "APPROVED",
    organiser: { email: "owner@apex.test", contactEmail: null, notifyManagers: false, orgName: "Apex", members: [] },
  });
  mocks.tx.registration.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.supportTicket.create.mockResolvedValue({ id: "ticket-1", createdAt: new Date() });
  mocks.supportTicket.create.mockResolvedValue({ id: "ticket-2", createdAt: new Date() });
  mocks.sendRefundRequestEmail.mockResolvedValue(undefined);
  mocks.sendRefundDecisionEmail.mockResolvedValue(undefined);
});

describe("POST /api/support with an entry", () => {
  it("links the ticket to the entry, takes the quote from the policy it was sold under, and holds the entry", async () => {
    const res = await post(body());
    expect(res.status).toBe(200);

    expect(mocks.tx.registration.updateMany).toHaveBeenCalledWith({
      where: { id: REG, status: "CONFIRMED" },
      data: expect.objectContaining({
        status: "REFUND_REQUESTED",
        refundPercent: 50,
        // Half the ticket price; the booking fee is not refunded.
        refundAmountCents: 2500,
        refundOutsidePolicy: false,
      }),
    });
    expect(mocks.tx.supportTicket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registrationId: REG,
        eventId: "evt-1",
        organiserId: "org-1",
        policyRefundPercent: 50,
        policyRefundCents: 2500,
      }),
      select: { id: true, createdAt: true },
    });
    // The organisation hears about it, and so does the athlete.
    expect(mocks.sendRefundRequestEmail).toHaveBeenCalledWith("owner@apex.test", expect.objectContaining({ audience: "organiser" }));
    expect(mocks.sendRefundDecisionEmail).toHaveBeenCalledWith(
      "harper@startline.test",
      expect.objectContaining({ outcome: "requested", amountCents: 2500, organiserName: "Apex" }),
    );
  });

  it("takes the event's policy when the entry has none frozen", async () => {
    mocks.registration.findUnique.mockResolvedValue(ownEntry({ soldRefundTiers: null }));
    await post(body());
    expect(mocks.tx.registration.updateMany.mock.calls[0][0].data).toMatchObject({
      refundPercent: 100,
      refundAmountCents: 5000,
    });
  });

  it("needs the athlete signed in", async () => {
    mocks.getUserSession.mockResolvedValue(null);
    expect((await post(body())).status).toBe(401);
    expect(mocks.$transaction).not.toHaveBeenCalled();
  });

  it("hides someone else's entry", async () => {
    mocks.registration.findUnique.mockResolvedValue(ownEntry({ userId: "user-2", athleteEmail: "sam@startline.test" }));
    expect((await post(body())).status).toBe(404);
  });

  it("refuses a second request on the same entry", async () => {
    mocks.registration.findUnique.mockResolvedValue(ownEntry({ status: "REFUND_REQUESTED" }));
    const res = await post(body());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already asked/);
  });

  it("sends a free entry to withdraw instead", async () => {
    mocks.registration.findUnique.mockResolvedValue(ownEntry({ amountCents: 0, platformFeeCents: 0 }));
    expect((await post(body())).status).toBe(409);
  });

  it("loses a race on the entry cleanly, with no ticket", async () => {
    mocks.tx.registration.updateMany.mockResolvedValue({ count: 0 });
    expect((await post(body())).status).toBe(409);
    expect(mocks.tx.supportTicket.create).not.toHaveBeenCalled();
  });

  it("still takes a refund request described by hand, unlinked", async () => {
    const res = await post(body({ registrationId: undefined, eventName: "Harbour 10K" }));
    expect(res.status).toBe(200);
    expect(mocks.$transaction).not.toHaveBeenCalled();
    expect(mocks.supportTicket.create.mock.calls[0][0].data).not.toHaveProperty("registrationId");
  });
});
