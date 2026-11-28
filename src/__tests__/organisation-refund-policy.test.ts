import { describe, it, expect, vi, beforeEach } from "vitest";

// #580: saving the organisation's policy reaches only the listings that follow
// it. A listing with its own policy keeps it.

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  organiserUpdate: vi.fn(),
  eventUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: mocks.executeRaw,
    organiser: { update: mocks.organiserUpdate },
    event: { updateMany: mocks.eventUpdateMany },
  };
  return { default: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
});

import { saveOrganisationRefundPolicy } from "@/lib/organisation-refund-policy";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executeRaw.mockResolvedValue(0);
  mocks.organiserUpdate.mockResolvedValue({});
  mocks.eventUpdateMany.mockResolvedValue({ count: 2 });
});

describe("saveOrganisationRefundPolicy", () => {
  it("freezes sold entries first, then updates only the listings that follow the organisation", async () => {
    const tiers = [{ daysBefore: 14, percent: 100 }];
    await saveOrganisationRefundPolicy("org-1", tiers, "Notes");

    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.organiserUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { refundTiers: tiers, refundPolicy: "Notes" },
    });
    expect(mocks.eventUpdateMany).toHaveBeenCalledWith({
      where: { organiserId: "org-1", refundFollowsOrg: true },
      data: { refundTiers: tiers, refundPolicy: "Notes" },
    });
  });
});
