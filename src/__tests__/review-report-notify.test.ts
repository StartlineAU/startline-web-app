import { describe, it, expect, vi, beforeEach } from "vitest";

// Issue #374: every admin is emailed personally when a review is reported. The
// report is already stored, so a failed send is swallowed at the call site —
// which is exactly why the send has to be asserted somewhere.

const mocks = vi.hoisted(() => ({
  review: { findUnique: vi.fn() },
  admin: { findMany: vi.fn() },
  sendEmails: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: { review: mocks.review, admin: mocks.admin } }));
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
    mocks.admin.findMany.mockResolvedValue([
      { email: "nathan@startlineau.com" },
      { email: "hugo@startlineau.com" },
      { email: "marcus.stirling@startline.test" },
    ]);
  });

  it("emails every deliverable admin with the review and the reason", async () => {
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

  it("sends nothing when the review is gone", async () => {
    mocks.review.findUnique.mockResolvedValue(null);

    expect(await notifyAdminsReviewReported("rev-1", "Other: whatever")).toEqual({ emailed: 0 });
    expect(mocks.sendEmails).not.toHaveBeenCalled();
  });

  it("sends nothing when no admin can receive mail", async () => {
    mocks.review.findUnique.mockResolvedValue(reportedReview);
    mocks.admin.findMany.mockResolvedValue([{ email: "marcus.stirling@startline.test" }]);

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
