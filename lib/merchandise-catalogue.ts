/**
 * Database reads for an organiser's profile merchandise. The rules live in
 * lib/merchandise.ts; this module only fetches and shapes.
 */

import prisma from "@/lib/prisma";
import type { MerchandiseView, PublicMerchandiseView } from "@/lib/merchandise";

const VIEW_SELECT = {
  id: true,
  name: true,
  description: true,
  priceCents: true,
  imageUrl: true,
  optionLabel: true,
  options: true,
} as const;

const ORDER = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];

/** The organiser's own list, for their editor and the event add-on picker. */
export async function merchandiseForOrganiser(organiserId: string): Promise<MerchandiseView[]> {
  return prisma.organiserMerchandise.findMany({
    where: { organiserId },
    orderBy: ORDER,
    select: VIEW_SELECT,
  });
}

/**
 * The public profile's list. Each item names the live events that are selling
 * a copy of it right now, so an athlete knows where they can actually get it.
 * Retired event copies and events that are not live are left out.
 *
 * Fails soft to an empty list, like the other profile reads, so a database
 * blip hides the section instead of taking the whole profile down.
 */
export async function publicMerchandiseForOrganiser(
  organiserId: string,
): Promise<PublicMerchandiseView[]> {
  try {
    const items = await prisma.organiserMerchandise.findMany({
      where: { organiserId },
      orderBy: ORDER,
      select: {
        ...VIEW_SELECT,
        eventAddOns: {
          where: { active: true, event: { status: "APPROVED", organiserId } },
          select: { event: { select: { id: true, title: true, eventDate: true } } },
        },
      },
    });

    return items.map(({ eventAddOns, ...item }) => {
      const events = new Map<string, { id: string; title: string; eventDate: string }>();
      for (const { event } of eventAddOns) events.set(event.id, event);
      return {
        ...item,
        events: [...events.values()]
          .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
          .map(({ id, title }) => ({ id, title })),
      };
    });
  } catch {
    return [];
  }
}
