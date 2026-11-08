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
  mocks.members.mockResolvedValue([{ ownerId: "owner-1" }]);
  mocks.createMany.mockResolvedValue({ count: 1 });
});

describe("a paid entry cannot be refunded from the entry itself", () => {
  it("sends the athlete to Support instead of opening a refund", async () => {
    mocks.findUnique.mockResolvedValue(registration({ fullRefundUntil: addDays(new Date(), 5) }));

    const res = await request();

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Support/);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.issueEntryRefund).not.toHaveBeenCalled();
  });

  it("does the same once the change entitlement has run out", async () => {
    mocks.findUnique.mockResolvedValue(registration());

    const res = await request();

    expect(res.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("still cancels a free entry", async () => {
    mocks.findUnique.mockResolvedValue(registration({ amountCents: 0, platformFeeCents: 0 }));

    const body = await (await request()).json();

    expect(body).toMatchObject({ status: "REFUND_REQUESTED", refundPercent: 0, refundAmountCents: 0 });
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ status: "REFUND_REQUESTED" });
  });
});
