import { describe, it, expect, vi, beforeEach } from "vitest";

// Issue #321: admins asked to be emailed, personally, whenever an organiser
// lists an event that needs review, and to land on a preview of it.

const mocks = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  admin: { findMany: vi.fn() },
  sendEmails: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: { event: mocks.event, admin: mocks.admin } }));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEventSubmittedForReviewEmails: mocks.sendEmails,
}));

import { buildEventSubmittedForReviewEmail } from "@/lib/email";
import { approvalBlocker } from "@/lib/event-approval";
import { adminReviewRecipients, notifyAdminsEventSubmitted } from "@/lib/notify-admins-event-submitted";

const organiser = {
  orgName: "Hugo Publications",
  contactName: "Hugo Shrowder",
  email: "hugo@example.com",
  abn: "28 398 141 735",
  stripeOnboardingComplete: true,
};

const pendingEvent = {
  id: "evt-1",
  title: "Hugos",
  status: "PENDING",
  eventDate: "2026-09-26",
  city: "Melbourne",
  state: "vic",
  discipline: "crossfit",
  registrationType: "startline",
  organiser,
};

describe("approvalBlocker", () => {
  it("never blocks an external listing", () => {
    expect(approvalBlocker({ registrationType: "external", organiser: { abn: null, stripeOnboardingComplete: false } })).toBeNull();
  });

  it("names the ABN first, then Stripe", () => {
    expect(approvalBlocker({ registrationType: "startline", organiser: { abn: null, stripeOnboardingComplete: false } }))
      .toBe("No ABN on file");
    expect(approvalBlocker({ registrationType: "startline", organiser: { abn: organiser.abn, stripeOnboardingComplete: false } }))
      .toBe("Stripe onboarding incomplete");
    expect(approvalBlocker({ registrationType: "startline", organiser })).toBeNull();
  });
});

describe("adminReviewRecipients", () => {
  it("de-duplicates case-insensitively and drops blanks", () => {
    expect(adminReviewRecipients(["Nathan@Startlineau.com", "nathan@startlineau.com ", "", null, undefined]))
      .toEqual(["nathan@startlineau.com"]);
  });

  // Staging holds the seeded @startline.test admins, which can never receive mail.
  it("skips reserved, undeliverable domains and malformed addresses", () => {
    expect(adminReviewRecipients([
      "marcus.stirling@startline.test",
      "someone@example",
      "a@b.invalid",
      "not-an-email",
      "hugo@startlineau.com",
    ])).toEqual(["hugo@startlineau.com"]);
  });
});

describe("buildEventSubmittedForReviewEmail", () => {
  it("links to the admin portal preview in production", () => {
    const { subject, html } = buildEventSubmittedForReviewEmail(
      { eventId: "evt-1", eventTitle: "Hugos", organiserName: "Hugo Publications" },
      { environment: "prod", siteUrl: "https://startlineau.com" },
    );
    expect(subject).toBe("New event to review: Hugos");
    expect(html).toContain('href="https://admin.startlineau.com/admin/events/evt-1"');
    expect(html).toContain("https://admin.startlineau.com/admin/events?status=PENDING");
  });

  it("tags staging so a test listing is not mistaken for a real one", () => {
    const { subject, html } = buildEventSubmittedForReviewEmail(
      { eventId: "evt-1", eventTitle: "Hugos", organiserName: "Hugo Publications" },
      { environment: "staging", siteUrl: "https://main.d2tvgx9pzd2e81.amplifyapp.com" },
    );
    expect(subject).toBe("[Staging] New event to review: Hugos");
    expect(html).toContain('href="https://main.d2tvgx9pzd2e81.amplifyapp.com/admin/events/evt-1"');
  });

  it("escapes organiser-supplied text and surfaces an approval blocker", () => {
    const { html } = buildEventSubmittedForReviewEmail(
      { eventId: "evt-1", eventTitle: "<script>x</script>", organiserName: "A & B", blocker: "No ABN on file" },
      { environment: "prod", siteUrl: "https://startlineau.com" },
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("Cannot be approved yet: No ABN on file.");
  });
});

describe("notifyAdminsEventSubmitted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmails.mockResolvedValue(undefined);
    mocks.admin.findMany.mockResolvedValue([
      { email: "nathan@startlineau.com" },
      { email: "hugo@startlineau.com" },
      { email: "marcus.stirling@startline.test" },
    ]);
  });

  it("emails every deliverable admin with the event details", async () => {
    mocks.event.findUnique.mockResolvedValue(pendingEvent);

    const result = await notifyAdminsEventSubmitted("evt-1");

    expect(result).toEqual({ emailed: 2 });
    expect(mocks.sendEmails).toHaveBeenCalledWith(
      ["nathan@startlineau.com", "hugo@startlineau.com"],
      expect.objectContaining({
        eventId: "evt-1",
        eventTitle: "Hugos",
        organiserName: "Hugo Publications",
        city: "Melbourne",
        state: "vic",
        blocker: null,
      }),
    );
  });

  it("tells admins up front when the listing cannot be approved yet", async () => {
    mocks.event.findUnique.mockResolvedValue({ ...pendingEvent, organiser: { ...organiser, abn: null } });

    await notifyAdminsEventSubmitted("evt-1");

    expect(mocks.sendEmails).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ blocker: "No ABN on file" }));
  });

  it("sends nothing for an event that is not pending", async () => {
    mocks.event.findUnique.mockResolvedValue({ ...pendingEvent, status: "APPROVED" });

    expect(await notifyAdminsEventSubmitted("evt-1")).toEqual({ emailed: 0 });
    expect(mocks.sendEmails).not.toHaveBeenCalled();
  });

  it("sends nothing when no admin can receive mail", async () => {
    mocks.event.findUnique.mockResolvedValue(pendingEvent);
    mocks.admin.findMany.mockResolvedValue([{ email: "marcus.stirling@startline.test" }]);

    expect(await notifyAdminsEventSubmitted("evt-1")).toEqual({ emailed: 0 });
    expect(mocks.sendEmails).not.toHaveBeenCalled();
  });
});
