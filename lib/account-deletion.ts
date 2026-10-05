import prisma from "@/lib/prisma";

/** An organisation that stands in the way of deleting an account. */
export interface OwnedOrganisation {
  organiserId: string;
  name: string;
  /** Members other than the person leaving, who could take ownership. */
  otherMembers: number;
  /** Entries taken across all of its events, in any state. */
  registrations: number;
}

export interface OrganisationSummary {
  organiserId: string;
  name: string | null;
  role: "OWNER" | "MANAGER";
  owners: number;
  members: number;
  registrations: number;
}

/**
 * The organisations someone must deal with before their account can go: the
 * ones where they are the only owner. With a second owner the organisation
 * carries on without them, and a manager's membership simply ends.
 */
export function organisationsBlockingDeletion(memberships: OrganisationSummary[]): OwnedOrganisation[] {
  return memberships
    .filter(m => m.role === "OWNER" && m.owners <= 1)
    .map(m => ({
      organiserId:   m.organiserId,
      name:          m.name ?? "Organisation",
      otherMembers:  Math.max(0, m.members - 1),
      registrations: m.registrations,
    }));
}

/**
 * Why an organisation cannot be deleted, or null if it can. Deleting one
 * removes its events and every entry on them, so it is only allowed while no
 * entry has ever been taken: after that the rows are athletes' race history
 * and the organisation's financial record.
 */
export function organisationDeletionBlocker(registrations: number): string | null {
  if (registrations === 0) return null;
  return "This organisation has taken entries, so its records have to be kept. Transfer ownership to another member, or contact support to close it.";
}

export async function organisationRegistrationCount(organiserId: string): Promise<number> {
  return prisma.registration.count({ where: { organiserId } });
}

export interface AccountDeletionStatus {
  blockers: OwnedOrganisation[];
  /** Confirmed entries for events that have not happened yet. */
  upcomingEntries: number;
}

export async function accountDeletionStatus(userId: string): Promise<AccountDeletionStatus> {
  const memberships = await prisma.organiserMember.findMany({
    where: { userId },
    select: {
      role: true,
      organiser: {
        select: {
          id: true,
          orgName: true,
          members: { select: { role: true } },
          _count: { select: { registrations: true } },
        },
      },
    },
  });

  const blockers = organisationsBlockingDeletion(memberships.map(m => ({
    organiserId:   m.organiser.id,
    name:          m.organiser.orgName,
    role:          m.role,
    owners:        m.organiser.members.filter(x => x.role === "OWNER").length,
    members:       m.organiser.members.length,
    registrations: m.organiser._count.registrations,
  })));

  // eventDate is an ISO yyyy-mm-dd string, so it compares as text.
  const today = new Date().toISOString().slice(0, 10);
  const upcomingEntries = await prisma.registration.count({
    where: { userId, status: "CONFIRMED", event: { eventDate: { gte: today } } },
  });

  return { blockers, upcomingEntries };
}
