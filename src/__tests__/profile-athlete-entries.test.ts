import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import { athleteUserIdsFor, legacySelfIndex } from "@/lib/registration-confirm";
import { buyersOwnTicket, compactOrderParticipant } from "@/lib/checkout-order";
import { isSuggestedByEmail, profileHistoryWhere, suggestedByEmailWhere } from "@/lib/profile-history";
import { claimEntry, unclaimEntry } from "@/lib/claim-entries";
import { signEntryClaim } from "@/lib/entry-claim-token";
import { createEmptyParticipant, type CompactParticipant } from "@/lib/registration-form";

// One event listed once per ticket the buyer paid for (#592), and race
// history that only the athlete can add to (#598).

const entry = (participant: Partial<CompactParticipant>) => ({
  participant: { fn: "A", ln: "B", dob: "", em: "", mob: "", ecn: "", ecp: "", ...participant },
});

describe("which ticket is the buyer's own", () => {
  it("is the one marked as theirs", () => {
    expect(buyersOwnTicket([{}, { isSelf: true }, {}], true)).toBe(1);
  });

  it("is nobody's when the buyer is not signed in", () => {
    expect(buyersOwnTicket([{ isSelf: true }], false)).toBeNull();
  });

  it("keeps only the first when a request marks several", () => {
    expect(buyersOwnTicket([{ isSelf: true }, { isSelf: true }], true)).toBe(0);
  });

  it("is never a place left for later", () => {
    expect(buyersOwnTicket([{ isSelf: true, detailsLater: true }], true)).toBeNull();
  });

  it("travels to the confirm step as `me`, and never on a pending place", () => {
    const person = { ...createEmptyParticipant(), firstName: "Sam", email: "sam@x.test" };
    expect(compactOrderParticipant({ ...person, isSelf: true }).me).toBe(1);
    expect(compactOrderParticipant(person).me).toBeUndefined();
    expect(compactOrderParticipant({ ...person, isSelf: true, detailsLater: true }).me).toBeUndefined();
  });
});

describe("athleteUserIdsFor", () => {
  it("gives a signed-in buyer only their own ticket, not every ticket they paid for", () => {
    const ids = athleteUserIdsFor(
      [entry({ em: "buyer@x.test", me: 1 }), entry({ em: "buyer@x.test" }), entry({ em: "friend@x.test" })],
      "buyer-id",
      {},
    );
    expect(ids).toEqual(["buyer-id", null, null]);
  });

  it("gives a signed-in buyer nothing when no ticket is theirs", () => {
    expect(athleteUserIdsFor([entry({ em: "kid@x.test" })], "buyer-id", {})).toEqual([null]);
  });

  it("never gives a buyer two entries in one order", () => {
    const ids = athleteUserIdsFor([entry({ me: 1 }), entry({ me: 1 })], "buyer-id", {});
    expect(ids).toEqual(["buyer-id", null]);
  });

  it("does not give a buyer a team place left for later", () => {
    expect(athleteUserIdsFor([entry({ me: 1, pnd: 1 })], "buyer-id", {})).toEqual([null]);
  });

  it("on a guest checkout, gives each new account the first entry on its address", () => {
    const ids = athleteUserIdsFor(
      [
        entry({ em: "Parent@x.test" }),
        entry({ em: "parent@x.test" }),
        entry({ em: "other@x.test" }),
        entry({ em: "nobody@x.test" }),
      ],
      "",
      { "parent@x.test": "parent-id", "other@x.test": "other-id" },
    );
    expect(ids).toEqual(["parent-id", null, "other-id", null]);
  });
});

describe("legacySelfIndex (orders set up before the Me flag)", () => {
  const buyer = { email: "Parent@x.test", name: "Pat Parent" };

  it("picks the entry on the buyer's address whose name matches the account", () => {
    const people = [
      entry({ em: "parent@x.test", fn: "Kid", ln: "Parent" }).participant,
      entry({ em: "parent@x.test", fn: "Pat", ln: "Parent" }).participant,
    ];
    expect(legacySelfIndex(people, buyer)).toBe(1);
  });

  it("falls back to the first entry on the buyer's address", () => {
    const people = [
      entry({ em: "friend@x.test" }).participant,
      entry({ em: "parent@x.test", fn: "Kid" }).participant,
    ];
    expect(legacySelfIndex(people, buyer)).toBe(1);
  });

  it("never picks a place left for later, or someone on another address", () => {
    const people = [
      entry({ em: "parent@x.test", pnd: 1 }).participant,
      entry({ em: "friend@x.test", fn: "Pat", ln: "Parent" }).participant,
    ];
    expect(legacySelfIndex(people, buyer)).toBeNull();
  });
});

describe("profileHistoryWhere", () => {
  const where = profileHistoryWhere({ id: "u1" });

  it("lists only confirmed entries the athlete added or bought for themselves", () => {
    expect(where).toEqual({ status: "CONFIRMED", athleteUserId: "u1" });
  });

  it("never matches by email, so nobody can put a race on someone else's profile", () => {
    expect(JSON.stringify(where)).not.toContain("athleteEmail");
  });
});

describe("suggestedByEmailWhere and isSuggestedByEmail agree", () => {
  const user = { id: "u1", email: "me@x.test" };
  const row = {
    status: "CONFIRMED", athleteUserId: null, detailsPending: false,
    athleteEmail: "ME@x.test", userId: "buyer" as string | null,
  };

  it("offers an unadded entry someone else bought under the address", () => {
    expect(isSuggestedByEmail(row, user)).toBe(true);
    expect(suggestedByEmailWhere(user)).toEqual({
      status: "CONFIRMED",
      athleteUserId: null,
      detailsPending: false,
      athleteEmail: { equals: "me@x.test", mode: "insensitive" },
      OR: [{ userId: null }, { userId: { not: "u1" } }],
    });
  });

  it("does not offer the athlete's own purchases, added entries, pending places or withdrawals", () => {
    expect(isSuggestedByEmail({ ...row, userId: "u1" }, user)).toBe(false);
    expect(isSuggestedByEmail({ ...row, athleteUserId: "someone" } as never, user)).toBe(false);
    expect(isSuggestedByEmail({ ...row, detailsPending: true }, user)).toBe(false);
    expect(isSuggestedByEmail({ ...row, status: "REFUNDED" }, user)).toBe(false);
  });

  it("offers a guest checkout's entry, which has no buyer", () => {
    expect(isSuggestedByEmail({ ...row, userId: null }, user)).toBe(true);
  });
});

describe("claimEntry", () => {
  const user = { id: "u1", email: "me@x.test" };
  type Row = {
    id: string; eventId: string; status: string; userId: string | null; athleteUserId: string | null;
    athleteEmail: string; detailsPending: boolean;
  };
  const baseRow: Row = {
    id: "r1", eventId: "e1", status: "CONFIRMED", userId: "buyer", athleteUserId: null,
    athleteEmail: "me@x.test", detailsPending: false,
  };

  const fakeDb = (row: Row | null, opts: { otherEntry?: boolean; updated?: number } = {}) => {
    const updateMany = vi.fn(async () => ({ count: opts.updated ?? 1 }));
    const executeRaw = vi.fn(async () => 1);
    const tx = {
      $executeRaw: executeRaw,
      registration: {
        findUnique: vi.fn(async () => row),
        findFirst: vi.fn(async () => (opts.otherEntry ? { id: "other" } : null)),
        updateMany,
      },
    };
    const transaction = vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx));
    return { db: { $transaction: transaction } as never, transaction, updateMany, executeRaw };
  };

  it("adds an entry offered by email, under the event's entry lock", async () => {
    const { db, updateMany, executeRaw } = fakeDb(baseRow);
    expect(await claimEntry({ registrationId: "r1", user }, db)).toBe("claimed");
    expect(executeRaw).toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "r1", athleteUserId: null },
      data: { athleteUserId: "u1" },
    });
  });

  it("does not let an account add an entry on another address without a link", async () => {
    const { db, updateMany } = fakeDb({ ...baseRow, athleteEmail: "friend@x.test" });
    expect(await claimEntry({ registrationId: "r1", user }, db)).toBe("not-found");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("does not offer an entry already on someone else's profile", async () => {
    const { db } = fakeDb({ ...baseRow, athleteUserId: "u2" });
    expect(await claimEntry({ registrationId: "r1", user }, db)).toBe("not-found");
  });

  it("refuses a second race in one event", async () => {
    const { db, updateMany } = fakeDb(baseRow, { otherEntry: true });
    expect(await claimEntry({ registrationId: "r1", user }, db)).toBe("duplicate");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("says so when the entry is already the account's", async () => {
    const { db } = fakeDb({ ...baseRow, athleteUserId: "u1" });
    expect(await claimEntry({ registrationId: "r1", user }, db)).toBe("already-yours");
  });

  it("loses cleanly to a claim that landed first", async () => {
    const { db } = fakeDb(baseRow, { updated: 0 });
    expect(await claimEntry({ registrationId: "r1", user }, db)).toBe("taken");
  });

  it("reports a missing entry", async () => {
    const { db } = fakeDb(null);
    expect(await claimEntry({ registrationId: "r1", user }, db)).toBe("not-found");
  });

  describe("with the confirmation email's link", () => {
    const linked: Row = { ...baseRow, athleteEmail: "other-address@x.test" };
    const tokenFor = (registrationId: string, athleteEmail: string) =>
      signEntryClaim({ registrationId, athleteEmail }) as string;

    beforeEach(() => { vi.stubEnv("ENTRY_CLAIM_SECRET", "test-secret"); });
    afterEach(() => { vi.unstubAllEnvs(); });

    it("adds an entry on an address the account does not use", async () => {
      const { db } = fakeDb(linked);
      expect(await claimEntry({ registrationId: "r1", user, token: tokenFor("r1", linked.athleteEmail) }, db))
        .toBe("claimed");
    });

    it("refuses an entry already on someone else's profile", async () => {
      const { db } = fakeDb({ ...linked, athleteUserId: "u2" });
      expect(await claimEntry({ registrationId: "r1", user, token: tokenFor("r1", linked.athleteEmail) }, db))
        .toBe("taken");
    });

    it("refuses a link for another entry without opening a transaction", async () => {
      const { db, transaction } = fakeDb(linked);
      expect(await claimEntry({ registrationId: "r1", user, token: tokenFor("r2", linked.athleteEmail) }, db))
        .toBe("not-allowed");
      expect(transaction).not.toHaveBeenCalled();
    });

    it("refuses a link sent before the place was swapped to someone else", async () => {
      const { db, updateMany } = fakeDb(linked);
      expect(await claimEntry({ registrationId: "r1", user, token: tokenFor("r1", "previous@x.test") }, db))
        .toBe("not-allowed");
      expect(updateMany).not.toHaveBeenCalled();
    });

    it("refuses a place left for later, and a withdrawn entry", async () => {
      const token = tokenFor("r1", linked.athleteEmail);
      expect(await claimEntry({ registrationId: "r1", user, token }, fakeDb({ ...linked, detailsPending: true }).db))
        .toBe("not-allowed");
      expect(await claimEntry({ registrationId: "r1", user, token }, fakeDb({ ...linked, status: "REFUNDED" }).db))
        .toBe("not-allowed");
    });
  });
});

describe("unclaimEntry", () => {
  it("only ever clears the caller's own claim", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const db = { registration: { updateMany } } as never;
    expect(await unclaimEntry({ registrationId: "r1", userId: "u1" }, db)).toBe("removed");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "r1", athleteUserId: "u1" },
      data: { athleteUserId: null },
    });
  });

  it("reports an entry that is not the caller's as not found", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const db = { registration: { updateMany } } as never;
    expect(await unclaimEntry({ registrationId: "r1", userId: "u1" }, db)).toBe("not-found");
  });
});
