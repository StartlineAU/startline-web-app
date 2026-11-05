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
}));

vi.mock("@/lib/organiser-api-auth", () => ({
  requireOrganiser: async () => ({ error: null, session: await mocks.session() }),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    event: {
      findUnique: mocks.eventFindUnique,
      update: mocks.eventUpdate,
    },
    organiser: { findUnique: mocks.organiserFindUnique },
  },
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
  it("refuses a published event before writing anything", async () => {
    mocks.eventFindUnique.mockResolvedValue({ ...baseEvent, status: "APPROVED" });

    const res = await patch({ title: "Changed" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: expect.stringContaining("Published event details can't be edited directly"),
    });
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
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
