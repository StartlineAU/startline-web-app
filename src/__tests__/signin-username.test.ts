import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { findCognitoUserByEmail } = vi.hoisted(() => ({ findCognitoUserByEmail: vi.fn() }));
vi.mock("@/lib/athlete-accounts", () => ({ findCognitoUserByEmail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));

import { POST } from "@/app/api/user/signin-username/route";

const post = (email: string) =>
  POST(new NextRequest("http://localhost/api/user/signin-username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }));

describe("POST /api/user/signin-username", () => {
  beforeEach(() => findCognitoUserByEmail.mockReset());

  it("returns the provider username for a linked account", async () => {
    findCognitoUserByEmail.mockResolvedValue({ username: "Google_123" });
    const res = await post("jo@example.com");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ username: "Google_123" });
  });

  it("answers an unknown email exactly as it answers a native account", async () => {
    findCognitoUserByEmail.mockResolvedValue({ username: "native@example.com" });
    const known = await post("native@example.com");
    findCognitoUserByEmail.mockResolvedValue(null);
    const unknown = await post("nobody@example.com");
    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual({ username: "nobody@example.com" });
  });
});
