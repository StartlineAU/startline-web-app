// Renders every transactional email with sample data to .email-preview/, so
// a template change can be looked at in a browser before it ships.
//
//   pnpm email:preview
//
// Images point at the local public/email folder, since a new asset is not on
// startlineau.com until it deploys. Open .email-preview/index.html.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderEmail } from "../emails/render";
import { WaitlistConfirmationEmail } from "../emails/waitlist-confirmation";
import { ContactMessageEmail } from "../emails/contact-message";
import { FeedbackSubmittedEmail } from "../emails/feedback-submitted";
import { SITE_URL } from "../emails/components/tokens";
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
} from "../lib/email";
import { googleCalendarUrl } from "../lib/email-format";
import { formatEventPlace } from "../lib/event-place";

const opts = { environment: "staging", siteUrl: "https://startlineau.com" };

// The issue #512 case: no venue, lower-case state, a long category.
const place = formatEventPlace({ venue: "", city: "Melbourne", state: "vic" });

const emails: Record<string, () => Promise<{ html: string }>> = {
  "registration-confirmation": () =>
    buildRegistrationConfirmationEmail({
      eventId: "evt-1",
      eventName: "Test Event",
      eventDate: "2026-11-21",
      startTime: "07:00",
      category: "General admission",
      location: place,
      registrationFee: "$0.00",
      serviceFee: "$0.00",
      total: "$0.00",
      userEmail: "harper.jones@startline.test",
      calendarUrl: googleCalendarUrl({
        title: "Test Event",
        startsAtUtc: "2026-11-20T20:00:00.000Z",
        endsAtUtc: "2026-11-21T01:00:00.000Z",
        location: place,
      }),
    }),
  "registration-confirmation-paid": () =>
    buildRegistrationConfirmationEmail({
      eventId: "evt-2",
      eventName: "Green Valley Trail Run Championship Series — Round 3",
      eventSeries: "Apex Endurance Events",
      eventDate: "2026-11-15",
      startTime: "06:30",
      category: "Half marathon (21.1km) — open men and women",
      location: formatEventPlace({ venue: "Green Valley Reserve", city: "Green Valley", state: "NSW" }),
      bib: "1042",
      registrationFee: "$95.00",
      serviceFee: "$4.75",
      total: "$99.75",
      userEmail: "harper.jones@startline.test",
    }),
  "event-approved": () => buildEventApprovedEmail("Harbour 10K", opts),
  "event-rejected": () => buildEventRejectedEmail("Harbour 10K", "The course map is missing and the start time says TBC.", opts),
  "event-submitted-for-review": () =>
    buildEventSubmittedForReviewEmail(
      { eventId: "evt-1", eventTitle: "Harbour 10K", organiserName: "Apex Endurance Events", eventDate: "2027-03-21", city: "Sydney", state: "nsw", discipline: "Running", blocker: "No ABN on file" },
      opts,
    ),
  "review-reported": () =>
    buildReviewReportedEmail(
      { reviewTitle: "Best race of the year", reviewBody: "Great course, well marshalled.\nWould run again.", reviewerName: "Harper Jones", organiserName: "Apex Endurance Events", eventTitle: "Harbour 10K", reason: "Spam or advertising: links to a shop", reportCount: 3 },
      opts,
    ),
  "wave-update": () =>
    buildWaveUpdateEmail("harper.jones@startline.test", { athleteName: "Harper Jones", eventTitle: "Harbour 10K", eventId: "evt-1", waveLabel: "Elite", waveTime: "06:30", eventDate: "2027-03-21" }, opts),
  "followed-organiser-event": () =>
    buildFollowedOrganiserEventEmail("harper.jones@startline.test", { followerName: "Harper Jones", organiserName: "Apex Endurance Events", eventTitle: "Harbour 10K", eventId: "evt-1", eventDate: "2027-03-21", city: "Sydney" }, opts),
  "event-changed": () =>
    buildEventChangedEmail(
      { athleteName: "Harper Jones", eventId: "evt-1", eventTitle: "Harbour 10K", organiserName: "Apex Endurance Events", changes: [{ label: "Start date", from: "Sun, 14 Mar 2027", to: "Sun, 21 Mar 2027" }, { label: "Venue", from: "Barangaroo Reserve", to: "Circular Quay" }] },
      opts,
    ),
  "event-edit-pending-review": () =>
    buildEventEditPendingReviewEmail(
      { eventId: "evt-1", eventTitle: "Harbour 10K", organiserName: "Coastal Fitness Collective", changes: [{ label: "Start time", from: "7:00 AM", to: "6:30 AM" }] },
      opts,
    ),
  "event-edit-approved": () => buildEventEditDecisionEmail({ eventTitle: "Harbour 10K", approved: true, eventUrl: "https://startlineau.com/organiser/events/evt-1" }),
  "event-edit-rejected": () => buildEventEditDecisionEmail({ eventTitle: "Harbour 10K", approved: false, reason: "The new date clashes with the council permit.", eventUrl: "https://startlineau.com/organiser/events/evt-1" }),
  "refund-request": () =>
    buildRefundRequestEmail({ ticketId: "tkt-1", athleteName: "Harper Jones", athleteEmail: "harper.jones@startline.test", eventTitle: "Harbour 10K", eventDate: "2027-03-21", reason: "The new date clashes with another race I've entered.", eventUrl: "https://organiser.startlineau.com/organiser/refunds" }),
  waitlist: () => renderEmail(WaitlistConfirmationEmail()),
  "contact-message": () =>
    renderEmail(ContactMessageEmail({ name: "Harper Jones", email: "harper.jones@startline.test", subject: "Group discount?", message: "Hi team,\n\nDo you offer group entries for clubs?\n\nThanks" })),
  "feedback-submitted": () =>
    renderEmail(FeedbackSubmittedEmail({ reference: "SL-4821", type: "Bug", title: "Map does not load on Safari", details: "Open any event page on iOS Safari.\nThe map stays grey.", email: "harper.jones@startline.test", filenames: ["screenshot.png"] })),
};

async function main() {
  const outDir = path.join(process.cwd(), ".email-preview");
  const assets = pathToFileURL(path.join(process.cwd(), "public", "email")).href + "/";

  await mkdir(outDir, { recursive: true });
  for (const [name, build] of Object.entries(emails)) {
    const { html } = await build();
    await writeFile(path.join(outDir, `${name}.html`), html.replaceAll(`${SITE_URL}/email/`, assets));
    console.log(`.email-preview/${name}.html`);
  }

  const links = Object.keys(emails).map((n) => `<li><a href="${n}.html">${n}</a></li>`).join("");
  await writeFile(
    path.join(outDir, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Email preview</title><body style="background:#141414;color:#F5F7FA;font-family:sans-serif;padding:24px"><h1>Startline emails</h1><ul>${links}</ul></body>`,
  );
  console.log(".email-preview/index.html");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
