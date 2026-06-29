/** ISO date (yyyy-mm-dd) and 24h time (HH:MM) helpers for event listing validation. */

export function todayIso(): string {
  const now = new Date();
  return formatIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Last calendar day of the event (end date when multi-day, otherwise start date). */
export function eventLastDate(eventDate: string, endDate?: string | null): string {
  if (!eventDate) return "";
  if (endDate && endDate > eventDate) return endDate;
  return eventDate;
}

/** Inclusive number of calendar days the event runs (1 for single-day). */
export function eventDayCount(eventDate: string, endDate?: string | null): number {
  if (!eventDate) return 0;
  return listEventDays(eventDate, endDate).length;
}

/** Each ISO date from event start through end (inclusive). */
export function listEventDays(eventDate: string, endDate?: string | null): string[] {
  if (!eventDate) return [];
  const last = eventLastDate(eventDate, endDate);
  const days: string[] = [];
  const cursor = new Date(eventDate + "T00:00:00");
  const end = new Date(last + "T00:00:00");
  while (cursor <= end) {
    days.push(formatIsoDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Map slots to consecutive event days; trims extras when the range shrinks. */
export function syncSlotsToEventDays<T extends { date?: string }>(
  slots: T[],
  eventDate: string,
  endDate?: string | null,
): T[] {
  const days = listEventDays(eventDate, endDate);
  if (!days.length) return slots;
  return slots.slice(0, days.length).map((slot, i) => ({ ...slot, date: days[i] }));
}

export function clampIsoDate(iso: string | undefined | null, min: string, max: string): string {
  if (!iso) return min;
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

export function compareDateTime(
  dateA: string,
  timeA: string,
  dateB: string,
  timeB: string,
): number {
  return `${dateA}T${timeA}`.localeCompare(`${dateB}T${timeB}`);
}

export function compareTime(timeA: string, timeB: string): number {
  return timeA.localeCompare(timeB);
}

export interface ScheduleSlot {
  date?: string;
  startTime?: string;
  cutoffTime?: string;
}

export interface EventTimingInput {
  eventDate: string;
  endDate?: string | null;
  startTime?: string;
  endTime?: string | null;
  multipleTimeSlots?: boolean;
  scheduleSlots?: ScheduleSlot[];
}

export interface WaveTimingInput {
  label?: string;
  closes?: string;
}

export function validateScheduleSlots(
  slots: ScheduleSlot[],
  eventDate: string,
  endDate?: string | null,
): string[] {
  const errors: string[] = [];
  const lastDay = eventLastDate(eventDate, endDate);

  slots.forEach((slot, i) => {
    const label = `Slot ${i + 1}`;
    if (!slot.date) {
      errors.push(`${label}: Date is required.`);
    } else {
      if (slot.date < eventDate) {
        errors.push(`${label}: Date cannot be before the event start date.`);
      }
      if (slot.date > lastDay) {
        errors.push(`${label}: Date cannot be after the event end date.`);
      }
    }
    if (!slot.startTime) errors.push(`${label}: Start time is required.`);
    if (!slot.cutoffTime) errors.push(`${label}: Cut-off time is required.`);
    if (slot.date && slot.startTime && slot.cutoffTime) {
      if (compareDateTime(slot.date, slot.startTime, slot.date, slot.cutoffTime) >= 0) {
        errors.push(`${label}: Cut-off must be after the start time.`);
      }
    }
  });

  return errors;
}

export function validateEventTiming(input: EventTimingInput): string[] {
  const errors: string[] = [];
  if (!input.eventDate) return errors;

  const today = todayIso();
  const lastDay = eventLastDate(input.eventDate, input.endDate);

  if (input.eventDate < today) {
    errors.push("Event date cannot be in the past.");
  }

  if (input.endDate && input.endDate < input.eventDate) {
    errors.push("Event end date cannot be before the start date.");
  }

  if (input.multipleTimeSlots && input.scheduleSlots?.length) {
    errors.push(...validateScheduleSlots(input.scheduleSlots, input.eventDate, input.endDate));
    return errors;
  }

  if (input.startTime && input.endTime && compareTime(input.endTime, input.startTime) <= 0) {
    errors.push("Cut-off time must be after the start time.");
  }

  return errors;
}

/** Ticket close date must be today–event end; may be before the event starts. */
export function validateTicketCloseDate(
  closes: string,
  eventDate: string,
  endDate?: string | null,
): string | null {
  if (!closes) return null;

  if (!eventDate) {
    return "Set the event date before choosing a ticket close date.";
  }

  const today = todayIso();
  const lastDay = eventLastDate(eventDate, endDate);

  if (closes < today) {
    return "Ticket close date cannot be in the past.";
  }
  if (closes > lastDay) {
    return "Ticket sales cannot close after the event has finished.";
  }

  return null;
}

export function validateAllTicketCloses(
  waves: WaveTimingInput[],
  eventDate: string,
  endDate?: string | null,
): string[] {
  const errors: string[] = [];
  waves.forEach((w, i) => {
    if (!w.closes) return;
    const err = validateTicketCloseDate(w.closes, eventDate, endDate);
    if (err) {
      const prefix = w.label?.trim() ? w.label.trim() : `Category ${i + 1}`;
      errors.push(`${prefix}: ${err}`);
    }
  });
  return errors;
}

export function validateEventTimingPayload(body: {
  eventDate?: string;
  endDate?: string | null;
  startTime?: string;
  endTime?: string | null;
  multipleTimeSlots?: boolean;
  scheduleSlots?: ScheduleSlot[];
  waves?: WaveTimingInput[];
}): string | null {
  if (!body.eventDate) return null;

  const multipleTimeSlots =
    body.multipleTimeSlots ?? (Array.isArray(body.scheduleSlots) && body.scheduleSlots.length > 0);

  const timingErrors = validateEventTiming({
    eventDate: body.eventDate,
    endDate: body.endDate,
    startTime: body.startTime,
    endTime: body.endTime,
    multipleTimeSlots,
    scheduleSlots: body.scheduleSlots,
  });
  if (timingErrors.length > 0) return timingErrors[0];

  if (body.waves?.length) {
    const ticketErrors = validateAllTicketCloses(body.waves, body.eventDate, body.endDate);
    if (ticketErrors.length > 0) return ticketErrors[0];
  }

  return null;
}
