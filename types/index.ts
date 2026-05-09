export type EventType = 
  | "hyrox"
  | "crossfit"
  | "running"
  | "hybrid";

export type AustralianState = 
  | "nsw"
  | "vic"
  | "qld"
  | "wa"
  | "sa"
  | "tas"
  | "act"
  | "nt";

export type CompetitionFormat = 
  | "individual"
  | "team"
  | "both";

export type ExperienceLevel =
  | "open"
  | "beginner"
  | "elite";

export interface TicketDrop {
  label: string;
  date: string;
  price: string;
}

export interface FitnessEvent {
  id: string;
  title: string;
  description: string;
  fullDescription?: string;
  date: string;
  time: string;
  endTime?: string;
  cutOffTime?: string;
  dates?: string[];
  location: string;
  streetAddress?: string;
  city: string;
  state: AustralianState;
  country?: string;
  courseMapUrl?: string;
  type: EventType;
  format: CompetitionFormat;
  level: ExperienceLevel;
  image: string;
  registrationUrl: string;
  registrationCloseDate?: string;
  organizer?: string;
  distance?: string;
  isOfficial?: boolean;
  // Categories & Distances
  categories?: string[];
  workoutDescription?: string;
  soloAvailable?: boolean;
  partnerAvailable?: boolean;
  teamAvailable?: boolean;
  // Registration & Tickets
  ticketDrops?: TicketDrop[];
  transferPolicy?: string;
  refundPolicy?: string;
  waitlistAvailable?: boolean;
  // Cost & Pricing
  entryFeeInclusions?: string;
  optionalExtras?: string;
  groupDiscount?: string;
  charityComponent?: string;
  // Prizes & Awards
  prizeStructure?: string;
  prizePoolTotal?: string;
  ageGroupCategories?: string;
  ceremonyDate?: string;
  ceremonyLocation?: string;
  specialAwards?: string;
  // Expo & Public Activations
  hasExpo?: boolean;
  expoDetails?: string;
  vendorOpportunities?: boolean;
  bibCollectionInfo?: string;
  athleteBriefing?: string;
  // Additional Information
  participantCap?: string;
  minAge?: string;
  accessibilityInfo?: string;
  parkingInfo?: string;
  bagDropInfo?: string;
  resultsProvider?: string;
  resultsLink?: string;
  additionalNotes?: string;
}

export interface FilterState {
  types: EventType[];
  states: AustralianState[];
  format: CompetitionFormat | null;
  dateRange: "this-month" | "next-3" | "all";
  searchQuery: string;
}

export interface EventTypeOption {
  value: EventType;
  label: string;
  shortLabel: string;
}

export const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  { value: "hyrox", label: "HYROX", shortLabel: "HYROX" },
  { value: "crossfit", label: "CrossFit Competitions", shortLabel: "CrossFit" },
  { value: "running", label: "Running (5K–Marathon)", shortLabel: "Running" },
  { value: "hybrid", label: "Hybrid / Functional", shortLabel: "Hybrid" },
];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  hyrox: "HYROX",
  crossfit: "CrossFit",
  running: "Running",
  hybrid: "Hybrid",
};

export interface StateOption {
  value: AustralianState;
  label: string;
  shortLabel: string;
}

export const STATE_OPTIONS: StateOption[] = [
  { value: "nsw", label: "New South Wales", shortLabel: "NSW" },
  { value: "vic", label: "Victoria", shortLabel: "VIC" },
  { value: "qld", label: "Queensland", shortLabel: "QLD" },
  { value: "wa", label: "Western Australia", shortLabel: "WA" },
  { value: "sa", label: "South Australia", shortLabel: "SA" },
  { value: "tas", label: "Tasmania", shortLabel: "TAS" },
  { value: "act", label: "Australian Capital Territory", shortLabel: "ACT" },
  { value: "nt", label: "Northern Territory", shortLabel: "NT" },
];

export const STATE_LABELS: Record<AustralianState, string> = {
  nsw: "NSW",
  vic: "VIC",
  qld: "QLD",
  wa: "WA",
  sa: "SA",
  tas: "TAS",
  act: "ACT",
  nt: "NT",
};

export const FORMAT_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "team", label: "Team / Pairs" },
  { value: "both", label: "Individual & Team" },
] as const;

export const DATE_RANGE_OPTIONS = [
  { value: "this-month", label: "This Month" },
  { value: "next-3", label: "Next 3 Months" },
  { value: "all", label: "All Upcoming" },
] as const;
