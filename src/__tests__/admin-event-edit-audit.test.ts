import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { addDays, format } from "date-fns";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  eventFindUnique: vi.fn(),
  eventUpdate: vi.fn(),
  writeAuditLog: vi.fn(),
  syncEventSchedules: vi.fn(),
}));

vi.mock("@/lib/amplify-server", () => ({
  getAdminSession: async () => mocks.session(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    event: {
      findUnique: mocks.eventFindUnique,
      update: mocks.eventUpdate,
    },
  },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/event-scheduler", () => ({
  syncEventSchedules: mocks.syncEventSchedules,
  cancelEventSchedules: vi.fn(),
}));

import { PATCH } from "@/app/api/admin/events/[id]/route";

const eventDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

const baseEvent = {
  id: "evt-1",
  organiserId: "org-1",
  status: "APPROVED",
  title: "Original title",
  discipline: "running",
  eventDate,
  endDate: null,
  startTime: "07:00",
  endTime: "10:00",
  state: "VIC",
  waves: [{ label: "General", price: "45" }],
  registrationType: "startline",
};

const patch = (body: Record<string, unknown>) =>
  PATCH(
    new NextRequest("http://localhost/api/admin/events/evt-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "evt-1" }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.session.mockResolvedValue({ sub: "admin-1" });
  mocks.eventFindUnique.mockResolvedValue(baseEvent);
  mocks.syncEventSchedules.mockResolvedValue(undefined);
  mocks.writeAuditLog.mockResolvedValue(undefined);
  mocks.eventUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const defined = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    return { ...baseEvent, ...defined };
  });
});

describe("PATCH /api/admin/events/[id] — edit history", () => {
  it("records the fields that changed with before and after values", async () => {
    const res = await patch({ title: "New title" });

    expect(res.status).toBe(200);
    const audit = mocks.writeAuditLog.mock.calls[0][0];
    expect(audit.meta.changedFields).toContain("title");
    expect(audit.meta.changes.title).toEqual({ from: "Original title", to: "New title" });
    expect(audit.meta.status).toBe("APPROVED");
  });

  it("keeps a live event live and records ticket-tier changes", async () => {
    const waves = [{ label: "General", price: "55" }];

    const res = await patch({ waves });

    expect(res.status).toBe(200);
    const audit = mocks.writeAuditLog.mock.calls[0][0];
    expect(audit.meta.changedFields).toContain("waves");
    expect(audit.meta.changes.waves).toEqual({
      from: baseEvent.waves,
      to: waves,
    });
    expect(audit.meta.status).toBe("APPROVED");
  });
});
