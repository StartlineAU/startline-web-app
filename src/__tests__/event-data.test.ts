import {
  flatToEventWritePayload,
  getWaves,
  mergeEventPayload,
  toEventResponse,
  validateEventPayload,
} from "@/lib/event-data";

describe("event-data", () => {
  const sampleFlat = {
    title: "Test Event",
    discipline: "running",
    eventDate: "2026-09-01",
    startTime: "08:00",
    venue: "MCG",
    city: "Melbourne",
    state: "vic",
    format: "individual",
    level: "open",
    waves: [{ label: "General", price: "50" }],
  };

  it("flatToEventWritePayload nests fields by wizard step", () => {
    const payload = flatToEventWritePayload(sampleFlat);
    expect(payload.basics?.title).toBe("Test Event");
    expect(payload.schedule?.city).toBe("Melbourne");
    expect(payload.format?.discipline).toBe("running");
    expect(payload.tickets?.waves).toEqual([{ label: "General", price: "50" }]);
  });

  it("validateEventPayload requires basics.title for drafts", () => {
    expect(validateEventPayload({}, false)).toContain("title");
    expect(validateEventPayload({ basics: { title: "Draft" } }, false)).toBeNull();
  });

  it("validateEventPayload requires nested publish fields", () => {
    const payload = flatToEventWritePayload(sampleFlat);
    expect(validateEventPayload(payload, true)).toBeNull();
    expect(validateEventPayload({ basics: { title: "Only title" } }, true)).toContain("format.discipline");
  });

  it("mergeEventPayload keeps existing step data when patch omits it", () => {
    const base = flatToEventWritePayload(sampleFlat);
    const merged = mergeEventPayload(base, { basics: { title: "Updated title" } });
    expect(merged.basics?.title).toBe("Updated title");
    expect(merged.schedule?.city).toBe("Melbourne");
  });

  it("toEventResponse maps prisma-shaped nested record", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const response = toEventResponse({
      id: "evt-1",
      organiserId: "org-1",
      status: "DRAFT",
      isPinned: false,
      createdAt: now,
      updatedAt: now,
      adminReview: null,
      basics: { eventId: "evt-1", title: "Test Event", tagline: null, description: null },
      schedule: {
        eventId: "evt-1",
        eventDate: "2026-09-01",
        endDate: null,
        startTime: "08:00",
        endTime: null,
        venue: "MCG",
        address: null,
        city: "Melbourne",
        state: "vic",
      },
      format: {
        eventId: "evt-1",
        discipline: "running",
        format: "individual",
        level: "open",
        cap: null,
        minAge: 16,
        categories: [{ id: "cat-1", eventId: "evt-1", name: "5K", sortOrder: 0, isCustom: false }],
      },
      tickets: {
        eventId: "evt-1",
        inclusions: null,
        extras: null,
        activations: null,
        refundPolicy: null,
        registrationType: "startline",
        feeStructure: "athlete",
        registrationUrl: null,
        waves: [{
          id: "wave-1",
          eventId: "evt-1",
          label: "General",
          priceCents: 5000,
          closesAt: null,
          capacity: null,
          sortOrder: 0,
        }],
      },
      details: {
        eventId: "evt-1",
        coverImageUrl: null,
        bagDrop: null,
        parking: null,
        accessibilityInfo: null,
        additionalNotes: null,
      },
    });

    expect(response.basics?.title).toBe("Test Event");
    expect(response.schedule?.venue).toBe("MCG");
    expect(response.tickets?.waves).toEqual([{ label: "General", price: "50" }]);
    expect(response.adminReview).toBeNull();
  });

  it("toEventResponse maps adminReview nested object", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const response = toEventResponse({
      id: "evt-2",
      organiserId: "org-1",
      status: "REJECTED",
      isPinned: false,
      createdAt: now,
      updatedAt: now,
      adminReview: {
        eventId: "evt-2",
        adminNotes: "Needs better photos",
        rejectionReason: "Incomplete listing",
        reviewedById: "admin-1",
        reviewedAt: now,
        reviewedBy: { id: "admin-1", email: "admin@startline.test", name: "Admin" },
      },
    });
    expect(response.adminReview?.rejectionReason).toBe("Incomplete listing");
    expect(response.adminReview?.reviewedBy?.email).toBe("admin@startline.test");
  });

  it("getWaves maps prisma wave rows to API shape", () => {
    const waves = getWaves({
      tickets: {
        waves: [{
          id: "w1",
          eventId: "evt-1",
          label: "Early Bird",
          priceCents: 9500,
          closesAt: new Date("2026-05-01T00:00:00Z"),
          capacity: 80,
          sortOrder: 0,
        }],
      },
    });
    expect(waves).toEqual([{
      label: "Early Bird",
      price: "95",
      closes: "2026-05-01",
      date: "2026-05-01",
      qty: 80,
    }]);
  });
});
