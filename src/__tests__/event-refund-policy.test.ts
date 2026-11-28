import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { addDays, format } from "date-fns";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  eventFindUnique: vi.fn(),
  eventUpdate: vi.fn(),
  organiserFindUnique: vi.fn(),
  syncEventSchedules: vi.fn(),
  notifyFollowers: vi.fn(),
  notifyAdmins: vi.fn(),
  withUniqueSlug: vi.fn(),
  eventChangeCreate: vi.fn(),
  eventChangeFindFirst: vi.fn(),
  registrationCount: vi.fn(),
  registrationUpdateMany: vi.fn(),
  notifyEventChange: vi.fn(),
  notifyAdminsEventEditPending: vi.fn(),
  eventRevisionUpdateMany: vi.fn(),
  eventRevisionCreate: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@/lib/organiser-api-auth", () => ({
  requireOrganiser: async () => ({ error: null, session: await mocks.session() }),
}));
// The real-place check (#530) has its own tests; here the geocoder is out of reach.
vi.mock("@/lib/geocode", () => ({ geocodeLookup: async () => ({ status: "unavailable" }) }));
vi.mock("@/lib/prisma", () => {
  const client: Record<string, unknown> = {
    event: {
      findUnique: mocks.eventFindUnique,
      update: mocks.eventUpdate,
    },
    organiser: { findUnique: mocks.organiserFindUnique },
    eventChange: { create: mocks.eventChangeCreate, findFirst: mocks.eventChangeFindFirst },
    registration: { count: mocks.registrationCount, updateMany: mocks.registrationUpdateMany },
    eventRevision: { updateMany: mocks.eventRevisionUpdateMany, create: mocks.eventRevisionCreate },
  };
  client.$transaction = (fn: (tx: unknown) => unknown) => fn(client);
  client.$executeRaw = mocks.executeRaw;
  return { default: client };
});
vi.mock("@/lib/notify-event-change", () => ({ notifyEventChange: mocks.notifyEventChange }));
vi.mock("@/lib/notify-event-revision", () => ({
  notifyAdminsEventEditPending: mocks.notifyAdminsEventEditPending,
}));
vi.mock("@/lib/event-scheduler", () => ({
  syncEventSchedules: mocks.syncEventSchedules,
  cancelEventSchedules: vi.fn(),
}));
vi.mock("@/lib/notify-organiser-followers", () => ({
  notifyOrganiserFollowers: mocks.notifyFollowers,
}));
vi.mock("@/lib/notify-admins-event-submitted", () => ({
  notifyAdminsEventSubmitted: mocks.notifyAdmins,
}));
vi.mock("@/lib/slugs", () => ({
  withUniqueSlug: mocks.withUniqueSlug,
}));

import { PATCH } from "@/app/api/organiser/events/[id]/route";

const eventDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

const baseEvent = {
  id: "evt-1",
  organiserId: "org-1",
  status: "DRAFT",
  title: "Original title",
  registrationType: "external",
  registrationUrl: "https://example.com/enter",
  waves: [],
  eventDate,
  endDate: null,
  startTime: "07:00",
  endTime: "10:00",
  state: "VIC",
};

const patch = (body: Record<string, unknown>) =>
  PATCH(
    new NextRequest("http://localhost/api/organiser/events/evt-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "evt-1" }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.session.mockResolvedValue({ sub: "org-1", verified: true, role: "OWNER" });
  mocks.organiserFindUnique.mockResolvedValue({ abn: "51824753556", orgName: "Apex" });
  mocks.syncEventSchedules.mockResolvedValue(undefined);
  mocks.notifyFollowers.mockResolvedValue(undefined);
  mocks.notifyAdmins.mockResolvedValue({ emailed: 0 });
  mocks.eventChangeCreate.mockResolvedValue({ id: "chg-1" });
  mocks.eventChangeFindFirst.mockResolvedValue({ id: "baseline" });
  mocks.registrationCount.mockResolvedValue(0);
  mocks.registrationUpdateMany.mockResolvedValue({ count: 0 });
  mocks.notifyEventChange.mockResolvedValue(undefined);
  mocks.notifyAdminsEventEditPending.mockResolvedValue(undefined);
  mocks.eventRevisionUpdateMany.mockResolvedValue({ count: 0 });
  mocks.eventRevisionCreate.mockResolvedValue({ id: "rev-1" });
  mocks.withUniqueSlug.mockImplementation(async (_title: string, write: (slug: string) => unknown) => write("updated-title"));
  mocks.eventUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...baseEvent,
    ...data,
    id: "evt-1",
    organiserId: "org-1",
    title: data.title ?? baseEvent.title,
    status: data.status ?? baseEvent.status,
  }));
});


// #580: a listing follows its organisation's refund policy unless the
// organiser sets one for that event. Changing an event's own policy freezes
// the tiers already-sold entries were bought under.
describe("PATCH /api/organiser/events/[id] — refund policy", () => {
  const ORG_TIERS = [{ daysBefore: 7, percent: 100 }];
  const OWN_TIERS = [{ daysBefore: 0, percent: 100 }];
  const updateData = () => mocks.eventUpdate.mock.calls[0][0].data as Record<string, unknown>;

  beforeEach(() => {
    mocks.executeRaw.mockResolvedValue(0);
  });

  it("leaves a following event on the organisation's policy when the editor sends tiers", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, refundFollowsOrg: true, refundTiers: ORG_TIERS });
    const res = await patch({ title: "Changed", refundTiers: OWN_TIERS, refundPolicy: "x" });
    expect(res.status).toBe(200);
    expect(updateData().refundTiers).toBeUndefined();
    expect(updateData().refundPolicy).toBeUndefined();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("sets the event's own policy and freezes what was already sold", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, refundFollowsOrg: true, refundTiers: ORG_TIERS });
    const res = await patch({ title: "Changed", refundFollowsOrg: false, refundTiers: OWN_TIERS, refundPolicy: "Transfers free." });
    expect(res.status).toBe(200);
    expect(updateData()).toMatchObject({ refundFollowsOrg: false, refundTiers: OWN_TIERS, refundPolicy: "Transfers free." });
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
  });

  it("does not freeze when the event's own tiers are unchanged", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, refundFollowsOrg: false, refundTiers: OWN_TIERS });
    await patch({ title: "Changed", refundTiers: OWN_TIERS });
    expect(updateData().refundTiers).toEqual(OWN_TIERS);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("goes back to the organisation's policy", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, refundFollowsOrg: false, refundTiers: OWN_TIERS });
    mocks.organiserFindUnique.mockResolvedValue({ refundTiers: ORG_TIERS, refundPolicy: "Org notes" });
    const res = await patch({ title: "Changed", refundFollowsOrg: true, refundTiers: OWN_TIERS });
    expect(res.status).toBe(200);
    expect(updateData()).toMatchObject({ refundFollowsOrg: true, refundTiers: ORG_TIERS, refundPolicy: "Org notes" });
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
  });

  it("keeps the event's tiers when the organisation has never saved a policy", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, refundFollowsOrg: false, refundTiers: OWN_TIERS });
    mocks.organiserFindUnique.mockResolvedValue({ refundTiers: null, refundPolicy: null });
    const res = await patch({ title: "Changed", refundFollowsOrg: true });
    expect(res.status).toBe(200);
    expect(updateData().refundFollowsOrg).toBe(true);
    expect(updateData().refundTiers).toBeUndefined();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });
});
