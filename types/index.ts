export type EventType =
  | "fitness-racing"
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
  date?: string;
  price?: string;
  qty?: number;
}

export interface UserEvent {
  id: string;
  title: string;
  description: string;
  fullDescription?: string;
  date: string;
  time: string;
  endTime?: string;
  dates?: string[];
  location: string;
  city: string;
  state: AustralianState;
  latitude?: number | null;
  longitude?: number | null;
  type: EventType;
  format: string;
  level: string;
  image: string;
  registrationUrl: string | null;
  registrationType: string;
  feeStructure: string;
  organiserId: string;
  organizer?: string;
  distance?: string;
  isOfficial?: boolean;
  ticketDrops?: TicketDrop[];
  fromPrice: number | null;
  tagline?: string | null;
  coverImageUrl?: string | null;
  organiser?: {
    id: string;
    orgName: string | null;
    logoUrl: string | null;
  };
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
  { value: "fitness-racing", label: "Fitness Racing",             shortLabel: "Fitness Racing" },
  { value: "crossfit",       label: "CrossFit Competitions",      shortLabel: "CrossFit" },
  { value: "running",        label: "Running (5K–Marathon)",      shortLabel: "Running" },
  { value: "hybrid",         label: "Hybrid / Obstacle",         shortLabel: "Hybrid" },
];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  "fitness-racing": "Fitness Racing",
  crossfit:         "CrossFit",
  running:          "Running",
  hybrid:           "Hybrid",
};

export interface StateOption {
  value: AustralianState;
  label: string;
  shortLabel: string;
}

export const STATE_OPTIONS: StateOption[] = [
  { value: "nsw", label: "New South Wales",                shortLabel: "NSW" },
  { value: "vic", label: "Victoria",                       shortLabel: "VIC" },
  { value: "qld", label: "Queensland",                     shortLabel: "QLD" },
  { value: "wa",  label: "Western Australia",              shortLabel: "WA" },
  { value: "sa",  label: "South Australia",                shortLabel: "SA" },
  { value: "tas", label: "Tasmania",                       shortLabel: "TAS" },
  { value: "act", label: "Australian Capital Territory",   shortLabel: "ACT" },
  { value: "nt",  label: "Northern Territory",             shortLabel: "NT" },
];

export const STATE_LABELS: Record<AustralianState, string> = {
  nsw: "NSW",
  vic: "VIC",
  qld: "QLD",
  wa:  "WA",
  sa:  "SA",
  tas: "TAS",
  act: "ACT",
  nt:  "NT",
};

export const FORMAT_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "team",       label: "Team / Pairs" },
  { value: "both",       label: "Individual & Team" },
] as const;

export const DATE_RANGE_OPTIONS = [
  { value: "this-month", label: "This Month" },
  { value: "next-3",     label: "Next 3 Months" },
  { value: "all",        label: "All Upcoming" },
] as const;

// backward compat for utils.ts
export type { FitnessEvent } from "./legacy";
