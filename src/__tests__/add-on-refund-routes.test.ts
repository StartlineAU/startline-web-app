import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Covers the wiring of both add-on refund routes: the pure decisions live in
// add-on-refunds.test.ts, and what is proved here is that the routes persist the
// right thing, hand Stripe facts read off the real charge, and never touch the
// registration.

const mocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  requireOrganiser: vi.fn(),
  registrationAddOn: { findUnique: vi.fn(), update: vi.fn() },
  registration: { findUnique: vi.fn(), update: vi.fn() },
  organiserMember: { findMany: vi.fn() },
  userNotification: { create: vi.fn(), createMany: vi.fn() },
  retrievePaymentIntent: vi.fn(),
  createRefund: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({ getUserSession: mocks.getUserSession }));
vi.mock("@/lib/organiser-api-auth", () => ({ requireOrganiser: mocks.requireOrganiser }));

vi.mock("@/lib/prisma", () => ({
  default: {
    registrationAddOn: mocks.registrationAddOn,
    registration: mocks.registration,
    organiserMember: mocks.organiserMember,
    userNotification: mocks.userNotification,
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: { retrieve: mocks.retrievePaymentIntent },
    refunds: { create: mocks.createRefund },
  }),
}));

import { POST as requestRefund } from "@/app/api/user/registrations/[id]/add-ons/[itemId]/refund-request/route";
import { POST as decideRefund } from "@/app/api/organiser/events/[id]/add-ons/refunds/[itemId]/route";

const ORGANISER = "org-1";
const EVENT = "event-1";
const REG = "reg-1";
const ITEM = "item-1";

// A $25.00 tee with the athlete-borne percentage fee (no fixed component), so
// what they paid is 2599 and that is what comes back.
const purchased = {
  id: ITEM,
  eventId: EVENT,
  registrationId: REG,
  status: "PURCHASED",
  amountCents: 2500,
  platformFeeCents: 99,
  feeStructure: "athlete",
  quantity: 1,
  nameSnapshot: "Event tee",
  variantLabelSnapshot: "M",
  refundAmountCents: null,
  stripeRefundId: null,
  registration: {
    id: REG,
    userId: "user-1",
    athleteEmail: "jade@example.com",
    athleteName: "Jade Nguyen",
    stripePaymentIntentId: "pi_1",
    event: {
      id: EVENT,
      title: "Apex Throwdown",
      organiserId: ORGANISER,
      eventDate: "2099-01-01",
      organiser: { id: ORGANISER },
    },
  },
};

const requested = { ...purchased, status: "REFUND_REQUESTED", refundAmountCents: 2599 };

/** A destination charge: money already transferred to the organiser. */
const destinationCharge = { id: "ch_1", transfer: "tr_1", application_fee: "fee_1" };

function askForRefund(body: unknown = {}) {
  const req = new NextRequest(
    `http://localhost/api/user/registrations/${REG}/add-ons/${ITEM}/refund-request`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return requestRefund(req, { params: Promise.resolve({ id: REG, itemId: ITEM }) });
}

function decide(body: unknown, itemId = ITEM) {
  const req = new NextRequest(
    `http://localhost/api/organiser/events/${EVENT}/add-ons/refunds/${itemId}`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return decideRefund(req, { params: Promise.resolve({ id: EVENT, itemId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserSession.mockResolvedValue({ sub: "user-1", email: "jade@example.com" });
  mocks.requireOrganiser.mockResolvedValue({ error: null, session: { sub: ORGANISER } });
  mocks.registrationAddOn.findUnique.mockResolvedValue(purchased);
  mocks.registrationAddOn.update.mockResolvedValue({});
  mocks.organiserMember.findMany.mockResolvedValue([{ userId: "member-1" }]);
  mocks.userNotification.create.mockResolvedValue({});
  mocks.userNotification.createMany.mockResolvedValue({});
  mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: destinationCharge });
  mocks.createRefund.mockResolvedValue({ id: "re_1" });
});

describe("athlete add-on refund request", () => {
  it("freezes what the athlete paid onto the row", async () => {
    const res = await askForRefund();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      status: "REFUND_REQUESTED",
      refundAmountCents: 2599,
    });

    const { data } = mocks.registrationAddOn.update.mock.calls[0][0];
    expect(data).toMatchObject({ status: "REFUND_REQUESTED", refundAmountCents: 2599 });
  });

  it("clears a previous decline so the new request is the live one", async () => {
    await askForRefund();
    const { data } = mocks.registrationAddOn.update.mock.calls[0][0];
    expect(data.refundDeclinedAt).toBeNull();
    expect(data.refundDeclineReason).toBeNull();
  });

  it("never touches the registration", async () => {
    await askForRefund();
    expect(mocks.registration.update).not.toHaveBeenCalled();
  });

  it("refuses an item belonging to a different registration", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue({
      ...purchased,
      registrationId: "someone-else",
    });
    const res = await askForRefund();
    expect(res.status).toBe(404);
    expect(mocks.registrationAddOn.update).not.toHaveBeenCalled();
  });

  it("refuses an item on somebody else's entry", async () => {
    mocks.getUserSession.mockResolvedValue({ sub: "user-2", email: "other@example.com" });
    const res = await askForRefund();
    expect(res.status).toBe(404);
    expect(mocks.registrationAddOn.update).not.toHaveBeenCalled();
  });

  it("refuses a second request while one is open", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue(requested);
    const res = await askForRefund();
    expect(res.status).toBe(409);
    expect(mocks.registrationAddOn.update).not.toHaveBeenCalled();
  });

  it("records the request even when notifying the organiser fails", async () => {
    mocks.userNotification.createMany.mockRejectedValue(new Error("db down"));
    const res = await askForRefund();
    expect(res.status).toBe(200);
    expect(mocks.registrationAddOn.update).toHaveBeenCalled();
  });
});

describe("organiser add-on refund decision", () => {
  it("expands the charge so the transfer and application fee can be read", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue(requested);
    await decide({ decision: "approve" });
    expect(mocks.retrievePaymentIntent).toHaveBeenCalledWith("pi_1", {
      expand: ["latest_charge"],
    });
  });

  // The money bugs #323 fixed for entries, asserted again at the add-on boundary.
  it("reverses the transfer and sends an explicit amount on a destination charge", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue(requested);
    const res = await decide({ decision: "approve" });
    expect(res.status).toBe(200);

    const [params, options] = mocks.createRefund.mock.calls[0];
    expect(params).toMatchObject({
      charge: "ch_1",
      amount: 2599,
      reverse_transfer: true,
      refund_application_fee: false,
    });
    expect(options).toEqual({ idempotencyKey: `addon-refund-${ITEM}` });
  });

  it("omits both flags on a direct charge, which has neither", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue(requested);
    mocks.retrievePaymentIntent.mockResolvedValue({
      latest_charge: { id: "ch_2", transfer: null, application_fee: null },
    });
    await decide({ decision: "approve" });

    const [params] = mocks.createRefund.mock.calls[0];
    expect(params).not.toHaveProperty("reverse_transfer");
    expect(params).not.toHaveProperty("refund_application_fee");
  });

  it("honours the amount frozen when the athlete asked, not a fresh calculation", async () => {
    // The organiser retired the product and halved its price since the request.
    mocks.registrationAddOn.findUnique.mockResolvedValue({
      ...requested,
      amountCents: 1000,
      platformFeeCents: 40,
      refundAmountCents: 2599,
    });
    await decide({ decision: "approve" });
    expect(mocks.createRefund.mock.calls[0][0].amount).toBe(2599);
  });

  it("persists the Stripe refund id, which is unique, so a retry cannot refund twice", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue(requested);
    await decide({ decision: "approve" });
    const { data } = mocks.registrationAddOn.update.mock.calls[0][0];
    expect(data).toMatchObject({ status: "REFUNDED", stripeRefundId: "re_1" });
  });

  it("writes nothing when Stripe fails, so the request stays open for a retry", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue(requested);
    mocks.createRefund.mockRejectedValue(new Error("card_error"));
    const res = await decide({ decision: "approve" });
    expect(res.status).toBe(502);
    expect(mocks.registrationAddOn.update).not.toHaveBeenCalled();
  });

  it("refuses rather than guessing when the charge comes back unexpanded", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue(requested);
    mocks.retrievePaymentIntent.mockResolvedValue({ latest_charge: "ch_3" });
    const res = await decide({ decision: "approve" });
    expect(res.status).toBe(502);
    expect(mocks.createRefund).not.toHaveBeenCalled();
    expect(mocks.registrationAddOn.update).not.toHaveBeenCalled();
  });

  it("returns a declined item to PURCHASED and charges nothing", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue(requested);
    const res = await decide({ decision: "decline", reason: "Already collected" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "PURCHASED" });

    const { data } = mocks.registrationAddOn.update.mock.calls[0][0];
    expect(data.status).toBe("PURCHASED");
    expect(data.refundDeclineReason).toBe("Already collected");
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("refuses to decide an item with no open request", async () => {
    const res = await decide({ decision: "approve" });
    expect(res.status).toBe(409);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("refuses to decide twice on an already refunded item", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue({
      ...requested,
      status: "REFUNDED",
      stripeRefundId: "re_1",
    });
    const res = await decide({ decision: "approve" });
    expect(res.status).toBe(409);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("refuses an item belonging to another organiser's event", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue({
      ...requested,
      registration: {
        ...requested.registration,
        event: { ...requested.registration.event, organiserId: "org-2" },
      },
    });
    const res = await decide({ decision: "approve" });
    expect(res.status).toBe(403);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("refuses an item on an event other than the one in the path", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue({ ...requested, eventId: "event-2" });
    const res = await decide({ decision: "approve" });
    expect(res.status).toBe(404);
  });

  it("rejects a body that is neither approve nor decline", async () => {
    const res = await decide({ decision: "maybe" });
    expect(res.status).toBe(400);
    expect(mocks.registrationAddOn.findUnique).not.toHaveBeenCalled();
  });

  it("marks a comped entry refunded without calling Stripe", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue({
      ...requested,
      registration: { ...requested.registration, stripePaymentIntentId: null },
    });
    const res = await decide({ decision: "approve" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "REFUNDED", method: "free" });
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("never touches the registration on either decision", async () => {
    mocks.registrationAddOn.findUnique.mockResolvedValue(requested);
    await decide({ decision: "approve" });
    mocks.registrationAddOn.findUnique.mockResolvedValue(requested);
    await decide({ decision: "decline" });
    expect(mocks.registration.update).not.toHaveBeenCalled();
  });
});
