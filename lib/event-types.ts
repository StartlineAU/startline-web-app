export interface PublicWave {
  label: string;
  date?: string;
  price?: string;
  qty?: number;
}

export interface PublicEvent {
  id: string;
  title: string;
  discipline: string;
  tagline: string | null;
  description: string | null;
  eventDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  venue: string;
  city: string;
  state: string;
  format: string;
  level: string;
  categories: unknown;
  waves: unknown;
  extras: string | null;
  coverImageUrl: string | null;
  registrationType: string;
  registrationUrl: string | null;
  feeStructure: string;
  fromPrice: number | null;
  organiserId: string;
  organiser: {
    id: string;
    orgName: string | null;
    logoUrl: string | null;
    stripeAccountId: string | null;
    stripeOnboardingComplete: boolean;
  };
}

export function lowestPrice(waves: unknown): number | null {
  if (!Array.isArray(waves)) return null;
  const prices = (waves as PublicWave[])
    .map((w) => parseFloat(w?.price ?? ""))
    .filter((n) => Number.isFinite(n));
  return prices.length ? Math.min(...prices) : null;
}
