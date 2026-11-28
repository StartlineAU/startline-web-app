/**
 * Why an organiser removed an athlete (#571). Shared by the remove dialog,
 * the API and the athlete's email, so the wording is the same everywhere.
 * Mirrors the RemovalReason enum in prisma/schema.prisma.
 */

export const REMOVAL_REASONS = [
  "NO_SHOW_BRIEFING",
  "CODE_OF_CONDUCT",
  "INELIGIBLE",
  "DUPLICATE",
  "OTHER",
] as const;

export type RemovalReasonValue = (typeof REMOVAL_REASONS)[number];

export const REMOVAL_REASON_LABEL: Record<RemovalReasonValue, string> = {
  NO_SHOW_BRIEFING: "No-show to a required briefing",
  CODE_OF_CONDUCT: "Code of conduct",
  INELIGIBLE: "Ineligible (age, category, medical)",
  DUPLICATE: "Duplicate entry",
  OTHER: "Other",
};

/**
 * Removing someone who paid gives them their money back, because they did not
 * choose to leave. The one exception the organiser may make is a code of
 * conduct breach, which Australian Consumer Law is likeliest to allow when the
 * event's terms say so.
 */
export function refundOptional(reason: RemovalReasonValue): boolean {
  return reason === "CODE_OF_CONDUCT";
}

/** "Other" needs the organiser to say what it was. */
export function noteRequired(reason: RemovalReasonValue): boolean {
  return reason === "OTHER";
}

export const REMOVAL_NOTE_MAX = 1000;
