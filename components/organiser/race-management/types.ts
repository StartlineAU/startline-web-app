import type { WaveDef } from "@/lib/wave-assignment";
import type { RaceFeatures } from "@/lib/race-features";

export interface Registration {
  id: string;
  name: string;
  email: string;
  category: string | null;
  waveId: string | null;
  wave: string | null;
  /** The ticket tier they bought (Registration.waveLabel), not a start wave. */
  tier: string | null;
  bibNumber: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  estimatedFinishMinutes: number | null;
  medicalNotes: string | null;
  status: "CONFIRMED" | "REFUND_REQUESTED" | "REFUNDED" | "CANCELLED" | "REMOVED";
  checkedInAt: string | null;
  amount: number;
  refundAmountCents: number | null;
  refundPercent: number | null;
  refundRequestedAt: string | null;
  refundOutsidePolicy: boolean;
  createdAt: string;
  /** Free entries only: a paid entry's status changes through a refund. */
  statusEditable: boolean;
  /** What Remove from event refunds, in cents. 0 for an entry nothing was charged for. */
  removalRefundCents: number;
  resultDistance: string | null;
  resultTime: string | null;
  resultPlacement: string | null;
  isPersonalBest: boolean;
  isTopResult: boolean;
  /** Set for a team entry. Bib, start wave, check-in and result are the team's. */
  team: { id: string; name: string; size: number; captain: boolean } | null;
  /** Team place whose member the buyer has not named yet ("Team member 2"). */
  detailsPending?: boolean;
}

export interface StartWave extends WaveDef {
  sortOrder: number;
  assigned: number;
}

export interface PageData {
  /** waves are the ticket tiers (label + price), not start waves. */
  event: { id: string; title: string; waves: { label: string; price: string }[]; startWaves: StartWave[]; divisions: string[] } & RaceFeatures;
  registrations: Registration[];
}


