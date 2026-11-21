/**
 * Who decides a refund ticket (#570).
 *
 * The organiser decides; Startline issues the refund. An admin decides only
 * when one of two things is true:
 *
 * - the organiser has not responded within ORGANISER_RESPONSE_BUSINESS_DAYS, or
 * - the admin is overriding, which needs a note, is written to the audit log as
 *   REFUND_TICKET_OVERRIDE, and tells the organisation.
 *
 * Everything here is pure so the rules can be tested without a database. The
 * routes read the ticket, ask these functions, and write what they return.
 */

import type { SupportTicketStatus } from "@prisma/client";

export const ORGANISER_RESPONSE_BUSINESS_DAYS = 3;

export type AdminDecisionKind = "NO_RESPONSE" | "OVERRIDE";

export interface TicketForRules {
  status: SupportTicketStatus;
  organiserDecision: SupportTicketStatus | null;
  createdAt: Date;
}

/**
 * `date` moved forward by `days` business days (Monday to Friday). Public
 * holidays are not counted out: they vary by state and the window is a
 * courtesy to the organiser, not a legal deadline.
 *
 * A ticket raised on a weekend starts counting from the following Monday, the
 * same as one raised first thing that Monday.
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

/** When the organiser's window to respond closes. */
export function organiserResponseDue(ticket: Pick<TicketForRules, "createdAt">): Date {
  return addBusinessDays(ticket.createdAt, ORGANISER_RESPONSE_BUSINESS_DAYS);
}

/** The organiser decides once, while the ticket is still open. */
export function canOrganiserDecide(ticket: Pick<TicketForRules, "status">): boolean {
  return ticket.status === "OPEN";
}

export type AdminAction = "approve" | "decline" | "refunded";

export interface AdminActionInput {
  action: AdminAction;
  override?: boolean;
  note?: string | null;
}

export type AdminActionResult =
  | {
      ok: true;
      status: SupportTicketStatus;
      /** Null for "refunded": issuing the money is not a decision. */
      kind: AdminDecisionKind | null;
      auditAction: string;
      note: string | null;
      /** True when the organisation must be told Startline overrode it. */
      notifyOrganiser: boolean;
    }
  | { ok: false; httpStatus: 400 | 409; error: string };

const DUE_FORMAT = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Australia/Sydney",
});

/**
 * What an admin may do to a ticket. The caller writes the result with a
 * conditional update on the status it read, so a decision made in between is
 * not overwritten either.
 */
export function evaluateAdminAction(
  ticket: TicketForRules,
  input: AdminActionInput,
  now: Date,
): AdminActionResult {
  const note = input.note?.trim() || null;

  if (ticket.status === "REFUNDED") {
    return { ok: false, httpStatus: 409, error: "This request has already been refunded." };
  }

  // Marking refunded records that Startline issued the money. That follows an
  // approval, whoever made it; it is never a way round the decision.
  if (input.action === "refunded") {
    if (ticket.status !== "APPROVED") {
      return {
        ok: false,
        httpStatus: 409,
        error: "Only an approved request can be marked refunded.",
      };
    }
    return {
      ok: true,
      status: "REFUNDED",
      kind: null,
      auditAction: "REFUND_TICKET_REFUNDED",
      note,
      notifyOrganiser: false,
    };
  }

  const status: SupportTicketStatus = input.action === "approve" ? "APPROVED" : "DECLINED";

  if (input.override) {
    if (!note) {
      return { ok: false, httpStatus: 400, error: "An override needs a note explaining why." };
    }
    if (ticket.status === status) {
      return {
        ok: false,
        httpStatus: 409,
        error: `This request is already ${status.toLowerCase()}.`,
      };
    }
    return {
      ok: true,
      status,
      kind: "OVERRIDE",
      auditAction: "REFUND_TICKET_OVERRIDE",
      note,
      notifyOrganiser: true,
    };
  }

  if (ticket.status !== "OPEN") {
    return {
      ok: false,
      httpStatus: 409,
      error:
        ticket.organiserDecision
          ? "The organiser has already decided this request. Override it with a note to change it."
          : "This request has already been decided. Override it with a note to change it.",
    };
  }

  const due = organiserResponseDue(ticket);
  if (now < due) {
    return {
      ok: false,
      httpStatus: 409,
      error: `The organiser has until ${DUE_FORMAT.format(due)} to respond. Override it with a note to decide now.`,
    };
  }

  return {
    ok: true,
    status,
    kind: "NO_RESPONSE",
    auditAction: `REFUND_TICKET_NO_RESPONSE_${status}`,
    note,
    notifyOrganiser: false,
  };
}
