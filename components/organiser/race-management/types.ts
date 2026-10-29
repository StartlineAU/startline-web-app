import type { WaveDef } from "@/lib/wave-assignment";

export interface Registration {
  id: string;
  name: string;
  email: string;
  category: string | null;
  waveId: string | null;
  wave: string | null;
  waveNotified: string | null;
  bibNumber: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  estimatedFinishMinutes: number | null;
  medicalNotes: string | null;
  status: "CONFIRMED" | "REFUND_REQUESTED" | "REFUNDED" | "CANCELLED";
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
  event: { id: string; title: string; startWaves: StartWave[] };
  registrations: Registration[];
}


