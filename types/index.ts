export type EventType = 
  | "running"
  | "yoga"
  | "cycling"
  | "hiit"
  | "swimming"
  | "group-fitness"
  | "outdoor"
  | "sports";

export interface FitnessEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  endTime?: string;
  location: string;
  area: string;
  type: EventType;
  image: string;
  popularity: number;
  price: string;
  organizer?: string;
  capacity?: number;
  spotsLeft?: number;
}

export interface FilterState {
  types: EventType[];
  area: string;
  dateFrom: string | null;
  dateTo: string | null;
  searchQuery: string;
}

export interface EventTypeOption {
  value: EventType;
  label: string;
  icon?: string;
}

export const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  { value: "running", label: "Running / Marathons" },
  { value: "yoga", label: "Yoga / Pilates" },
  { value: "cycling", label: "Cycling" },
  { value: "hiit", label: "HIIT / CrossFit" },
  { value: "swimming", label: "Swimming" },
  { value: "group-fitness", label: "Group Fitness Classes" },
  { value: "outdoor", label: "Outdoor Adventures" },
  { value: "sports", label: "Sports Leagues" },
];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  running: "Running",
  yoga: "Yoga",
  cycling: "Cycling",
  hiit: "HIIT",
  swimming: "Swimming",
  "group-fitness": "Group Fitness",
  outdoor: "Outdoor",
  sports: "Sports",
};
