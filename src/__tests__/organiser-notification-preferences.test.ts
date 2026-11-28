import { describe, expect, it } from "vitest";
import { wantsNotification } from "@/lib/organiser-notification-preferences";

const allOn = {
  notifyEventApproved: true,
  notifyEventRejected: true,
  notifyNewRegistration: true,
  notifyEventFinished: true,
};

describe("wantsNotification", () => {
  it("sends every kind while the switches are on", () => {
    expect(wantsNotification(allOn, "EVENT_APPROVED")).toBe(true);
    expect(wantsNotification(allOn, "EVENT_REJECTED")).toBe(true);
    expect(wantsNotification(allOn, "NEW_REGISTRATION")).toBe(true);
    expect(wantsNotification(allOn, "EVENT_FINISHED")).toBe(true);
  });

  it("turns off only the kind whose switch is off", () => {
    const prefs = { ...allOn, notifyNewRegistration: false };
    expect(wantsNotification(prefs, "NEW_REGISTRATION")).toBe(false);
    expect(wantsNotification(prefs, "EVENT_APPROVED")).toBe(true);
    expect(wantsNotification(prefs, "EVENT_REJECTED")).toBe(true);
  });

  it("keeps approval and rejection independent", () => {
    const prefs = { ...allOn, notifyEventRejected: false };
    expect(wantsNotification(prefs, "EVENT_REJECTED")).toBe(false);
    expect(wantsNotification(prefs, "EVENT_APPROVED")).toBe(true);
  });

  it("has its own switch for the event finished notice (#561)", () => {
    const prefs = { ...allOn, notifyEventFinished: false };
    expect(wantsNotification(prefs, "EVENT_FINISHED")).toBe(false);
    expect(wantsNotification(prefs, "NEW_REGISTRATION")).toBe(true);
  });
});
