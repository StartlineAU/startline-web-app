import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireOrganiser: vi.fn(),
  getAdminSession: vi.fn(),
  eventFindUnique: vi.fn(),
  cancelEvent: vi.fn(),
  cancellationPreview: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/organiser-api-auth", () => ({ requireOrganiser: mocks.requireOrganiser }));
vi.mock("@/lib/amplify-server", () => ({ getAdminSession: mocks.getAdminSession }));
vi.mock("@/lib/prisma", () => ({
  default: { event: { findUnique: mocks.eventFindUnique }, registration: { findMany: vi.fn(async () => []) } },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/event-cancellation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/event-cancellation")>("@/lib/event-cancellation");
  return {
    CancelError: actual.CancelError,
    cancelEvent: mocks.cancelEvent,
    cancellationPreview: mocks.cancellationPreview,
  };
});

import { POST as organiserCancel } from "@/app/api/organiser/events/[id]/cancel/route";
import { POST as adminCancel } from "@/app/api/admin/events/[id]/cancel/route";
import { CancelError } from "@/lib/event-cancellation";

const ID = "6f1d2c1e-8a8b-4c3e-9d1e-1a2b3c4d5e6f";
const post = (handler: typeof organiserCancel, body: unknown = {}) =>
  handler(
    new NextRequest(`http://localhost/api/x/events/${ID}/cancel`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: ID }) },
  );

const SUMMARY = { refunded: 3, failed: 0, released: 1, refundedCents: 31620, alreadyCancelled: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOrganiser.mockResolvedValue({ session: { sub: "org-1", role: "OWNER" } });
  mocks.getAdminSession.mockResolvedValue({ sub: "admin-1" });
  mocks.eventFindUnique.mockResolvedValue({ id: ID, organiserId: "org-1", title: "Harbour 10K" });
  mocks.cancelEvent.mockResolvedValue(SUMMARY);
});

describe("organiser cancel", () => {
  it("lets an owner cancel their event and reports the refunds", async () => {
    const res = await post(organiserCancel, { reason: "Permit withdrawn" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, refunded: 3, refundedCents: 31620 });
    expect(mocks.cancelEvent).toHaveBeenCalledWith({
      eventId: ID,
      actor: { role: "organiser", id: "org-1" },
      reason: "Permit withdrawn",
    });
  });

  it("refuses a manager", async () => {
    mocks.requireOrganiser.mockResolvedValue({ session: { sub: "org-1", role: "MANAGER" } });
    const res = await post(organiserCancel);
    expect(res.status).toBe(403);
    expect(mocks.cancelEvent).not.toHaveBeenCalled();
  });

  it("refuses another organisation's event", async () => {
    mocks.eventFindUnique.mockResolvedValue({ id: ID, organiserId: "org-2" });
    const res = await post(organiserCancel);
    expect(res.status).toBe(403);
  });

  it("passes a refusal through with its status", async () => {
    mocks.cancelEvent.mockRejectedValue(new CancelError("A finished event can't be cancelled.", 409, "NOT_CANCELLABLE"));
    const res = await post(organiserCancel);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NOT_CANCELLABLE");
  });
});

describe("admin cancel", () => {
  it("cancels and writes the audit log", async () => {
    const res = await post(adminCancel, { reason: "Organiser unreachable" });
    expect(res.status).toBe(200);
    expect(mocks.cancelEvent).toHaveBeenCalledWith(expect.objectContaining({ actor: { role: "admin", id: "admin-1" } }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "CANCEL_EVENT",
      targetType: "event",
      targetId: ID,
      meta: expect.objectContaining({ refunded: 3, refundedCents: 31620, reason: "Organiser unreachable" }),
    }));
  });

  it("audits a retry on an already cancelled event as a retry", async () => {
    mocks.cancelEvent.mockResolvedValue({ ...SUMMARY, alreadyCancelled: true });
    await post(adminCancel);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "RETRY_CANCELLATION_REFUNDS" }));
  });

  it("requires an admin", async () => {
    mocks.getAdminSession.mockResolvedValue(null);
    const res = await post(adminCancel);
    expect(res.status).toBe(401);
  });
});
