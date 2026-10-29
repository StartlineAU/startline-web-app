import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Issue #337: admin alerts go to the Cognito admins group, not the Admin table,
// so an admin who has never signed in to the admin portal still gets them.

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class {
    send = mocks.send;
  },
  ListUsersInGroupCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import {
  adminReviewRecipients,
  listAdminReviewRecipients,
} from "@/lib/admin-notification-recipients";

function user(email: string, extra: { Enabled?: boolean; verified?: boolean } = {}) {
  return {
    Enabled: extra.Enabled,
    Attributes: [
      { Name: "email", Value: email },
      { Name: "email_verified", Value: extra.verified === false ? "false" : "true" },
    ],
  };
}

describe("adminReviewRecipients", () => {
  it("de-duplicates case-insensitively and drops blanks", () => {
    expect(adminReviewRecipients(["Nathan@Startlineau.com", "nathan@startlineau.com ", "", null, undefined]))
      .toEqual(["nathan@startlineau.com"]);
  });

  // Staging's Cognito group holds the seeded @startline.test admins, which can
  // never receive mail.
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

describe("listAdminReviewRecipients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_COGNITO_USER_POOL_ID", "ap-southeast-2_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reads the admins group, skipping disabled members and reserved domains", async () => {
    mocks.send.mockResolvedValueOnce({
      Users: [
        user("Nathan@Startlineau.com"),
        user("disabled@startlineau.com", { Enabled: false }),
        user("marcus.stirling@startline.test"),
        { Enabled: true, Attributes: [{ Name: "email_verified", Value: "true" }] },
      ],
    });

    expect(await listAdminReviewRecipients()).toEqual(["nathan@startlineau.com"]);
    expect(mocks.send).toHaveBeenCalledTimes(1);

    const command = mocks.send.mock.calls[0]?.[0] as { input: Record<string, unknown> } | undefined;
    expect(command?.input).toEqual({
      UserPoolId: "ap-southeast-2_test",
      GroupName: "admins",
      NextToken: undefined,
    });
  });

  it("does not require email_verified, so a newly added admin is not missed", async () => {
    mocks.send.mockResolvedValueOnce({
      Users: [user("new.admin@startlineau.com", { verified: false })],
    });

    expect(await listAdminReviewRecipients()).toEqual(["new.admin@startlineau.com"]);
  });

  it("pages through every group member and de-duplicates across pages", async () => {
    mocks.send
      .mockResolvedValueOnce({
        Users: [user("nathan@startlineau.com")],
        NextToken: "page-2",
      })
      .mockResolvedValueOnce({
        Users: [user("NATHAN@startlineau.com"), user("hugo@startlineau.com")],
      });

    expect(await listAdminReviewRecipients()).toEqual([
      "nathan@startlineau.com",
      "hugo@startlineau.com",
    ]);
    expect(mocks.send).toHaveBeenCalledTimes(2);

    const second = mocks.send.mock.calls[1]?.[0] as { input: Record<string, unknown> } | undefined;
    expect(second?.input.NextToken).toBe("page-2");
  });

  it("sends to nobody and logs when Cognito cannot be reached", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockRejectedValueOnce(new Error("AccessDeniedException"));

    expect(await listAdminReviewRecipients()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      "Cognito admin recipient lookup failed:",
      expect.any(Error),
    );
  });

  it("does not call Cognito when the user pool is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_COGNITO_USER_POOL_ID", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await listAdminReviewRecipients()).toEqual([]);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "NEXT_PUBLIC_COGNITO_USER_POOL_ID not configured — skipping admin email notification",
    );
  });
});
