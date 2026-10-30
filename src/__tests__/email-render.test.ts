import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { RegistrationConfirmationEmail } from "@/emails/registration-confirmation";

// Every transactional email in the app goes through `render` from
// @react-email/render, which converts the HTML body to text with html-to-text.
// These tests cover both halves of that conversion, so an upgrade of either
// package is caught here rather than in a sent email.

const data = {
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
});
