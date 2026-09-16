import { describe, it, expect } from "vitest";
import {
  validateRegistrationForm,
  validateParticipants,
  getRegistrationFormErrors,
  getEmergencyContactErrors,
  calcAgeFromIsoDate,
  maxDateOfBirthForMinAge,
  splitFullName,
  createEmptyParticipant,
  matchPreviousTickets,
} from "@/lib/registration-form";

describe("registration form validation", () => {
  const valid = {
    firstName: "Alex",
    lastName: "Rossi",
    dateOfBirth: "1995-06-15",
    gender: "",
    email: "alex@example.com",
    mobile: "0400000000",
    emergencyContactName: "Jamie Rossi",
    emergencyContactPhone: "0400000001",
    medicalNotes: "",
    estimatedFinish: "",
    waiverAccepted: true,
  };

  it("accepts valid data", () => {
    expect(validateRegistrationForm(valid)).toBeNull();
  });

  it("requires waiver acceptance", () => {
    expect(validateRegistrationForm({ ...valid, waiverAccepted: false })).toMatch(/waiver/i);
  });

  it("requires emergency contact", () => {
    expect(validateRegistrationForm({ ...valid, emergencyContactPhone: "" })).toMatch(/emergency/i);
  });

  it("rejects an emergency contact matching the single registrant", () => {
    const errors = getRegistrationFormErrors({
      ...valid,
      emergencyContactName: "Alex Rossi",
      emergencyContactPhone: "0400000000",
    });
    expect(errors.emergencyContactName).toMatch(/other than a participant/i);
    expect(errors.emergencyContactPhone).toMatch(/differ from participant/i);
  });

  it("requires participants to be at least 18", () => {
    const latestAllowed = maxDateOfBirthForMinAge();
    const d = new Date(latestAllowed + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const tooYoungIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const errors = getRegistrationFormErrors({ ...valid, dateOfBirth: tooYoungIso });
    expect(errors.dateOfBirth).toMatch(/at least 18/i);
    expect(calcAgeFromIsoDate(latestAllowed)).toBe(18);
  });

  it("returns field-level errors for all missing fields", () => {
    const errors = getRegistrationFormErrors({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      email: "",
      mobile: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      medicalNotes: "",
      estimatedFinish: "",
      waiverAccepted: false,
    });

    expect(errors.firstName).toBeTruthy();
    expect(errors.lastName).toBeTruthy();
    expect(errors.dateOfBirth).toBeTruthy();
    expect(errors.email).toBeTruthy();
    // Phone is optional in the registration form design.
    expect(errors.mobile).toBeUndefined();
    expect(errors.emergencyContactName).toBeTruthy();
    expect(errors.emergencyContactPhone).toBeTruthy();
    expect(errors.waiverAccepted).toBeTruthy();
  });

  it("validates each participant independently", () => {
    const { errors } = validateParticipants([
      createEmptyParticipant(),
      {
        ...createEmptyParticipant(),
        firstName: "Jamie",
        lastName: "Rossi",
        dateOfBirth: "1990-01-01",
        email: "jamie@example.com",
        mobile: "0400000000",
        emergencyContactName: "Alex Rossi",
        emergencyContactPhone: "0400000001",
        waiverAccepted: true,
      },
    ]);

    expect(errors[0]).toBeTruthy();
    expect(errors[1]).toBeUndefined();
  });

  it("uses one shared emergency contact for group registrations", () => {
    const participants = [
      {
        ...createEmptyParticipant(),
        firstName: "Alex",
        lastName: "Rossi",
        dateOfBirth: "1990-01-01",
        email: "alex@example.com",
        mobile: "0400000000",
        waiverAccepted: true,
      },
      {
        ...createEmptyParticipant(),
        firstName: "Jamie",
        lastName: "Rossi",
        dateOfBirth: "1992-02-02",
        email: "jamie@example.com",
        mobile: "0400000002",
        waiverAccepted: true,
      },
    ];

    const { errors, emergencyContactErrors } = validateParticipants(participants, {
      groupRegistration: true,
      sharedEmergencyContact: { name: "Pat Rossi", phone: "0400000003" },
    });

    expect(errors[0]).toBeUndefined();
    expect(errors[1]).toBeUndefined();
    expect(emergencyContactErrors).toEqual({});
  });

  it("rejects shared emergency contact that matches a participant", () => {
    const participants = [
      {
        ...createEmptyParticipant(),
        firstName: "Alex",
        lastName: "Rossi",
        dateOfBirth: "1990-01-01",
        email: "alex@example.com",
        mobile: "0400000000",
        waiverAccepted: true,
      },
    ];

    const nameMatch = getEmergencyContactErrors(
      { name: "Alex Rossi", phone: "0400000003" },
      participants
    );
    expect(nameMatch.emergencyContactName).toMatch(/other than a participant/i);

    const phoneMatch = getEmergencyContactErrors(
      { name: "Pat Rossi", phone: "0400 000 000" },
      participants
    );
    expect(phoneMatch.emergencyContactPhone).toMatch(/differ from participant/i);
  });
});

describe("splitFullName", () => {
  it("splits first and last name", () => {
    expect(splitFullName("Alex Rossi")).toEqual({ firstName: "Alex", lastName: "Rossi" });
  });
});

// Which previous ticket becomes which new one. Both the buyer's typed details
// and the extras they chose follow this mapping, so a wrong answer here does
// not just lose a form field: it posts one participant's shirt size against a
// different participant.
describe("matchPreviousTickets", () => {
  it("keeps every ticket in place when nothing changes", () => {
    expect(matchPreviousTickets(2, ["Half", "Marathon"], ["Half", "Marathon"])).toEqual([0, 1]);
  });

  it("returns null for slots with no previous ticket to inherit", () => {
    expect(matchPreviousTickets(0, [], ["Half"])).toEqual([null]);
    expect(matchPreviousTickets(1, ["Half"], ["Half", "Half"])).toEqual([0, null]);
  });

  // The regression this function exists for. Dropping the first tier shifts the
  // surviving ticket from index 1 to index 0; anything pinned to its old index
  // would now belong to the wrong person.
  it("follows a ticket to its new index when an earlier tier is removed", () => {
    expect(matchPreviousTickets(2, ["Half", "Marathon"], ["Marathon"])).toEqual([1]);
  });

  it("matches on tier before falling back to position", () => {
    // The Marathon ticket is claimed by tier even though it sits second.
    expect(matchPreviousTickets(2, ["Half", "Marathon"], ["Marathon", "Half"])).toEqual([1, 0]);
  });

  it("gives each new slot a distinct previous ticket", () => {
    const mapping = matchPreviousTickets(3, ["A", "A", "B"], ["A", "A", "B"]);
    expect(new Set(mapping).size).toBe(mapping.length);
  });

  // A buyer who swaps one tier for another keeps what they already typed,
  // rather than being handed an empty form.
  it("reuses a leftover ticket positionally when no tier matches", () => {
    expect(matchPreviousTickets(1, ["Half"], ["Marathon"])).toEqual([0]);
  });

  it("drops the surplus when the ticket count falls", () => {
    // Two of the three tickets survive; the third has nothing to map to.
    const mapping = matchPreviousTickets(3, ["A", "A", "A"], ["A", "A"]);
    expect(mapping).toEqual([0, 1]);
  });

  it("never returns an index outside the previous tickets", () => {
    const mapping = matchPreviousTickets(2, ["A", "B"], ["C", "D", "E"]);
    for (const index of mapping) {
      if (index != null) expect(index).toBeLessThan(2);
    }
  });
});
