import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  canOrganiserDecide,
  evaluateAdminAction,
  organiserResponseDue,
  type TicketForRules,
} from "@/lib/refund-ticket-rules";

// Wednesday 4 Nov 2026, 01:00 UTC.
const WED = new Date("2026-11-04T01:00:00.000Z");

const ticket = (over: Partial<TicketForRules> = {}): TicketForRules => ({
  status: "OPEN",
  organiserDecision: null,
  createdAt: WED,
  ...over,
});

describe("addBusinessDays", () => {
  it("counts Monday to Friday only", () => {
    // Wed + 3 business days = Mon (Thu, Fri, Mon).
    expect(addBusinessDays(WED, 3).toISOString()).toBe("2026-11-09T01:00:00.000Z");
  });

  it("starts a weekend ticket's clock on Monday", () => {
    const sat = new Date("2026-11-07T10:00:00.000Z");
    expect(addBusinessDays(sat, 3).toISOString()).toBe("2026-11-11T10:00:00.000Z");
  });

  it("gives the organiser three business days", () => {
    expect(organiserResponseDue(ticket())).toEqual(addBusinessDays(WED, 3));
  });
});

describe("canOrganiserDecide", () => {
  it("allows only an open ticket", () => {
    expect(canOrganiserDecide({ status: "OPEN" })).toBe(true);
    expect(canOrganiserDecide({ status: "APPROVED" })).toBe(false);
    expect(canOrganiserDecide({ status: "DECLINED" })).toBe(false);
    expect(canOrganiserDecide({ status: "REFUNDED" })).toBe(false);
  });
});

describe("evaluateAdminAction", () => {
  const beforeDue = new Date("2026-11-05T01:00:00.000Z");
  const afterDue = new Date("2026-11-10T01:00:00.000Z");

  it("refuses a plain decision while the organiser's window is open", () => {
    const result = evaluateAdminAction(ticket(), { action: "approve" }, beforeDue);
    expect(result).toMatchObject({ ok: false, httpStatus: 409 });
    if (!result.ok) expect(result.error).toMatch(/has until/);
  });

  it("lets Startline decide once the organiser has not responded in time", () => {
    const result = evaluateAdminAction(ticket(), { action: "decline" }, afterDue);
    expect(result).toEqual({
      ok: true,
      status: "DECLINED",
      kind: "NO_RESPONSE",
      auditAction: "REFUND_TICKET_NO_RESPONSE_DECLINED",
      note: null,
      notifyOrganiser: false,
    });
  });

  it("refuses to overwrite an organiser's decision without an override", () => {
    const decided = ticket({ status: "DECLINED", organiserDecision: "DECLINED" });
    const result = evaluateAdminAction(decided, { action: "approve" }, afterDue);
    expect(result).toMatchObject({ ok: false, httpStatus: 409 });
    if (!result.ok) expect(result.error).toMatch(/organiser has already decided/);
  });

  it("needs a note for an override", () => {
    const decided = ticket({ status: "DECLINED", organiserDecision: "DECLINED" });
    expect(evaluateAdminAction(decided, { action: "approve", override: true }, afterDue))
      .toMatchObject({ ok: false, httpStatus: 400 });
    expect(evaluateAdminAction(decided, { action: "approve", override: true, note: "   " }, afterDue))
      .toMatchObject({ ok: false, httpStatus: 400 });
  });

  it("records an override with its note, audits it and tells the organiser", () => {
    const decided = ticket({ status: "DECLINED", organiserDecision: "DECLINED" });
    const result = evaluateAdminAction(
      decided,
      { action: "approve", override: true, note: "  Date moved; ACL remedy owed.  " },
      beforeDue,
    );
    expect(result).toEqual({
      ok: true,
      status: "APPROVED",
      kind: "OVERRIDE",
      auditAction: "REFUND_TICKET_OVERRIDE",
      note: "Date moved; ACL remedy owed.",
      notifyOrganiser: true,
    });
  });

  it("allows an override inside the window too", () => {
    const result = evaluateAdminAction(ticket(), { action: "approve", override: true, note: "Urgent" }, beforeDue);
    expect(result).toMatchObject({ ok: true, kind: "OVERRIDE" });
  });

  it("refuses an override that changes nothing", () => {
    const approved = ticket({ status: "APPROVED", organiserDecision: "APPROVED" });
    expect(evaluateAdminAction(approved, { action: "approve", override: true, note: "x" }, afterDue))
      .toMatchObject({ ok: false, httpStatus: 409 });
  });

  it("marks refunded only after an approval", () => {
    expect(evaluateAdminAction(ticket(), { action: "refunded" }, afterDue))
      .toMatchObject({ ok: false, httpStatus: 409 });
    expect(evaluateAdminAction(ticket({ status: "DECLINED", organiserDecision: "DECLINED" }), { action: "refunded" }, afterDue))
      .toMatchObject({ ok: false, httpStatus: 409 });
    expect(evaluateAdminAction(ticket({ status: "APPROVED", organiserDecision: "APPROVED" }), { action: "refunded" }, beforeDue))
      .toMatchObject({ ok: true, status: "REFUNDED", kind: null, auditAction: "REFUND_TICKET_REFUNDED" });
  });

  it("never changes a refunded ticket", () => {
    const refunded = ticket({ status: "REFUNDED", organiserDecision: "APPROVED" });
    for (const action of ["approve", "decline", "refunded"] as const) {
      expect(evaluateAdminAction(refunded, { action, override: true, note: "x" }, afterDue))
        .toMatchObject({ ok: false, httpStatus: 409 });
    }
  });
});
