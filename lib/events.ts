import prisma from "@/lib/prisma";
import { archivePastEvents } from "@/lib/archive-events";
import { eventInclude, toEventResponse, lowestWavePrice, type EventResponse } from "@/lib/event-data";

export type PublicEvent = EventResponse;

export async function getAllEvents(): Promise<(PublicEvent & { fromPrice: number | null })[]> {
  try {
    await archivePastEvents();
    const events = await prisma.event.findMany({
      where: { status: "APPROVED" },
      orderBy: { schedule: { eventDate: "asc" } },
      include: eventInclude.public,
    });

    return events.map((e) => {
      const response = toEventResponse(e);
      return {
        ...response,
        fromPrice: lowestWavePrice(response.tickets?.waves),
      };
    });
  } catch {
    return [];
  }
}
