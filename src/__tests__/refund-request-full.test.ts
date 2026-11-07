import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { addDays, format } from "date-fns";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  members: vi.fn(),
  createMany: vi.fn(),
  issueEntryRefund: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({ getUserSession: mocks.session }));
vi.mock("@/lib/prisma", () => ({
  default: {
    registration: { findUnique: mocks.findUnique, update: mocks.update },
    organiserMember: { findMany: mocks.members },
    userNotification: { createMany: mocks.createMany },
  },
}));
vi.mock("@/lib/issue-entry-refund", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/issue-entry-refund")>()),
  issueEntryRefund: mocks.issueEntryRefund,
}));

import { POST } from "@/app/api/user/registrations/[id]/refund-request/route";

// Ten days out, inside no refund tier: a normal request would get nothing back.
const eventDate = format(addDays(new Date(), 10), "yyyy-MM-dd");

const registration = (over: Record<string, unknown> = {}) => ({
  id: "reg-1",
  userId: "user-1",
  athleteEmail: "harper.jones@startline.test",
  athleteName: "Harper Jones",
  status: "CONFIRMED",
  amountCents: 10000,
  platformFeeCents: 540,
  feeStructure: "athlete",
  refundPercent: null,
  refundAmountCents: null,
  refundType: null,
  refundOutsidePolicy: false,
  stripePaymentIntentId: "pi_1",
  eventId: "evt-1",
  fullRefundUntil: null,
  event: {
    id: "evt-1", title: "Harbour 10K", eventDate,
    refundTiers: [{ daysBefore: 30, percent: 100 }],
    organiser: { id: "org-1" },
  },
  ...over,
});

const request = () =>
  POST(new NextRequest("http://localhost/api/user/registrations/reg-1/refund-request", { method: "POST" }), {
    params: Promise.resolve({ id: "reg-1" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.session.mockResolvedValue({ sub: "user-1", email: "harper.jones@startline.test" });
  mocks.update.mockResolvedValue({});
  mocks.members.mockResolvedValue([{ userId: "owner-1" }]);
  mocks.createMany.mockResolvedValue({ count: 1 });
  mocks.issueEntryRefund.mockResolvedValue({ method: "stripe", refundId: "re_1", refundCents: 10540, type: "FULL", recoveryOutstandingCents: 0 });
});

describe("refund request after the organiser changed the event", () => {
  it("refunds everything, booking fee included, straight away", async () => {
    mocks.findUnique.mockResolvedValue(registration({ fullRefundUntil: addDays(new Date(), 5) }));

    const res = await request();
    const body = await res.json();

    expect(body).toMatchObject({ status: "REFUNDED", refundType: "FULL", refundPercent: 100, refundAmountCents: 10540 });
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({
      status: "REFUND_REQUESTED", refundType: "FULL", refundPercent: 100, refundAmountCents: 10540, refundOutsidePolicy: false,
    });
    expect(mocks.issueEntryRefund).toHaveBeenCalledWith(expect.objectContaining({ id: "reg-1" }), "FULL");
    expect(mocks.createMany.mock.calls[0][0].data[0].title).toBe("Full refund claimed");
  });

  it("leaves the request frozen as FULL for an admin when Stripe fails", async () => {
    mocks.findUnique.mockResolvedValue(registration({ fullRefundUntil: addDays(new Date(), 5) }));
    mocks.issueEntryRefund.mockRejectedValue(new Error("Stripe down"));

    const body = await (await request()).json();

    expect(body).toMatchObject({ status: "REFUND_REQUESTED", refundType: "FULL", refundAmountCents: 10540 });
  });

  it("falls back to the normal policy once the entitlement has run out", async () => {
    mocks.findUnique.mockResolvedValue(registration({ fullRefundUntil: addDays(new Date(), -1) }));

    const body = await (await request()).json();

    expect(body).toMatchObject({ status: "REFUND_REQUESTED", refundType: "NORMAL", refundPercent: 0, outsidePolicy: true });
    expect(mocks.issueEntryRefund).not.toHaveBeenCalled();
  });

  it("gives an entry made after the change the normal policy", async () => {
    mocks.findUnique.mockResolvedValue(registration());

    const body = await (await request()).json();

    expect(body.refundType).toBe("NORMAL");
    expect(mocks.issueEntryRefund).not.toHaveBeenCalled();
  });

  it("quotes only the ticket price when the organiser absorbed the fee", async () => {
    mocks.findUnique.mockResolvedValue(registration({
      feeStructure: "organiser",
      fullRefundUntil: addDays(new Date(), 5),
    }));

    const body = await (await request()).json();

    expect(body.refundAmountCents).toBe(10000);
  });
});
