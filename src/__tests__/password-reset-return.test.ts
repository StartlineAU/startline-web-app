import { describe, it, expect } from "vitest";
import { signInAfterResetHref, readSignInRequest } from "@/lib/password-reset-return";

describe("signInAfterResetHref", () => {
  it("opens sign-in with the reset flag and the email", () => {
    const href = signInAfterResetHref("/", " sam+test@example.com ");
    expect(href.startsWith("/?")).toBe(true);
    expect(readSignInRequest(href.slice(1))).toEqual({ email: "sam+test@example.com", afterReset: true });
  });

  it("leaves the email out when there is none", () => {
    expect(signInAfterResetHref("/organiser", "")).toBe("/organiser?signin=true&reset=1");
  });
});

describe("readSignInRequest", () => {
  it("returns null without signin=true", () => {
    expect(readSignInRequest("?reset=1&email=a@b.com")).toBeNull();
    expect(readSignInRequest("")).toBeNull();
  });

  it("reads a plain sign-in request", () => {
    expect(readSignInRequest("?signin=true")).toEqual({ email: "", afterReset: false });
  });
});
