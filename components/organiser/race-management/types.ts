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
  status: "CONFIRMED" | "REFUND_REQUESTED" | "REFUNDED" | "CANCELLED";
  checkedInAt: string | null;
  amount: number;
  refundAmountCents: number | null;
  refundPercent: number | null;
  refundRequestedAt: string | null;
  refundOutsidePolicy: boolean;
  createdAt: string;
  resultDistance: string | null;
  resultTime: string | null;
  resultPlacement: string | null;
  isPersonalBest: boolean;
  isTopResult: boolean;
}

export interface StartWave extends WaveDef {
  sortOrder: number;
  assigned: number;
}

export interface PageData {
  /** waves are the ticket tiers (label + price), not start waves. */
  event: { id: string; title: string; waves: { label: string; price: string }[]; startWaves: StartWave[] } & RaceFeatures;
  registrations: Registration[];
}


