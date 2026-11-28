import { describe, expect, it } from "vitest";
import {
  isValidContactName,
  isValidPersonName,
  isValidPhone,
  isValidTeamName,
} from "@/lib/text-input-rules";
import { normaliseTeamName, teamNameError } from "@/lib/team-tickets";
import { getEmergencyContactErrors, getRegistrationFormErrors, createEmptyParticipant } from "@/lib/registration-form";

describe("isValidPersonName", () => {
  it.each(["Nathan", "O'Brien", "O’Brien", "Mary-Jane", "St. John", "Zoë", "Nguyễn Văn", "김민준", "José María"])(
    "accepts %s",
    (name) => expect(isValidPersonName(name)).toBe(true),
  );

  it.each(["", "  ", "<script>", "Bob]=1", "a;b", "=SUM(A1)", "-Nathan", "Nathan2", "Na​than", "Na\tthan"])(
    "rejects %j",
    (name) => expect(isValidPersonName(name)).toBe(false),
  );
});

describe("isValidContactName", () => {
  it.each(["Jane (Mum)", "Mum & Dad", "Smith, Jane"])("accepts %s", (name) =>
    expect(isValidContactName(name)).toBe(true),
  );
  it.each(["(Mum)", "Jane <Mum>", "Jane; Dad"])("rejects %s", (name) =>
    expect(isValidContactName(name)).toBe(false),
  );
});

describe("isValidTeamName", () => {
  it.each(["Hectic Cats", "Team 3", "3 Amigos", "Les Écureuils"])(
    "accepts %s",
    (name) => expect(isValidTeamName(name)).toBe(true),
  );

  it.each([
    "Hectic C ]13-=3-]4]1=14['.'..'.'/';'.'12567890",
    "=HYPERLINK(\"x\")",
    "+team",
    "<b>Team</b>",
    "Team`s",
    "#1",
    "Team #3",
    "Run & Done!",
    "O'Neill Crew",
    "The A-Team",
    "Fast, Faster",
    "Team (Mixed)",
    "Why?",
  ])("rejects %s", (name) => expect(isValidTeamName(name)).toBe(false));
});

describe("teamNameError", () => {
  it("explains each failure", () => {
    expect(teamNameError("")).toMatch(/name/);
    expect(teamNameError("a".repeat(61))).toMatch(/at most 60/);
    expect(teamNameError("Bad]Name")).toMatch(/letters, numbers and spaces/);
    expect(teamNameError(normaliseTeamName("  Hectic   Cats "))).toBeNull();
  });
});

describe("isValidPhone", () => {
  it.each(["0412 345 678", "+61 412 345 678", "(03) 9123 4567", "0412-345-678"])("accepts %s", (phone) =>
    expect(isValidPhone(phone)).toBe(true),
  );
  it.each(["12345", "0412 345 678 ext 2", "04123;45678", "+61+412345678", "1".repeat(16)])("rejects %s", (phone) =>
    expect(isValidPhone(phone)).toBe(false),
  );
});

describe("registration form uses the rules", () => {
  const valid = {
    ...createEmptyParticipant(),
    firstName: "Nathan",
    lastName: "O'Brien",
    dateOfBirth: "1990-01-01",
    email: "nathan@example.com",
    emergencyContactName: "Jane (Mum)",
    emergencyContactPhone: "0412 345 678",
  };

  it("passes clean details", () => {
    expect(getRegistrationFormErrors(valid, { includeWaiver: false })).toEqual({});
  });

  it("flags symbols in names and phones", () => {
    const errors = getRegistrationFormErrors(
      { ...valid, firstName: "Na]than", lastName: "=1", mobile: "call me", emergencyContactPhone: "abc" },
      { includeWaiver: false },
    );
    expect(errors.firstName).toBeDefined();
    expect(errors.lastName).toBeDefined();
    expect(errors.mobile).toBeDefined();
    expect(errors.emergencyContactPhone).toBeDefined();
  });

  it("leaves a blank optional mobile alone", () => {
    expect(getRegistrationFormErrors({ ...valid, mobile: "" }, { includeWaiver: false }).mobile).toBeUndefined();
  });

  it("checks a shared emergency contact too", () => {
    const errors = getEmergencyContactErrors({ name: "<img>", phone: "0412 345 678" }, [valid]);
    expect(errors.emergencyContactName).toBeDefined();
  });
});
