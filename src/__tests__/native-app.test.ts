// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  setTokens: vi.fn(),
  isNative: vi.fn(() => false),
  browserOpen: vi.fn(),
  signInWithRedirect: vi.fn(),
}));

vi.mock("aws-amplify/auth/cognito", () => ({
  cognitoUserPoolsTokenProvider: { tokenOrchestrator: { setTokens: mocks.setTokens } },
}));
vi.mock("aws-amplify/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("aws-amplify/auth")>()),
  signInWithRedirect: mocks.signInWithRedirect,
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: mocks.isNative, getPlatform: () => "android" },
}));
vi.mock("@capacitor/browser", () => ({ Browser: { open: mocks.browserOpen } }));

import {
  NATIVE_REDIRECT_URI, authorizeUrl, completeNativeSignIn, nativeCallbackPath, pkceChallenge,
} from "@/lib/native-oauth";
import { appLinkTarget, isSameSite } from "@/lib/capacitor";
import { androidAssetLinks, appleAppSiteAssociation } from "@/lib/mobile-app";
import { servesWhileWaitlisted } from "@/lib/site-mode";
import { startSocialSignIn } from "@/lib/social-sign-in";

// A JWT with { username: "google_123", iat: 1700000000 } as its payload.
const jwt = (payload: Record<string, unknown>) =>
  `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_COGNITO_DOMAIN", "auth.startlineau.com");
  vi.stubEnv("NEXT_PUBLIC_COGNITO_CLIENT_ID", "client-1");
});

describe("native sign-in", () => {
  it("asks Cognito for the provider with PKCE and the app's own callback", () => {
    const url = new URL(authorizeUrl("apple", "state-1", "challenge-1"));
    expect(url.origin).toBe("https://auth.startlineau.com");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      identity_provider: "SignInWithApple",
      redirect_uri: NATIVE_REDIRECT_URI,
      response_type: "code",
      client_id: "client-1",
      state: "state-1",
      code_challenge: "challenge-1",
      code_challenge_method: "S256",
    });
  });

  it("derives the S256 challenge: base64url SHA-256 of the verifier, unpadded", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r-wW1gFWFOEjXk";
    // Checked against Node's own hash, an independent implementation.
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(await pkceChallenge(verifier)).toBe(expected);
    expect(expected).not.toMatch(/[+/=]/);
  });

  it("turns the app-scheme callback into the web callback path", () => {
    expect(nativeCallbackPath(`${NATIVE_REDIRECT_URI}?code=abc&state=xyz`))
      .toBe("/auth/callback?code=abc&state=xyz&native=1");
    expect(nativeCallbackPath(`${NATIVE_REDIRECT_URI}?error=access_denied&error_description=cancelled`))
      .toBe("/auth/callback?error=access_denied&error_description=cancelled&native=1");
    expect(nativeCallbackPath("https://startlineau.com/auth/callback?code=abc")).toBeNull();
  });

  it("swaps the code with the same redirect URI and stores tokens where Amplify reads them", async () => {
    localStorage.setItem("startline_native_oauth_verifier", "verifier-1");
    localStorage.setItem("startline_native_oauth_state", "state-1");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: jwt({ username: "google_123", iat: 1700000000 }),
      id_token: jwt({ email: "harper.jones@startline.test" }),
      refresh_token: "refresh-1",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await completeNativeSignIn("code-1", "state-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://auth.startlineau.com/oauth2/token");
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({
      grant_type: "authorization_code",
      client_id: "client-1",
      code: "code-1",
      redirect_uri: NATIVE_REDIRECT_URI,
      code_verifier: "verifier-1",
    });
    const { tokens } = mocks.setTokens.mock.calls[0][0];
    expect(tokens.username).toBe("google_123");
    expect(tokens.refreshToken).toBe("refresh-1");
    expect(tokens.idToken.payload.email).toBe("harper.jones@startline.test");
    // The verifier is single use.
    expect(localStorage.getItem("startline_native_oauth_verifier")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("refuses a callback whose state does not match, without calling Cognito", async () => {
    localStorage.setItem("startline_native_oauth_verifier", "verifier-1");
    localStorage.setItem("startline_native_oauth_state", "state-1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(completeNativeSignIn("code-1", "forged")).rejects.toThrow(/state/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.setTokens).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("opens the system browser in the app and keeps Amplify's redirect on the web", async () => {
    await startSocialSignIn("google", "/events/1");
    expect(mocks.signInWithRedirect).toHaveBeenCalledWith({ provider: "Google" });
    expect(mocks.browserOpen).not.toHaveBeenCalled();

    mocks.isNative.mockReturnValue(true);
    await startSocialSignIn("google", "/events/1");
    expect(mocks.signInWithRedirect).toHaveBeenCalledTimes(1);
    const opened = new URL(mocks.browserOpen.mock.calls[0][0].url);
    expect(opened.searchParams.get("identity_provider")).toBe("Google");
    expect(opened.searchParams.get("state")).toBe(localStorage.getItem("startline_native_oauth_state"));
    expect(sessionStorage.getItem("startline_social_return_to")).toBe("/events/1");
  });
});

describe("app links", () => {
  const prod = new URL("https://startlineau.com/");
  // Staging is the Amplify branch domain; there is no staging subdomain.
  const staging = new URL("http://localhost:3000/activity");

  it("treats the production portals as one site", () => {
    expect(isSameSite(new URL("https://organiser.startlineau.com/organiser/dashboard"), prod)).toBe(true);
    expect(isSameSite(new URL("https://stripe.com/"), prod)).toBe(false);
  });

  it("keeps a staging build on staging when a production link is tapped", () => {
    expect(appLinkTarget(new URL("https://startlineau.com/events/abc?x=1"), staging))
      .toBe("http://localhost:3000/events/abc?x=1");
    expect(appLinkTarget(new URL("https://organiser.startlineau.com/organiser"), prod))
      .toBe("https://organiser.startlineau.com/organiser");
  });

  it("publishes nothing until the store identifiers are known", () => {
    expect(appleAppSiteAssociation("")).toBeNull();
    expect(androidAssetLinks([])).toBeNull();
  });

  it("lists the app under the team ID and signing certificate", () => {
    expect(appleAppSiteAssociation("A1B2C3D4E5")?.applinks.details[0].appIDs).toEqual(["A1B2C3D4E5.com.startlineau.app"]);
    expect(androidAssetLinks(["AB:CD"])?.[0].target).toEqual({
      namespace: "android_app", package_name: "com.startlineau.app", sha256_cert_fingerprints: ["AB:CD"],
    });
  });

  it("serves both files while the athlete site is waitlisted", () => {
    expect(servesWhileWaitlisted("/.well-known/apple-app-site-association")).toBe(true);
    expect(servesWhileWaitlisted("/.well-known/assetlinks.json")).toBe(true);
    expect(servesWhileWaitlisted("/.well-known/anything-else")).toBe(false);
  });
});
