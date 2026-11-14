import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  organiserFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  memberFindFirst: vi.fn(),
  reviewFindFirst: vi.fn(),
  reviewCreate: vi.fn(),
  eventFindFirst: vi.fn(),
  registrationFindFirst: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({ getUserSession: mocks.session }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));
vi.mock("@/lib/turnstile", () => ({ assertTurnstile: async () => null }));
vi.mock("@/lib/prisma", () => ({
  default: {
    organiser: { findFirst: mocks.organiserFindFirst },
    user: { findUnique: mocks.userFindUnique },
    organiserMember: { findFirst: mocks.memberFindFirst },
    review: { findFirst: mocks.reviewFindFirst, create: mocks.reviewCreate },
    event: { findFirst: mocks.eventFindFirst },
    registration: { findFirst: mocks.registrationFindFirst },
  },
}));

import { POST } from "@/app/api/public/reviews/[organiserId]/route";

const BODY = { overallRating: 5, title: "Great", body: "Well run." };

function post(body: Record<string, unknown> = BODY) {
  return POST(
    new NextRequest("http://localhost/api/public/reviews/org-1", { method: "POST", body: JSON.stringify(body) }),
    { params: Promise.resolve({ organiserId: "org-1" }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.session.mockResolvedValue({ sub: "user-1", email: "a@example.com", name: "A" });
  mocks.organiserFindFirst.mockResolvedValue({ id: "org-1" });
  mocks.userFindUnique.mockResolvedValue({ id: "user-1", name: null, username: null, email: "jordan.clarke@example.com" });
  mocks.memberFindFirst.mockResolvedValue(null);
  mocks.reviewFindFirst.mockResolvedValue(null);
  mocks.registrationFindFirst.mockResolvedValue({ id: "reg-1" });
  mocks.reviewCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "rev-1", reviewerName: data.reviewerName, eventId: data.eventId, eventTitle: data.eventTitle,
  }));
});

describe("POST /api/public/reviews/[organiserId]", () => {
  it("publishes a review from an athlete who entered, without exposing their email", async () => {
    const res = await post();
    expect(res.status).toBe(201);
    const data = mocks.reviewCreate.mock.calls[0][0].data;
    expect(data.reviewerName).toBe("Startline athlete");
    expect(data.isVerified).toBe(true);
  });

  it("refuses a member of the organisation", async () => {
    mocks.memberFindFirst.mockResolvedValue({ id: "m-1" });
    const res = await post();
    expect(res.status).toBe(403);
    expect(mocks.reviewCreate).not.toHaveBeenCalled();
  });

  it("refuses someone who never entered one of the organiser's events", async () => {
    mocks.registrationFindFirst.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(403);
    expect(mocks.reviewCreate).not.toHaveBeenCalled();
  });

  it("checks the entry against the named event", async () => {
    mocks.eventFindFirst.mockResolvedValue({ id: "evt-1", title: "Harbour 10K" });
    await post({ ...BODY, eventId: "evt-1" });
    expect(mocks.registrationFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organiserId: "org-1", userId: "user-1", status: "CONFIRMED", eventId: "evt-1" }),
    }));
  });
});
