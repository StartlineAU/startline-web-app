import {
  validateEventTiming,
  validateScheduleSlots,
  validateTicketCloseDate,
  compareTime,
  eventDayCount,
  listEventDays,
  syncSlotsToEventDays,
} from "@/lib/event-timing";

describe("event-timing", () => {
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const dayAfterTomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const nextWeek = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  describe("listEventDays", () => {
    it("returns one day for single-day events", () => {
      expect(listEventDays(tomorrow)).toEqual([tomorrow]);
      expect(eventDayCount(tomorrow)).toBe(1);
    });

    it("returns inclusive range for multi-day events", () => {
      expect(listEventDays(tomorrow, dayAfterTomorrow)).toEqual([tomorrow, dayAfterTomorrow]);
      expect(eventDayCount(tomorrow, dayAfterTomorrow)).toBe(2);
    });
  });

  describe("syncSlotsToEventDays", () => {
    it("assigns consecutive days and trims excess slots", () => {
      const synced = syncSlotsToEventDays(
        [
          { date: "", startTime: "09:00", cutoffTime: "12:00" },
          { date: "", startTime: "10:00", cutoffTime: "13:00" },
          { date: "", startTime: "11:00", cutoffTime: "14:00" },
        ],
        tomorrow,
        dayAfterTomorrow,
      );
      expect(synced).toHaveLength(2);
      expect(synced[0].date).toBe(tomorrow);
      expect(synced[1].date).toBe(dayAfterTomorrow);
      expect(synced[0].startTime).toBe("09:00");
    });
  });

  describe("single time pair", () => {
    it("rejects cut-off before start time", () => {
      const errors = validateEventTiming({
        eventDate: tomorrow,
        startTime: "14:00",
        endTime: "10:00",
        multipleTimeSlots: false,
      });
      expect(errors).toContain("Cut-off time must be after the start time.");
    });

    it("allows cut-off after start time", () => {
      const errors = validateEventTiming({
        eventDate: tomorrow,
        startTime: "09:00",
        endTime: "17:00",
        multipleTimeSlots: false,
      });
      expect(errors).not.toContain("Cut-off time must be after the start time.");
    });
  });

  describe("schedule slots", () => {
    it("validates each slot within event dates", () => {
      const errors = validateScheduleSlots(
        [{ date: tomorrow, startTime: "09:00", cutoffTime: "17:00" }],
        tomorrow,
        nextWeek,
      );
      expect(errors).toHaveLength(0);
    });

    it("rejects cut-off before start on same slot day", () => {
      const errors = validateScheduleSlots(
        [{ date: tomorrow, startTime: "14:00", cutoffTime: "10:00" }],
        tomorrow,
      );
      expect(errors.some(e => e.includes("Cut-off must be after the start time"))).toBe(true);
    });

    it("allows different slots on different days", () => {
      const errors = validateEventTiming({
        eventDate: tomorrow,
        endDate: nextWeek,
        multipleTimeSlots: true,
        scheduleSlots: [
          { date: tomorrow, startTime: "14:00", cutoffTime: "17:00" },
          { date: nextWeek, startTime: "08:00", cutoffTime: "12:00" },
        ],
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe("compareTime", () => {
    it("orders times", () => {
      expect(compareTime("09:00", "14:00")).toBeLessThan(0);
    });
  });

  describe("validateTicketCloseDate", () => {
    it("allows close date before event start", () => {
      expect(validateTicketCloseDate(tomorrow, nextWeek)).toBeNull();
    });
  });
});
