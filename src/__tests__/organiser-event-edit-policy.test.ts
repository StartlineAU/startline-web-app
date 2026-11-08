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
}));

vi.mock("@/lib/organiser-api-auth", () => ({
  requireOrganiser: async () => ({ error: null, session: await mocks.session() }),
}));
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

const submitPayload = {
  title: "Updated title",
  discipline: "running",
  eventDate,
  startTime: "07:00",
  city: "Melbourne",
  state: "VIC",
  format: "Road",
  level: "All levels",
  registrationType: "external",
  registrationUrl: "https://example.com/enter",
  submit: true,
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

describe("PATCH /api/organiser/events/[id] — edit policy", () => {
  it("lets a published event be edited and keeps it live", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, status: "APPROVED" });

    const res = await patch({ ...submitPayload, title: "Changed" });

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate.mock.calls[0][0].data.status).toBe("APPROVED");
    // Followers heard about it when it was published, not again on an edit.
    expect(mocks.notifyFollowers).not.toHaveBeenCalled();
    expect(mocks.notifyAdmins).not.toHaveBeenCalled();
  });

  it("refuses an in-progress event", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      ...baseEvent,
      status: "IN_PROGRESS",
      eventDate: format(addDays(new Date(), -1), "yyyy-MM-dd"),
      endDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    });

    const res = await patch({ title: "Changed" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: expect.stringContaining("underway") });
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });

  it("refuses an archived event", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, status: "ARCHIVED" });

    const res = await patch({ title: "Changed" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: expect.stringContaining("Archived events") });
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });

  it("saves a pending event without moving it back to draft or re-notifying admins", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, status: "PENDING" });

    const res = await patch({ title: "Changed" });

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate.mock.calls[0][0].data.status).toBe("PENDING");
    expect(mocks.notifyAdmins).not.toHaveBeenCalled();
  });

  it("resubmits a rejected event into review", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, status: "REJECTED" });

    const res = await patch(submitPayload);

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate.mock.calls[0][0].data.status).toBe("PENDING");
    expect(mocks.notifyAdmins).toHaveBeenCalledWith("evt-1");
  });

  it("keeps a pending event pending on resubmission without another admin email", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, status: "PENDING" });

    const res = await patch(submitPayload);

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate.mock.calls[0][0].data.status).toBe("PENDING");
    expect(mocks.notifyAdmins).not.toHaveBeenCalled();
  });

  it("still auto-publishes a submitted draft", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, status: "DRAFT" });

    const res = await patch(submitPayload);

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate.mock.calls[0][0].data.status).toBe("APPROVED");
    expect(mocks.notifyFollowers).toHaveBeenCalled();
    expect(mocks.notifyAdmins).not.toHaveBeenCalled();
  });

  it("leaves a saved draft as a draft", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, status: "DRAFT" });

    const res = await patch({ title: "Changed" });

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate.mock.calls[0][0].data.status).toBe("DRAFT");
  });
});

describe("PATCH /api/organiser/events/[id] — change log and full-refund handshake", () => {
  const liveEvent = {
    ...baseEvent,
    status: "APPROVED",
    discipline: "running",
    format: "Road",
    level: "All levels",
    venue: "Albert Park",
    city: "Melbourne",
    title: "Original title",
    cap: 300,
    latitude: -37.84,
    longitude: 144.95,
  };
  const laterDate = format(addDays(new Date(), 45), "yyyy-MM-dd");

  it("refuses a material change with paid entrants until the organiser confirms, and writes nothing", async () => {
    mocks.eventFindUnique.mockResolvedValue(liveEvent);
    mocks.registrationCount.mockResolvedValue(4);

    const res = await patch({ eventDate: laterDate });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("MATERIAL_CHANGE_CONFIRM_REQUIRED");
    expect(body.affectedCount).toBe(4);
    expect(body.changes).toEqual([
      expect.objectContaining({ field: "eventDate", from: liveEvent.eventDate, to: laterDate, material: true }),
    ]);
    expect(new Date(body.fullRefundUntil).getTime()).toBeGreaterThan(Date.now());
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
    expect(mocks.registrationUpdateMany).not.toHaveBeenCalled();
    expect(mocks.eventChangeCreate).not.toHaveBeenCalled();
  });

  it("once confirmed, saves the change, grants the entitlement and logs both together", async () => {
    mocks.eventFindUnique.mockResolvedValue(liveEvent);
    mocks.registrationCount.mockResolvedValue(4);
    mocks.registrationUpdateMany.mockResolvedValue({ count: 4 });

    const res = await patch({ eventDate: laterDate, acknowledgeChangeRefunds: true });

    expect(res.status).toBe(200);
    expect((await res.json()).affectedCount).toBe(4);

    const grant = mocks.registrationUpdateMany.mock.calls[0][0];
    expect(grant.where).toEqual({ eventId: "evt-1", status: "CONFIRMED", amountCents: { gt: 0 } });
    expect(grant.data.fullRefundUntil).toBeInstanceOf(Date);

    const logged = mocks.eventChangeCreate.mock.calls[0][0].data;
    expect(logged).toMatchObject({
      id: grant.data.fullRefundChangeId,
      eventId: "evt-1",
      source: "ORGANISER",
      kind: "EDIT",
      material: true,
      affectedCount: 4,
      statusAtChange: "APPROVED",
    });
    expect(logged.changes).toEqual([
      expect.objectContaining({ field: "eventDate", from: liveEvent.eventDate, to: laterDate }),
    ]);
    expect(mocks.notifyEventChange).toHaveBeenCalledWith(expect.objectContaining({
      notifyEntrants: true,
      notifyAdmins: false,
    }));
  });

  it("queues an unverified organiser's edit of a live event instead of publishing it", async () => {
    mocks.session.mockResolvedValue({ sub: "org-1", verified: false, role: "OWNER", email: "jade@example.com" });
    mocks.eventFindUnique.mockResolvedValue(liveEvent);

    const res = await patch({ venue: "Princes Park" });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ pendingReview: true, status: "APPROVED" });
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
    expect(mocks.registrationUpdateMany).not.toHaveBeenCalled();
    expect(mocks.eventChangeCreate).not.toHaveBeenCalled();
    expect(mocks.eventRevisionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventId: "evt-1",
        material: true,
        payload: expect.objectContaining({ venue: "Princes Park" }),
      }),
    }));
    expect(mocks.notifyAdminsEventEditPending).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "evt-1",
    }));
    expect(mocks.notifyEventChange).not.toHaveBeenCalled();
  });

  it("still asks an unverified organiser to confirm a material change before queueing it", async () => {
    mocks.session.mockResolvedValue({ sub: "org-1", verified: false, role: "OWNER" });
    mocks.eventFindUnique.mockResolvedValue(liveEvent);
    mocks.registrationCount.mockResolvedValue(4);

    const res = await patch({ venue: "Princes Park" });

    expect(res.status).toBe(409);
    expect((await res.json()).awaitsReview).toBe(true);
    expect(mocks.eventRevisionCreate).not.toHaveBeenCalled();
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });

  it("logs a non-material edit without asking for confirmation", async () => {
    mocks.eventFindUnique.mockResolvedValue(liveEvent);
    mocks.registrationCount.mockResolvedValue(4);

    const res = await patch({ description: "Now with a pace group." });

    expect(res.status).toBe(200);
    expect(mocks.registrationCount).not.toHaveBeenCalled();
    expect(mocks.registrationUpdateMany).not.toHaveBeenCalled();
    expect(mocks.eventChangeCreate.mock.calls[0][0].data).toMatchObject({ kind: "EDIT", material: false });
    expect(mocks.notifyEventChange).not.toHaveBeenCalled();
  });

  it("writes a baseline first for an event published before change logging existed", async () => {
    mocks.eventFindUnique.mockResolvedValue(liveEvent);
    mocks.eventChangeFindFirst.mockResolvedValue(null);

    await patch({ description: "Updated" });

    const [baseline, edit] = mocks.eventChangeCreate.mock.calls.map((call) => call[0].data);
    expect(baseline).toMatchObject({ source: "SYSTEM", kind: "BASELINE" });
    expect(baseline.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "title", to: "Original title" }),
    ]));
    expect(edit).toMatchObject({ source: "ORGANISER", kind: "EDIT" });
  });

  it("does not log edits to a draft", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, status: "DRAFT" });

    await patch({ title: "Still drafting" });

    expect(mocks.eventChangeCreate).not.toHaveBeenCalled();
  });

  it("logs the baseline when a draft is published", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, status: "DRAFT" });

    await patch(submitPayload);

    expect(mocks.eventChangeCreate.mock.calls[0][0].data).toMatchObject({
      kind: "BASELINE",
      source: "ORGANISER",
      statusAtChange: "DRAFT",
    });
  });

  it("judges required fields on the saved event, so a bare submit works", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...liveEvent, status: "DRAFT" });

    const res = await patch({ submit: true });

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate.mock.calls[0][0].data.status).toBe("APPROVED");
  });

  it("keeps the cap and map pin when a save leaves them out", async () => {
    mocks.eventFindUnique.mockResolvedValue(liveEvent);

    await patch({ description: "Updated" });

    const data = mocks.eventUpdate.mock.calls[0][0].data;
    expect(data.cap).toBeUndefined();
    expect(data.latitude).toBeUndefined();
    expect(data.longitude).toBeUndefined();
  });
});
