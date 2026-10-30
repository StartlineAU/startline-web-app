import { describe, it, expect } from "vitest";
import { organiserNotificationRecipients } from "@/lib/organiser-notification-recipients";

const base = {
  email: "owner@example.com",
  contactEmail: "events@example.com",
  notifyManagers: true,
  members: [
    { role: "OWNER" as const, user: { email: "owner@example.com" } },
    { role: "MANAGER" as const, user: { email: "manager@example.com" } },
  ],
};

describe("organiserNotificationRecipients", () => {
  it("includes the account email, the contact email and managers", () => {
    expect(organiserNotificationRecipients(base)).toEqual([
      "owner@example.com",
      "events@example.com",
      "manager@example.com",
    ]);
  });

  it("leaves managers out when the owner has turned the setting off", () => {
    expect(organiserNotificationRecipients({ ...base, notifyManagers: false })).toEqual([
      "owner@example.com",
      "events@example.com",
    ]);
  });

  it("always includes an owner who is not the original creator", () => {
    const recipients = organiserNotificationRecipients({
      ...base,
      notifyManagers: false,
      members: [...base.members, { role: "OWNER" as const, user: { email: "second-owner@example.com" } }],
    });
    expect(recipients).toContain("second-owner@example.com");
    expect(recipients).not.toContain("manager@example.com");
  });

  it("sends one email when the contact email is the owner's own, whatever the case", () => {
    expect(organiserNotificationRecipients({ ...base, contactEmail: " Owner@Example.com ", members: [] }))
      .toEqual(["owner@example.com"]);
  });

  it("skips a missing or malformed contact email", () => {
    expect(organiserNotificationRecipients({ ...base, contactEmail: null, members: [] })).toEqual(["owner@example.com"]);
    expect(organiserNotificationRecipients({ ...base, contactEmail: "not an email", members: [] })).toEqual(["owner@example.com"]);
  });
});
