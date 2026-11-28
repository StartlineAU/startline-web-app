import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireOrganiser: vi.fn(),
  eventFindUnique: vi.fn(),
  registrationFindFirst: vi.fn(),
  registrationFindUnique: vi.fn(),
  registrationUpdateMany: vi.fn(),
}));

vi.mock("@/lib/organiser-api-auth", () => ({
  requireOrganiser: mocks.requireOrganiser,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    event: { findUnique: mocks.eventFindUnique },
    registration: {
      findFirst: mocks.registrationFindFirst,
      findUnique: mocks.registrationFindUnique,
      updateMany: mocks.registrationUpdateMany,
    },
  },
}));

import { POST } from "@/app/api/organiser/events/[id]/scan/route";

const TOKEN = "8f14e45f-ceea-4e7a-9f5f-8c1f0f1c3d4b";
const QR = `SLT1:${TOKEN}`;

const event = {
  id: "evt-1",
  organiserId: "org-1",
  title: "Harbour 10K",
  status: "APPROVED",
  eventDate: "2026-11-28",
  endDate: null,
  startTime: "07:00",
  endTime: "10:00",
  timeZone: "Australia/Sydney",
  state: "nsw",
  startsAtUtc: new Date(Date.now() - 5 * 60_000),
  endsAtUtc: new Date(Date.now() + 2 * 60 * 60_000),
  checkInLeadMinutes: 60,
};

const registration = {
  id: "reg-1",
  athleteName: "Harper Jones",
  waveLabel: "Sprint",
  bibNumber: "104",
  checkedInAt: null as Date | null,
  status: "CONFIRMED",
  detailsPending: false,
  team: null,
};

function request(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/organiser/events/evt-1/scan", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "evt-1" }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOrganiser.mockResolvedValue({
    error: null,
    session: { sub: "org-1", role: "OWNER" },
  });
  mocks.eventFindUnique.mockResolvedValue(event);
  mocks.registrationFindFirst.mockResolvedValue(registration);
  mocks.registrationFindUnique.mockResolvedValue(registration);
  mocks.registrationUpdateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/organiser/events/[id]/scan", () => {
  it("checks in only the scanned entry", async () => {
    const res = await request({ qr: QR });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result).toBe("checked_in");
    expect(body.registration).toMatchObject({ id: "reg-1", athleteName: "Harper Jones" });
    expect(mocks.registrationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "reg-1" }) }),
    );
  });

  it("rejects a QR from another format without touching the database", async () => {
    const res = await request({ qr: "not-a-startline-ticket" });
    expect(res.status).toBe(400);
    expect(mocks.eventFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a ticket from another event", async () => {
    mocks.registrationFindFirst.mockResolvedValue(null);
    const res = await request({ qr: QR });
    expect(res.status).toBe(404);
    expect(mocks.registrationUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses an entry that is no longer active", async () => {
    mocks.registrationFindFirst.mockResolvedValue({ ...registration, status: "REFUNDED" });
    const res = await request({ qr: QR });
    expect(res.status).toBe(409);
    expect(mocks.registrationUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses a team place whose athlete has not been named", async () => {
    mocks.registrationFindFirst.mockResolvedValue({ ...registration, detailsPending: true });
    const res = await request({ qr: QR });
    expect(res.status).toBe(409);
    expect(mocks.registrationUpdateMany).not.toHaveBeenCalled();
  });

  it("reports an entry that another scan already checked in", async () => {
    const checkedInAt = new Date();
    mocks.registrationUpdateMany.mockResolvedValue({ count: 0 });
    mocks.registrationFindUnique.mockResolvedValue({ ...registration, checkedInAt });

    const res = await request({ qr: QR });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result).toBe("already_checked_in");
    expect(body.checkedInAt).toBe(checkedInAt.toISOString());
  });

  it("fails closed when check-in is not open", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      ...event,
      startsAtUtc: new Date(Date.now() + 90 * 60_000),
    });

    const res = await request({ qr: QR });
    expect(res.status).toBe(409);
    expect(mocks.registrationUpdateMany).not.toHaveBeenCalled();
  });
});
