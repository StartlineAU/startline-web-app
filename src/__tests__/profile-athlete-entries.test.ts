import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import { athleteUserIdsFor } from "@/lib/registration-confirm";
import { buyersOwnTicket, compactOrderParticipant } from "@/lib/checkout-order";
import { profileHistoryWhere, unclaimedByEmailWhere } from "@/lib/profile-history";
import { claimEntriesByEmail } from "@/lib/claim-entries";
import { createEmptyParticipant, type CompactParticipant } from "@/lib/registration-form";

// One event listed once per ticket the buyer paid for (#592).

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

describe("profileHistoryWhere", () => {
  const where = profileHistoryWhere({ id: "u1", email: "me@x.test" });

  it("lists confirmed entries only", () => {
    expect(where.status).toBe("CONFIRMED");
  });

  it("matches the account's own entries by athleteUserId, not by who paid", () => {
    expect(where.OR).toContainEqual({ athleteUserId: "u1" });
    expect(JSON.stringify(where)).not.toContain('"userId":"u1"}');
  });

  it("also finds entries someone else bought under the account's email", () => {
    const byEmail = (where.OR as object[])[1];
    expect(byEmail).toEqual({
      athleteUserId: null,
      detailsPending: false,
      athleteEmail: { equals: "me@x.test", mode: "insensitive" },
      // Their own purchases are excluded, so a child entered on a parent's
      // address is not the parent's race. A null buyer is spelled out.
      OR: [{ userId: null }, { userId: { not: "u1" } }],
    });
  });
});

describe("claimEntriesByEmail", () => {
  const user = { id: "u1", email: "me@x.test" };
  const fakeDb = (impl: () => Promise<{ count: number }>) => {
    const updateMany = vi.fn(impl);
    return { db: { registration: { updateMany } } as never, updateMany };
  };

  it("pins exactly the entries the profile already finds by email", async () => {
    const { db, updateMany } = fakeDb(async () => ({ count: 2 }));
    expect(await claimEntriesByEmail(user, db)).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: unclaimedByEmailWhere(user),
      data: { athleteUserId: "u1" },
    });
    // The profile's email branch and the claim are one rule.
    expect((profileHistoryWhere(user).OR as object[])[1]).toEqual(unclaimedByEmailWhere(user));
  });

  it("does nothing without an email", async () => {
    const { db, updateMany } = fakeDb(async () => ({ count: 0 }));
    expect(await claimEntriesByEmail({ id: "u1", email: "" }, db)).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("never fails the request it runs in", async () => {
    const { db } = fakeDb(async () => { throw new Error("db down"); });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await claimEntriesByEmail(user, db)).toBe(0);
    spy.mockRestore();
  });
});
