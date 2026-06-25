import { describe, it, expect } from "vitest";
import { buildRegistrationConfirmationEmail } from "@/lib/email";

describe("buildRegistrationConfirmationEmail", () => {
  it("includes event and ticket details in subject and body", () => {
    const { subject, html } = buildRegistrationConfirmationEmail({
      athleteEmail: "alex@example.com",
      athleteName: "Alex Rossi",
      eventTitle: "The Apex Throwdown 2026",
      eventDate: "2026-08-15",
      startTime: "07:30",
      venue: "Melbourne Sports & Aquatic Centre",
      city: "Melbourne",
      waveLabel: "Early Bird",
      amountCents: 9500,
      eventId: "seed-event-001",
      idempotencyKey: "pi_test_123",
    });

    expect(subject).toBe("You're registered for The Apex Throwdown 2026");
    expect(html).toContain("Alex Rossi");
    expect(html).toContain("The Apex Throwdown 2026");
    expect(html).toContain("Early Bird");
    expect(html).toContain("$95.00");
    expect(html).toContain("/events/seed-event-001");
  });
});
