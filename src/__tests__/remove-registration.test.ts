import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  registrationFindFirst: vi.fn(),
  registrationFindUnique: vi.fn(),
  registrationUpdateMany: vi.fn(),
  registrationCount: vi.fn(),
  removalCreate: vi.fn(),
  teamUpdate: vi.fn(),
  notificationCreateMany: vi.fn(),
  issueEntryRefund: vi.fn(),
  upsertBlock: vi.fn(),
  sendEmail: vi.fn(),
  prepareSwap: vi.fn(),
  applySwap: vi.fn(),
  provisionReplacement: vi.fn(),
  sendEntryConfirmation: vi.fn(),
  lock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    registration: {
      findFirst: mocks.registrationFindFirst,
      findUnique: mocks.registrationFindUnique,
      updateMany: mocks.registrationUpdateMany,
      count: mocks.registrationCount,
    },
    registrationRemoval: { create: mocks.removalCreate },
    team: { update: mocks.teamUpdate },
    userNotification: { createMany: mocks.notificationCreateMany },
    $transaction: (fn: (tx: unknown) => unknown) => fn(client),
  };
  return { default: client };
});

vi.mock("@/lib/issue-entry-refund", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/issue-entry-refund")>();
  return { ...actual, issueEntryRefund: mocks.issueEntryRefund };
});
vi.mock("@/lib/organiser-blocks", () => ({
  upsertOrganiserBlock: mocks.upsertBlock,
  normalizeBlockEmail: (e: string | null | undefined) => (e ?? "").trim().toLowerCase(),
}));
vi.mock("@/lib/email", () => ({ sendRemovedFromEventEmail: mocks.sendEmail }));
vi.mock("@/lib/event-entry-lock", () => ({ lockEventEntries: mocks.lock }));
vi.mock("@/lib/registration-confirm", () => ({ sendEntryConfirmation: mocks.sendEntryConfirmation }));
vi.mock("@/lib/team-swap", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/team-swap")>();
  return {
    ...actual,
    prepareSwap: mocks.prepareSwap,
    applySwap: mocks.applySwap,
    provisionReplacement: mocks.provisionReplacement,
  };
});

import { removeRegistration, RemovalError } from "@/lib/remove-registration";
import { RefundError } from "@/lib/issue-entry-refund";
import { SwapError } from "@/lib/team-swap";

// $100 ticket with a $5.40 booking fee the athlete paid on top.
const PAID_ENTRY = {
  id: "reg-1",
  status: "CONFIRMED",
  amountCents: 10000,
  platformFeeCents: 540,
  feeStructure: "athlete",
  refundAmountCents: null,
  refundPercent: null,
  stripePaymentIntentId: "pi_1",
  athleteName: "Harper Jones",
  athleteEmail: "harper.jones@startline.test",
  userId: "user-1",
  eventId: "evt-1",
  organiserId: "org-1",
  teamId: null,
  team: null,
  event: { id: "evt-1", title: "Harbour 10K", organiser: { orgName: "Apex Endurance Events" } },
};
const FREE_ENTRY = { ...PAID_ENTRY, amountCents: 0, platformFeeCents: 0, stripePaymentIntentId: null };

const base = {
  registrationId: "reg-1",
  eventId: "evt-1",
  organiserId: "org-1",
  actorEmail: "sarah.mitchell@startline.test",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.registrationUpdateMany.mockResolvedValue({ count: 1 });
  mocks.issueEntryRefund.mockResolvedValue({ method: "stripe", refundId: "re_1", refundCents: 10540 });
  mocks.removalCreate.mockResolvedValue({});
  mocks.notificationCreateMany.mockResolvedValue({ count: 1 });
  mocks.sendEmail.mockResolvedValue(undefined);
});

describe("removeRegistration — free entry", () => {
  it("removes, releases the bib and wave, logs it and tells the athlete", async () => {
    mocks.registrationFindFirst.mockResolvedValue(FREE_ENTRY);

    const result = await removeRegistration({ ...base, reason: "NO_SHOW_BRIEFING", refund: "FULL" });

    expect(result).toEqual({ refund: "NOT_PAID", refundCents: 0, blocked: false, warning: null, replacedBy: null });
    expect(mocks.issueEntryRefund).not.toHaveBeenCalled();
    expect(mocks.registrationUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "reg-1", status: { in: ["CONFIRMED", "REFUND_REQUESTED"] } },
      data: { bibNumber: null, startWaveId: null, startWaveLabel: null, status: "REMOVED" },
    });
    expect(mocks.removalCreate.mock.calls[0][0].data).toMatchObject({
      registrationId: "reg-1",
      organiserId: "org-1",
      removedByEmail: "sarah.mitchell@startline.test",
      reason: "NO_SHOW_BRIEFING",
      refund: "NOT_PAID",
      refundCents: 0,
      blocked: false,
    });
    expect(mocks.notificationCreateMany.mock.calls[0][0].data[0]).toMatchObject({
      userId: "user-1", type: "REMOVED_FROM_EVENT", eventId: "evt-1",
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith("harper.jones@startline.test", expect.objectContaining({
      reasonLabel: "No-show to a required briefing", refundCents: 0, noRefund: false, blocked: false,
    }));
  });

  it("refuses an entry that no longer holds a place", async () => {
    mocks.registrationFindFirst.mockResolvedValue({ ...FREE_ENTRY, status: "REFUNDED" });
    await expect(removeRegistration({ ...base, reason: "DUPLICATE", refund: "FULL" }))
      .rejects.toMatchObject({ status: 409 });
    expect(mocks.removalCreate).not.toHaveBeenCalled();
  });

  it("only finds entries on the organiser's own event", async () => {
    mocks.registrationFindFirst.mockResolvedValue(null);
    await expect(removeRegistration({ ...base, reason: "DUPLICATE", refund: "FULL" }))
      .rejects.toMatchObject({ status: 404 });
    expect(mocks.registrationFindFirst.mock.calls[0][0].where).toEqual({
      id: "reg-1", eventId: "evt-1", organiserId: "org-1",
    });
  });

  it("needs a note when the reason is Other", async () => {
    await expect(removeRegistration({ ...base, reason: "OTHER", note: "  ", refund: "FULL" }))
      .rejects.toBeInstanceOf(RemovalError);
    expect(mocks.registrationFindFirst).not.toHaveBeenCalled();
  });

  it("passes the note on only when the organiser shares it", async () => {
    mocks.registrationFindFirst.mockResolvedValue(FREE_ENTRY);
    await removeRegistration({ ...base, reason: "OTHER", note: "Private", refund: "FULL" });
    expect(mocks.sendEmail.mock.calls[0][1].note).toBeNull();
    expect(mocks.removalCreate.mock.calls[0][0].data).toMatchObject({ note: "Private", noteShared: false });

    mocks.registrationFindFirst.mockResolvedValue(FREE_ENTRY);
    await removeRegistration({ ...base, reason: "OTHER", note: "Shared", shareNote: true, refund: "FULL" });
    expect(mocks.sendEmail.mock.calls[1][1].note).toBe("Shared");
  });

  it("reports a stale entry instead of logging a removal that did not happen", async () => {
    mocks.registrationFindFirst.mockResolvedValue(FREE_ENTRY);
    mocks.registrationUpdateMany.mockResolvedValue({ count: 0 });
    await expect(removeRegistration({ ...base, reason: "DUPLICATE", refund: "FULL" }))
      .rejects.toMatchObject({ status: 409 });
    expect(mocks.removalCreate).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe("removeRegistration — paid entry", () => {
  it("refunds everything the athlete paid and removes in the same write", async () => {
    mocks.registrationFindFirst.mockResolvedValue(PAID_ENTRY);

    const result = await removeRegistration({ ...base, reason: "INELIGIBLE", refund: "FULL" });

    expect(result).toMatchObject({ refund: "FULL", refundCents: 10540 });
    const [entry, options] = mocks.issueEntryRefund.mock.calls[0];
    expect(entry.refundAmountCents).toBe(10540);
    expect(options).toEqual({
      finalStatus: "REMOVED",
      extraData: { bibNumber: null, startWaveId: null, startWaveLabel: null },
      notify: false,
    });
    // The refund wrote the status; nothing writes it twice.
    expect(mocks.registrationUpdateMany).not.toHaveBeenCalled();
    expect(mocks.removalCreate.mock.calls[0][0].data).toMatchObject({
      refund: "FULL", refundCents: 10540, stripeRefundId: "re_1",
    });
    expect(mocks.sendEmail.mock.calls[0][1]).toMatchObject({ refundCents: 10540, noRefund: false });
  });

  it.each(["NO_SHOW_BRIEFING", "INELIGIBLE", "DUPLICATE", "OTHER"] as const)(
    "will not keep the fee for %s",
    async (reason) => {
      mocks.registrationFindFirst.mockResolvedValue(PAID_ENTRY);
      await expect(removeRegistration({ ...base, reason, note: "x", refund: "NONE" }))
        .rejects.toMatchObject({ status: 400 });
      expect(mocks.issueEntryRefund).not.toHaveBeenCalled();
      expect(mocks.registrationUpdateMany).not.toHaveBeenCalled();
    },
  );

  it("lets a code of conduct removal keep the fee", async () => {
    mocks.registrationFindFirst.mockResolvedValue(PAID_ENTRY);

    const result = await removeRegistration({ ...base, reason: "CODE_OF_CONDUCT", refund: "NONE" });

    expect(result).toMatchObject({ refund: "NONE", refundCents: 0 });
    expect(mocks.issueEntryRefund).not.toHaveBeenCalled();
    expect(mocks.registrationUpdateMany.mock.calls[0][0].data.status).toBe("REMOVED");
    expect(mocks.sendEmail.mock.calls[0][1]).toMatchObject({ refundCents: 0, noRefund: true });
  });

  it("leaves the entry alone when Stripe refuses the refund", async () => {
    mocks.registrationFindFirst.mockResolvedValue(PAID_ENTRY);
    mocks.issueEntryRefund.mockRejectedValue(new RefundError("No charge found on this payment intent.", 422, "NO_CHARGE"));

    await expect(removeRegistration({ ...base, reason: "INELIGIBLE", refund: "FULL" }))
      .rejects.toMatchObject({ status: 422, message: "No charge found on this payment intent." });
    expect(mocks.removalCreate).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe("removeRegistration — block and team", () => {
  it("blocks the account and email when asked", async () => {
    mocks.registrationFindFirst.mockResolvedValue(FREE_ENTRY);

    const result = await removeRegistration({ ...base, reason: "CODE_OF_CONDUCT", refund: "FULL", block: true });

    expect(result.blocked).toBe(true);
    expect(mocks.upsertBlock.mock.calls[0][0]).toMatchObject({
      organiserId: "org-1",
      email: "harper.jones@startline.test",
      userId: "user-1",
      createdByEmail: "sarah.mitchell@startline.test",
    });
    expect(mocks.removalCreate.mock.calls[0][0].data.blocked).toBe(true);
  });

  it("removes one member, warns that the team is short and tells its captain", async () => {
    mocks.registrationFindFirst.mockResolvedValue({
      ...FREE_ENTRY,
      id: "reg-2",
      userId: "user-2",
      teamId: "team-1",
      team: { id: "team-1", name: "Rockets", size: 4, captainRegistrationId: "reg-1" },
    });
    mocks.registrationCount.mockResolvedValue(3);
    mocks.registrationFindUnique.mockResolvedValue({ userId: "user-1" });

    const result = await removeRegistration({ ...base, registrationId: "reg-2", reason: "INELIGIBLE", refund: "FULL" });

    expect(result.warning).toBe("Team Rockets now has 3 of 4 members.");
    expect(mocks.teamUpdate).not.toHaveBeenCalled();
    const rows = mocks.notificationCreateMany.mock.calls[0][0].data;
    expect(rows.map((r: { userId: string }) => r.userId)).toEqual(["user-2", "user-1"]);
  });

  it("clears the captain when the captain is the one removed", async () => {
    mocks.registrationFindFirst.mockResolvedValue({
      ...FREE_ENTRY,
      teamId: "team-1",
      team: { id: "team-1", name: "Rockets", size: 2, captainRegistrationId: "reg-1" },
    });
    mocks.registrationCount.mockResolvedValue(1);

    await removeRegistration({ ...base, reason: "INELIGIBLE", refund: "FULL" });

    expect(mocks.teamUpdate).toHaveBeenCalledWith({ where: { id: "team-1" }, data: { captainRegistrationId: null } });
  });

  it("still completes when the notice fails", async () => {
    mocks.registrationFindFirst.mockResolvedValue(FREE_ENTRY);
    mocks.notificationCreateMany.mockRejectedValue(new Error("db down"));
    mocks.sendEmail.mockRejectedValue(new Error("resend down"));

    await expect(removeRegistration({ ...base, reason: "DUPLICATE", refund: "FULL" })).resolves.toMatchObject({
      refund: "NOT_PAID",
    });
  });
});

describe("removeRegistration — remove and replace a team member", () => {
  const TEAM_MEMBER = {
    ...PAID_ENTRY,
    id: "reg-2",
    userId: "user-2",
    athleteName: "Sam Reid",
    athleteEmail: "sam@example.com",
    teamId: "team-1",
    detailsPending: false,
    team: { id: "team-1", name: "Rockets", size: 4, captainRegistrationId: "reg-1" },
  };
  const REPLACEMENT = {
    firstName: "Ash", lastName: "Kerr", email: "ash@example.com", dateOfBirth: "1995-04-02",
    mobile: "0400000000", emergencyContactName: "Jo", emergencyContactPhone: "0400000001",
  };
  const replace = (over: Record<string, unknown> = {}) =>
    removeRegistration({ ...base, registrationId: "reg-2", reason: "INELIGIBLE", refund: "FULL", replacement: REPLACEMENT, ...over });

  beforeEach(() => {
    mocks.registrationFindFirst.mockResolvedValue(TEAM_MEMBER);
    mocks.prepareSwap.mockImplementation(async (_t, details) => ({ ...details, gender: "" }));
    mocks.provisionReplacement.mockResolvedValue({ "ash@example.com": "user-9" });
    mocks.applySwap.mockResolvedValue({
      previous: { athleteName: "Sam Reid", athleteEmail: "sam@example.com" },
      email: "ash@example.com",
      athleteName: "Ash Kerr",
      waveLabel: "General",
      amountCents: 10000,
      platformFeeCents: 540,
    });
    mocks.registrationFindUnique.mockResolvedValue({ userId: "user-1" });
  });

  it("hands the place over, refunds nothing and logs who left and who took over", async () => {
    const result = await replace();

    expect(result).toEqual({ refund: "REPLACED", refundCents: 0, blocked: false, warning: null, replacedBy: "Ash Kerr" });
    expect(mocks.issueEntryRefund).not.toHaveBeenCalled();
    // The place is never emptied: the swap writes the row, not a REMOVED status.
    expect(mocks.registrationUpdateMany).not.toHaveBeenCalled();
    expect(mocks.lock).toHaveBeenCalledWith(expect.anything(), "evt-1");
    expect(mocks.applySwap.mock.calls[0][1]).toEqual({
      eventId: "evt-1", teamId: "team-1", registrationId: "reg-2", organiserId: "org-1",
    });
    expect(mocks.removalCreate.mock.calls[0][0].data).toMatchObject({
      registrationId: "reg-2",
      athleteName: "Sam Reid",
      athleteEmail: "sam@example.com",
      replacedByName: "Ash Kerr",
      replacedByEmail: "ash@example.com",
      refund: "REPLACED",
      refundCents: 0,
    });
  });

  it("confirms the place to the new member and tells the removed one and the captain", async () => {
    await replace();

    expect(mocks.sendEntryConfirmation.mock.calls[0][1]).toMatchObject({
      email: "ash@example.com", team: { name: "Rockets", size: 4 },
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith("sam@example.com", expect.objectContaining({
      teamName: "Rockets", refundCents: 0, noRefund: false,
    }));
    const rows = mocks.notificationCreateMany.mock.calls[0][0].data;
    expect(rows.map((r: { userId: string }) => r.userId)).toEqual(["user-2", "user-1"]);
    expect(rows[1].title).toBe("Team member replaced");
  });

  it("can block the removed person while giving the place to someone else", async () => {
    await replace({ block: true });
    expect(mocks.upsertBlock.mock.calls[0][0]).toMatchObject({ email: "sam@example.com", userId: "user-2" });
  });

  it("refuses to block an address the replacement is using", async () => {
    await expect(replace({ block: true, replacement: { ...REPLACEMENT, email: "SAM@example.com" } }))
      .rejects.toMatchObject({ status: 400 });
    expect(mocks.applySwap).not.toHaveBeenCalled();
  });

  it("passes on why the swap was refused, and writes nothing", async () => {
    mocks.prepareSwap.mockRejectedValue(new SwapError("Ash Kerr already holds an entry for this event.", 409));

    await expect(replace()).rejects.toMatchObject({ status: 409, message: "Ash Kerr already holds an entry for this event." });
    expect(mocks.removalCreate).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("only replaces a named team member", async () => {
    mocks.registrationFindFirst.mockResolvedValue({ ...PAID_ENTRY, teamId: null, team: null });
    await expect(replace()).rejects.toBeInstanceOf(RemovalError);

    mocks.registrationFindFirst.mockResolvedValue({ ...TEAM_MEMBER, detailsPending: true });
    await expect(replace()).rejects.toMatchObject({ status: 400 });
    expect(mocks.prepareSwap).not.toHaveBeenCalled();
  });
});

describe("removeRegistration — notices", () => {
  it("still completes when every notice fails", async () => {
    mocks.registrationFindFirst.mockResolvedValue(FREE_ENTRY);
    mocks.notificationCreateMany.mockRejectedValue(new Error("db down"));
    mocks.sendEmail.mockRejectedValue(new Error("resend down"));

    await expect(removeRegistration({ ...base, reason: "DUPLICATE", refund: "FULL" })).resolves.toMatchObject({
      refund: "NOT_PAID",
    });
  });
});
