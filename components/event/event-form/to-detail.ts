import type { EventDetailData } from "@/lib/event-detail";
import { lowestPrice } from "@/lib/event-types";
import { normalisePrizeAmount } from "@/lib/prize-pool";
import { EVENT_TYPE_LABELS, type AustralianState, type EventType, type TicketDrop } from "@/types";
import { eventCap, waveQty, waveTeamSize, type FormState } from "./shared";

/** Object URLs for files picked in this session, so unsaved images still show. */
export interface FormMedia {
  cover: string | null;
  photos: string[];
}

/**
 * The listing as it stands in the editor, in the shape the athlete page
 * renders (`EventDetailView`). The editor and its preview draw the page from
 * this, so what the organiser sees is the public page itself rather than a
 * copy of it (issue #528).
 */
export function formToDetailData(form: FormState, media: FormMedia): EventDetailData {
  // Rows without a price are still being filled in. The public page only ever
  // receives priced rows, because publishing requires one on every category.
  const waves = form.waves
    .filter((w) => w.price === "0" || !!w.price)
    .map(({ qty, teamSize, ...w }) => ({
      ...w,
      qty: waveQty({ qty }) ?? undefined,
      teamSize: waveTeamSize({ teamSize }) ?? undefined,
    }));
  const prizeAmount = form.prizeMoney ? normalisePrizeAmount(form.prizeMoneyAmount) : "";

  return {
    event: {
      id: "preview",
      title: form.title.trim() || "Your event title",
      description: form.description,
      date: form.date,
      endDate: form.endDate || undefined,
      time: form.startTime,
      endTime: form.endTime || undefined,
      status: "DRAFT",
      location: form.venue.trim() || form.city.trim() || "Venue TBC",
      address: form.address.trim() || undefined,
      city: form.city,
      state: form.state as AustralianState,
      latitude: form.latitude,
      longitude: form.longitude,
      type: (form.discipline in EVENT_TYPE_LABELS ? form.discipline : "running") as EventType,
      discipline: form.discipline,
      format: form.format,
      level: form.level,
      categories: form.categories,
      cap: eventCap(form),
      minAge: null,
      refundPolicy: form.refundPolicy.trim() || undefined,
      refundTiers: form.refundTiers,
      image: media.cover ?? "",
      registrationUrl: form.registrationType === "external" ? form.registrationUrl.trim() || null : null,
      registrationType: form.registrationType,
      feeStructure: form.feeStructure,
      organiserId: "",
      ticketDrops: waves as TicketDrop[],
      fromPrice: lowestPrice(waves),
      photos: [...form.photoUrls, ...media.photos],
      informationPdfs: form.informationPdfs.map((p) => ({
        url: p.url || "#",
        label: p.label.trim() || null,
        name: p.file?.name ?? p.name ?? null,
      })),
      registrationCount: 0,
    },
    prizePool: prizeAmount ? { amount: prizeAmount, details: form.prizeMoneyDetails.trim() } : null,
    organiserName: "",
    organiserRating: null,
    organiserReviews: [],
  };
}
