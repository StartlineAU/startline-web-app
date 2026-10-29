import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import {
  organisationDeletionBlocker,
  organisationsBlockingDeletion,
  type OrganisationSummary,
} from "@/lib/account-deletion";

const org = (over: Partial<OrganisationSummary>): OrganisationSummary => ({
  organiserId: "org-1", name: "Apex", role: "OWNER", owners: 1, members: 1, registrations: 0, ...over,
});

describe("organisationsBlockingDeletion", () => {
  it("blocks on an organisation the person alone owns", () => {
    expect(organisationsBlockingDeletion([org({ members: 3, registrations: 12 })])).toEqual([
      { organiserId: "org-1", name: "Apex", otherMembers: 2, registrations: 12 },
    ]);
  });

  it("lets a manager go: their membership just ends", () => {
    expect(organisationsBlockingDeletion([org({ role: "MANAGER", members: 2 })])).toEqual([]);
  });

  it("lets an owner go when another owner remains", () => {
    expect(organisationsBlockingDeletion([org({ owners: 2, members: 2 })])).toEqual([]);
  });

  it("reports only the organisations that block, out of several", () => {
    const blockers = organisationsBlockingDeletion([
      org({ organiserId: "a", role: "MANAGER" }),
      org({ organiserId: "b", owners: 2, members: 2 }),
      org({ organiserId: "c", name: null }),
    ]);
    expect(blockers).toEqual([{ organiserId: "c", name: "Organisation", otherMembers: 0, registrations: 0 }]);
  });
});

describe("organisationDeletionBlocker", () => {
  it("allows deleting an organisation that never took an entry", () => {
    expect(organisationDeletionBlocker(0)).toBeNull();
  });

  it("refuses once any entry exists, because the records must be kept", () => {
    expect(organisationDeletionBlocker(1)).toMatch(/records have to be kept/);
  });
});
