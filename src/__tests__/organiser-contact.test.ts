import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONTACT_VISIBILITY, effectiveVisibility, resolveOrganiserContact, telHref,
  type OrganiserContactSource,
} from "@/lib/organiser-contact";

const organiser: OrganiserContactSource = {
  contactName: "Sarah Mitchell",
  contactEmail: "events@apex.test",
  phone: "0412 345 678",
  showContactName: true,
  showContactEmail: true,
  showContactPhone: false,
};

describe("resolveOrganiserContact", () => {
  it("shows what the organisation chose when the event has no say", () => {
    expect(resolveOrganiserContact(organiser)).toEqual({
      name: "Sarah Mitchell", email: "events@apex.test", phone: null,
    });
  });

  it("lets the event override each detail, either way", () => {
    const contact = resolveOrganiserContact(organiser, {
      showContactName: false, showContactEmail: null, showContactPhone: true,
    });
    expect(contact).toEqual({ name: null, email: "events@apex.test", phone: "0412 345 678" });
  });

  it("never returns a detail that is switched off", () => {
    const contact = resolveOrganiserContact({ ...organiser, showContactEmail: false });
    expect(JSON.stringify(contact)).not.toContain("events@apex.test");
    expect(JSON.stringify(contact)).not.toContain("0412");
  });

  it("is null when nothing is shown, so the section is left out", () => {
    expect(resolveOrganiserContact(organiser, {
      showContactName: false, showContactEmail: false, showContactPhone: false,
    })).toBeNull();
  });

  it("treats a blank detail as not there", () => {
    expect(resolveOrganiserContact({ ...organiser, contactName: "  ", contactEmail: null })).toBeNull();
  });
});

describe("effectiveVisibility", () => {
  it("defaults phone off for a new organisation", () => {
    expect(DEFAULT_CONTACT_VISIBILITY).toEqual({ name: true, email: true, phone: false });
  });

  it("uses the event's choice only where it made one", () => {
    expect(effectiveVisibility(
      { name: true, email: false, phone: false },
      { name: null, email: true, phone: null },
    )).toEqual({ name: true, email: true, phone: false });
  });
});

describe("telHref", () => {
  it("drops the spaces and punctuation people type", () => {
    expect(telHref("+61 (04) 1234-5678")).toBe("tel:+610412345678");
  });
});
