import { describe, it, expect } from "vitest";
import { buildEventChangedEmail, buildRefundRequestEmail } from "@/lib/email";

const changes = [{ label: "Start date", from: "2027-03-14", to: "2027-03-21" }];

describe("event changed email", () => {
  it("tells the athlete what changed and sends them to Support for a refund", async () => {
    const { subject, html } = await buildEventChangedEmail(
      {
        athleteName: "Harper Jones",
        eventId: "evt-1",
        eventTitle: "Harbour 10K",
        organiserName: "Apex <Endurance>",
        changes,
      },
      { siteUrl: "https://startlineau.com" },
    );

    expect(subject).toBe("Harbour 10K has changed");
    expect(html).toContain("Hi Harper,");
    expect(html).toContain("2027-03-14");
    expect(html).toContain("2027-03-21");
    expect(html).toContain("Your entry still stands");
    expect(html).toContain("https://startlineau.com/support");
    // No promise of an automatic refund.
    expect(html).not.toContain("full refund");
    // Organiser-controlled text is escaped.
    expect(html).toContain("Apex &lt;Endurance&gt;");
  });
});

describe("refund request email", () => {
  it("names the athlete, the event and the reason, and links to the review", async () => {
    const { subject, html } = await buildRefundRequestEmail({
      ticketId: "tkt-1",
      athleteName: "Harper Jones",
      athleteEmail: "harper@example.com",
      eventTitle: "Harbour 10K",
      eventDate: "2027-03-21",
      reason: "Clash <with> another race",
      eventUrl: "https://organiser.startlineau.com/organiser/refunds",
    });

    expect(subject).toBe("Refund request: Harbour 10K");
    expect(html).toContain("Harper Jones");
    expect(html).toContain("harper@example.com");
    // Stored dates are shown the way the app writes them.
    expect(html).toContain("Sun, 21 Mar 2027");
    expect(html).toContain("Clash &lt;with&gt; another race");
    expect(html).toContain("/organiser/refunds");
  });
});
