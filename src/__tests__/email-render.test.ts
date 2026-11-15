import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { RegistrationConfirmationEmail } from "@/emails/registration-confirmation";
import { WaitlistConfirmationEmail } from "@/emails/waitlist-confirmation";
import { ContactMessageEmail } from "@/emails/contact-message";
import { FeedbackSubmittedEmail } from "@/emails/feedback-submitted";
import { renderEmail } from "@/emails/render";
import {
  buildRegistrationConfirmationEmail,
  buildEventApprovedEmail,
  buildEventRejectedEmail,
  buildEventSubmittedForReviewEmail,
  buildReviewReportedEmail,
  buildWaveUpdateEmail,
  buildFollowedOrganiserEventEmail,
  buildEventChangedEmail,
  buildEventEditPendingReviewEmail,
  buildEventEditDecisionEmail,
  buildRefundRequestEmail,
} from "@/lib/email";
import { formatEmailDate, formatEmailTime, googleCalendarUrl } from "@/lib/email-format";
import { formatEventPlace } from "@/lib/event-place";

// Every transactional email in the app goes through `render` from
// @react-email/render, which converts the HTML body to text with html-to-text.
// These tests cover both halves of that conversion, so an upgrade of either
// package is caught here rather than in a sent email.

const data = {
  eventId: "evt-42",
  eventName: "Green Valley Trail Run",
  eventDate: "Sun 15 Nov 2026",
  startTime: "7:00 AM",
  category: "21km",
  location: "Green Valley, NSW",
  bib: "1042",
  registrationFee: "$95.00",
  serviceFee: "$4.75",
  total: "$99.75",
  userEmail: "harper.jones@startline.test",
};

describe("registration confirmation email", () => {
  it("renders the HTML body", async () => {
    const html = await render(RegistrationConfirmationEmail(data));

    expect(html).toContain("Green Valley Trail Run");
    expect(html).toContain("$99.75");
    expect(html).toContain("harper.jones@startline.test");
  });

  it("renders a plain-text body", async () => {
    const text = await render(RegistrationConfirmationEmail(data), { plainText: true });

    expect(text).toContain("Green Valley Trail Run");
    expect(text).toContain("Green Valley, NSW");
    expect(text).toContain("#1042");
    expect(text).toContain("$99.75");
    expect(text).not.toContain("<");
  });

  // Issue #512: the email showed `2026-11-21`, `07:00` and `, Melbourne vic`.
  it("formats the stored date, time and place", async () => {
    const { subject, html, text } = await buildRegistrationConfirmationEmail({
      ...data,
      eventDate: "2026-11-21",
      startTime: "07:00",
      location: formatEventPlace({ venue: "", city: "Melbourne", state: "vic" }),
      category: "General admission",
    });

    expect(subject).toBe("You're registered for Green Valley Trail Run");
    expect(html).toContain("Sat, 21 Nov 2026");
    expect(html).toContain("7:00 AM");
    expect(html).toContain("Melbourne VIC");
    expect(html).not.toContain(", Melbourne");
    expect(html).toContain("General admission");
    expect(text).toContain("Sat, 21 Nov 2026");
  });

  it("links to the event itself, and to a calendar when there is a start time", async () => {
    const calendarUrl = googleCalendarUrl({
      title: data.eventName,
      startsAtUtc: new Date("2026-11-20T20:00:00Z"),
      endsAtUtc: new Date("2026-11-21T01:00:00Z"),
    });
    const html = await render(RegistrationConfirmationEmail({ ...data, calendarUrl }));

    expect(html).toContain("/events/evt-42");
    expect(html).toContain("Add to calendar");
    expect(html).toContain("calendar.google.com");

    const without = await render(RegistrationConfirmationEmail(data));
    expect(without).not.toContain("Add to calendar");
  });
});

describe("email formatting", () => {
  it("formats stored values and leaves anything else alone", () => {
    expect(formatEmailDate("2026-11-21")).toBe("Sat, 21 Nov 2026");
    expect(formatEmailDate("Sat, 21 Nov 2026")).toBe("Sat, 21 Nov 2026");
    expect(formatEmailDate(null)).toBeNull();
    expect(formatEmailTime("07:00")).toBe("7:00 AM");
    expect(formatEmailTime("18:30")).toBe("6:30 PM");
    expect(formatEmailTime("TBC")).toBe("TBC");
  });

  it("builds a calendar link from the UTC instants, or none without a start", () => {
    const url = googleCalendarUrl({
      title: "Harbour 10K",
      startsAtUtc: "2027-03-20T20:00:00.000Z",
      endsAtUtc: null,
      location: "Sydney NSW",
    });
    expect(url).toContain("dates=20270320T200000Z%2F20270320T210000Z");
    expect(url).toContain("text=Harbour+10K");
    expect(googleCalendarUrl({ title: "x", startsAtUtc: null })).toBeNull();
  });
});

// Every email, rendered the way it is sent. Guards the issue #512 regressions
// across the board: no SVG images (Gmail and Outlook drop them), no gradient
// CTA (Outlook paints nothing), the shared header and footer on every email.
const opts = { environment: "prod", siteUrl: "https://startlineau.com" };
const allEmails: [string, () => Promise<{ html: string; text: string }>][] = [
  ["registration", () => buildRegistrationConfirmationEmail({ ...data, eventDate: "2026-11-21", startTime: "07:00" })],
  ["approved", () => buildEventApprovedEmail("Harbour 10K", opts)],
  ["rejected", () => buildEventRejectedEmail("Harbour 10K", "Missing <course> map", opts)],
  ["submitted", () => buildEventSubmittedForReviewEmail(
    { eventId: "evt-1", eventTitle: "Harbour 10K", organiserName: "Apex", eventDate: "2027-03-21", city: "Sydney", state: "nsw", blocker: "No ABN on file" },
    opts,
  )],
  ["reported", () => buildReviewReportedEmail(
    { reviewTitle: "Great", reviewBody: "Loved it", reviewerName: "Harper", organiserName: "Apex", reason: "Spam", reportCount: 1 },
    opts,
  )],
  ["wave", () => buildWaveUpdateEmail("harper@example.com", { athleteName: "Harper Jones", eventTitle: "Harbour 10K", eventId: "evt-1", waveLabel: "Elite", waveTime: "06:30", eventDate: "2027-03-21" }, opts)],
  ["followed", () => buildFollowedOrganiserEventEmail("harper@example.com", { followerName: "Harper", organiserName: "Apex", eventTitle: "Harbour 10K", eventId: "evt-1", eventDate: "2027-03-21", city: "Sydney" }, opts)],
  ["changed", () => buildEventChangedEmail(
    { athleteName: "Harper", eventId: "evt-1", eventTitle: "Harbour 10K", organiserName: "Apex", changes: [{ label: "Start date", from: "14 Mar", to: "21 Mar" }] },
    opts,
  )],
  ["edit pending", () => buildEventEditPendingReviewEmail(
    { eventId: "evt-1", eventTitle: "Harbour 10K", organiserName: "Apex", changes: [{ label: "Venue", from: "A", to: "B" }] },
    opts,
  )],
  ["edit decision", () => buildEventEditDecisionEmail({ eventTitle: "Harbour 10K", approved: false, reason: "Too vague", eventUrl: "https://x.test/e" })],
  ["refund", () => buildRefundRequestEmail({ ticketId: "t1", athleteName: "Harper", athleteEmail: "h@x.test", eventTitle: "Harbour 10K", eventDate: "2027-03-21", reason: "Clash", eventUrl: "https://x.test/r" })],
  ["waitlist", () => renderEmail(WaitlistConfirmationEmail())],
  ["contact", () => renderEmail(ContactMessageEmail({ name: "Harper", email: "h@x.test", subject: "Hi", message: "Line one\nLine <two>" }))],
  ["feedback", () => renderEmail(FeedbackSubmittedEmail({ reference: "SL-1234", type: "Bug", title: "Broken", details: "It broke", filenames: ["a.png"] }))],
];

describe.each(allEmails)("%s email", (_name, build) => {
  it("uses the shared layout and only email-safe assets", async () => {
    const { html, text } = await build();

    expect(html).toContain("/email/logo.png");
    expect(html).toContain("#B3E153");
    expect(html).not.toMatch(/<img[^>]+\.svg/);
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("<script");
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain("<td");
  });
});

describe("escaping", () => {
  it("escapes values from organisers and the public", async () => {
    const rejected = await buildEventRejectedEmail("A & B", "Missing <course> map", opts);
    expect(rejected.html).toContain("A &amp; B");
    expect(rejected.html).toContain("Missing &lt;course&gt; map");

    const contact = await renderEmail(ContactMessageEmail({ name: "<b>x</b>", email: "h@x.test", subject: "Hi", message: "m" }));
    expect(contact.html).not.toContain("<b>x</b>");
  });

  it("formats dates on athlete and admin emails", async () => {
    const wave = await buildWaveUpdateEmail("h@x.test", { eventTitle: "Harbour 10K", eventId: "e", waveLabel: "Elite", waveTime: "06:30", eventDate: "2027-03-21" }, opts);
    expect(wave.html).toContain("Sun, 21 Mar 2027");
    expect(wave.html).toContain("6:30 AM");
    expect(wave.html).toContain("Hi,");

    const submitted = await buildEventSubmittedForReviewEmail(
      { eventId: "e", eventTitle: "T", organiserName: "O", eventDate: "2027-03-21", city: "Sydney", state: "nsw" },
      opts,
    );
    expect(submitted.html).toContain("Sun, 21 Mar 2027");
    expect(submitted.html).toContain("Sydney NSW");
  });
});
