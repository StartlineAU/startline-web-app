import { describe, it, expect, vi, beforeEach } from "vitest";

// Issue #374: every admin is emailed personally when a review is reported. The
// report is already stored, so a failed send is swallowed at the call site —
// which is exactly why the send has to be asserted somewhere.
// Issue #337: recipients are resolved from the Cognito admins group.

const mocks = vi.hoisted(() => ({
  review: { findUnique: vi.fn() },
  adminRecipients: vi.fn(),
  sendEmails: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: { review: mocks.review } }));
vi.mock("@/lib/admin-notification-recipients", () => ({
  listAdminReviewRecipients: mocks.adminRecipients,
}));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendReviewReportedEmails: mocks.sendEmails,
}));

import { buildReviewReportedEmail } from "@/lib/email";
import { notifyAdminsReviewReported } from "@/lib/notify-admins-review-reported";
import { formatReviewReportReason } from "@/lib/review-helpers";

const reportedReview = {
  title: "Challenging but rewarding",
  body: "Great community vibe.",
  reviewerName: "Chloe Bennett",
  eventTitle: "Hyrox Melbourne",
  organiser: { orgName: "Apex Endurance Events", email: "sarah@example.com" },
  _count: { reports: 2 },
};

describe("notifyAdminsReviewReported", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmails.mockResolvedValue(undefined);
    mocks.adminRecipients.mockResolvedValue([
      "nathan@startlineau.com",
      "hugo@startlineau.com",
    ]);
  });

  it("emails every deliverable member of the admins group with the review and the reason", async () => {
    mocks.review.findUnique.mockResolvedValue(reportedReview);

    expect(await notifyAdminsReviewReported("rev-1", "Spam or advertising")).toEqual({ emailed: 2 });
    expect(mocks.sendEmails).toHaveBeenCalledWith(
      ["nathan@startlineau.com", "hugo@startlineau.com"],
      expect.objectContaining({
        reviewTitle: "Challenging but rewarding",
        reviewerName: "Chloe Bennett",
        organiserName: "Apex Endurance Events",
        eventTitle: "Hyrox Melbourne",
        reason: "Spam or advertising",
        reportCount: 2,
      }),
    );
  });

  it("sends nothing when the review is gone, without asking Cognito", async () => {
    mocks.review.findUnique.mockResolvedValue(null);

    expect(await notifyAdminsReviewReported("rev-1", "Other: whatever")).toEqual({ emailed: 0 });
    expect(mocks.adminRecipients).not.toHaveBeenCalled();
    expect(mocks.sendEmails).not.toHaveBeenCalled();
  });

  it("sends nothing when the admins group has no deliverable address", async () => {
    mocks.review.findUnique.mockResolvedValue(reportedReview);
    mocks.adminRecipients.mockResolvedValue([]);

    expect(await notifyAdminsReviewReported("rev-1", "Other: whatever")).toEqual({ emailed: 0 });
    expect(mocks.sendEmails).not.toHaveBeenCalled();
  });
});

describe("buildReviewReportedEmail", () => {
  const data = {
    reviewTitle: "<script>x</script>",
    reviewBody: "A & B",
    reviewerName: "Chloe",
    organiserName: "Apex",
    eventTitle: null,
    reason: "Spam: <b>",
    reportCount: 3,
  };

  it("escapes user-written text and links to the reported queue", () => {
    const { html } = buildReviewReportedEmail(data, { environment: "prod", siteUrl: "https://startlineau.com" });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("Spam: &lt;b&gt;");
    expect(html).toContain('href="https://admin.startlineau.com/admin/reviews?filter=reported"');
  });

  it("tags staging so a test report is not mistaken for a real one", () => {
    const { subject } = buildReviewReportedEmail(data, { environment: "staging" });
    expect(subject).toBe("[Staging] Review reported: <script>x</script> (3 reports)");
  });
});

describe("formatReviewReportReason", () => {
  it("appends the details when given, and omits them otherwise", () => {
    expect(formatReviewReportReason("Spam or advertising", "Links to a shop."))
      .toBe("Spam or advertising: Links to a shop.");
    expect(formatReviewReportReason("Not about this organiser")).toBe("Not about this organiser");
    expect(formatReviewReportReason("Other", "   ")).toBe("Other");
  });
});
