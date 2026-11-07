import { describe, it, expect } from "vitest";
import { buildEventChangedAdminEmail, buildEventChangedEmail } from "@/lib/email";

const changes = [{ label: "Start date", from: "2027-03-14", to: "2027-03-21" }];

describe("event changed emails", () => {
  it("tells the athlete what changed, that their entry stands, and the refund deadline", () => {
    const { subject, html } = buildEventChangedEmail(
      {
        athleteName: "Harper Jones",
        eventId: "evt-1",
        eventTitle: "Harbour 10K",
        organiserName: "Apex <Endurance>",
        changes,
        fullRefundUntil: "Sunday 21 March 2027, 7:00 am",
      },
      { siteUrl: "https://startlineau.com" },
    );

    expect(subject).toBe("Harbour 10K has changed: you can claim a full refund");
    expect(html).toContain("Hi Harper,");
    expect(html).toContain("2027-03-14");
    expect(html).toContain("2027-03-21");
    expect(html).toContain("including the booking fee");
    expect(html).toContain("Sunday 21 March 2027, 7:00 am");
    expect(html).toContain("https://startlineau.com/activity");
    // Organiser-controlled text is escaped.
    expect(html).toContain("Apex &lt;Endurance&gt;");
  });

  it("tags the admin alert on staging and links to the event", () => {
    const { subject, html } = buildEventChangedAdminEmail(
      { eventId: "evt-1", eventTitle: "Harbour 10K", organiserName: "Coastal", changes },
      { environment: "staging", siteUrl: "http://localhost:3000" },
    );

    expect(subject).toBe("[Staging] Live event changed: Harbour 10K");
    expect(html).toContain("/admin/events/evt-1");
    expect(html).toContain("is not verified");
  });
});
