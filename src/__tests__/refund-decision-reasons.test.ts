import { describe, expect, it } from "vitest";
import {
  APPROVE_REASONS,
  DECLINE_REASONS,
  REFUND_REASON_LABEL,
  isApproveReason,
  refundNoteRequired,
  refundTypeFor,
} from "@/lib/refund-decision-reasons";
import { changeOfMindQuote } from "@/lib/refund-policy";
import { buildRefundDecisionEmail } from "@/lib/email";

describe("refund decision reasons (#492)", () => {
  it("only the policy reason returns the policy amount; the rest refund in full", () => {
    expect(refundTypeFor("WITHIN_POLICY")).toBe("POLICY");
    expect(refundTypeFor("EVENT_CHANGED")).toBe("FULL");
    expect(refundTypeFor("NOT_DELIVERED")).toBe("FULL");
    expect(refundTypeFor("GOODWILL")).toBe("TICKET");
  });

  it("keeps approve and decline reasons apart", () => {
    for (const r of APPROVE_REASONS) expect(isApproveReason(r)).toBe(true);
    for (const r of DECLINE_REASONS) expect(isApproveReason(r)).toBe(false);
  });

  it("needs a note on every decline and on goodwill", () => {
    expect(refundNoteRequired("OUTSIDE_POLICY")).toBe(true);
    expect(refundNoteRequired("OTHER")).toBe(true);
    expect(refundNoteRequired("GOODWILL")).toBe(true);
    expect(refundNoteRequired("WITHIN_POLICY")).toBe(false);
    expect(refundNoteRequired("EVENT_CHANGED")).toBe(false);
  });

  it("labels every reason", () => {
    for (const r of [...APPROVE_REASONS, ...DECLINE_REASONS]) expect(REFUND_REASON_LABEL[r]).toBeTruthy();
  });
});

describe("changeOfMindQuote", () => {
  const entry = {
    amountCents: 5000,
    soldRefundTiers: [{ daysBefore: 14, percent: 50 }],
    eventRefundTiers: [{ daysBefore: 0, percent: 100 }],
    eventDate: "2026-12-31",
  };

  it("uses the policy the entry was sold under, on the ticket price only", () => {
    expect(changeOfMindQuote(entry, new Date("2026-12-01T02:00:00Z"))).toEqual({ percent: 50, cents: 2500 });
  });

  it("owes nothing once the window has closed", () => {
    expect(changeOfMindQuote(entry, new Date("2026-12-25T02:00:00Z"))).toEqual({ percent: 0, cents: 0 });
  });

  it("owes nothing inside 24 hours of the start, whatever the policy says", () => {
    const startsAtUtc = new Date("2026-12-31T21:00:00Z");
    const lastDay = new Date("2026-12-31T01:00:00Z");
    expect(
      changeOfMindQuote({ ...entry, soldRefundTiers: null, startsAtUtc }, lastDay),
    ).toEqual({ percent: 0, cents: 0 });
    // The day before, outside the cutoff, the always-refundable policy still pays.
    expect(
      changeOfMindQuote({ ...entry, soldRefundTiers: null, startsAtUtc }, new Date("2026-12-29T21:00:00Z")),
    ).toEqual({ percent: 100, cents: 5000 });
  });

  it("falls back to the event's policy when none was frozen", () => {
    expect(changeOfMindQuote({ ...entry, soldRefundTiers: null }, new Date("2026-12-25T02:00:00Z"))).toEqual({ percent: 100, cents: 5000 });
  });
});

describe("buildRefundDecisionEmail", () => {
  const base = {
    athleteName: "Harper Jones",
    eventTitle: "Harbour 10K",
    organiserName: "Apex Endurance",
    ticketId: "6f1d2c1e-8a8b-4c3e-9d1e-1a2b3c4d5e6f",
  };

  it("says a full refund includes the booking fee", async () => {
    const email = await buildRefundDecisionEmail({ ...base, outcome: "refunded", amountCents: 5300, full: true });
    expect(email.subject).toBe("Your refund is on its way: Harbour 10K");
    expect(email.text).toContain("$53.00, booking fee included");
    expect(email.text).toContain("6f1d2c1e");
  });

  it("gives the organiser's reason and note on a decline", async () => {
    const email = await buildRefundDecisionEmail({
      ...base,
      outcome: "declined",
      amountCents: null,
      full: false,
      reasonLabel: "Outside our refund policy",
      note: "Inside 14 days.",
    });
    expect(email.subject).toBe("Refund request declined: Harbour 10K");
    expect(email.text).toContain("Outside our refund policy");
    expect(email.text).toContain("Inside 14 days.");
    expect(email.text).toContain("Australian Consumer Law");
  });

  it("shows the policy quote when the request arrives", async () => {
    const email = await buildRefundDecisionEmail({
      ...base,
      outcome: "requested",
      amountCents: 2500,
      full: false,
      respondBy: "Wed 2 Dec",
    });
    expect(email.subject).toBe("Refund request received: Harbour 10K");
    expect(email.text).toContain("$25.00");
    expect(email.text).toContain("Wed 2 Dec");
  });
});
