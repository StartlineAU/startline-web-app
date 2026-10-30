import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "@/lib/amplify-server";
import {
  completeProviderLink,
  SignInMethodError,
} from "@/lib/cognito-sign-in-methods";
import {
  exchangeLinkCode,
  LINK_COOKIES,
  verifyCognitoIdToken,
} from "@/lib/cognito-oauth";
import {
  identityFor,
  parseIdentityEntries,
  safeReturnTo,
} from "@/lib/sign-in-methods";
import { enabledSocialProviders, type SocialProvider } from "@/lib/social-providers";

function clearLinkCookies(response: NextResponse) {
  for (const name of Object.values(LINK_COOKIES)) {
    response.cookies.delete(name);
  }
  return response;
}

function failure(req: NextRequest, returnTo: string, code: string) {
  const target = new URL(returnTo, req.url);
  target.searchParams.set("settings", "security");
  target.searchParams.set("linkError", code);
  return clearLinkCookies(NextResponse.redirect(target));
}

function success(req: NextRequest, returnTo: string, provider: SocialProvider) {
  const target = new URL(returnTo, req.url);
  target.searchParams.set("settings", "security");
  target.searchParams.set("linked", provider);
  return clearLinkCookies(NextResponse.redirect(target));
}

// Cognito hands the provider authorization back here, separately from
// /auth/callback, so linking never becomes a sign-in as the provider's own
// Cognito user.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const store = await cookies();

  const returnTo = safeReturnTo(store.get(LINK_COOKIES.returnTo)?.value);
  const expectedState = store.get(LINK_COOKIES.state)?.value;
  const verifier = store.get(LINK_COOKIES.verifier)?.value;
  const providerValue = store.get(LINK_COOKIES.provider)?.value;
  const provider: SocialProvider | null =
    providerValue === "google" || providerValue === "apple" ? providerValue : null;

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");

  if (!provider || !verifier || !state || !expectedState || state !== expectedState) {
    return failure(req, returnTo, "failed");
  }

  if (providerError || !code) {
    return failure(req, returnTo, providerError === "access_denied" ? "cancelled" : "failed");
  }

  const session = await getServerSession();
  if (!session?.username) return failure(req, returnTo, "unavailable");

  try {
    const tokens = await exchangeLinkCode({
      code,
      verifier,
      origin: url.origin,
    });
    if (!tokens) return failure(req, returnTo, "failed");

    const payload = await verifyCognitoIdToken(tokens.idToken);
    if (!payload) return failure(req, returnTo, "failed");

    const identities = parseIdentityEntries(payload.identities);
    const identity = identityFor(identities, provider);
    const resultUsername = typeof payload["cognito:username"] === "string"
      ? payload["cognito:username"]
      : "";
    const resultSub = typeof payload.sub === "string" ? payload.sub : "";
    if (!identity || !resultUsername || !resultSub) {
      return failure(req, returnTo, "failed");
    }

    await completeProviderLink({
      currentUsername: session.username,
      currentSub: session.sub,
      provider,
      providerSubject: identity.subject,
      resultUsername,
      resultSub,
      resultEmail: typeof payload.email === "string" ? payload.email : undefined,
      enabledProviders: enabledSocialProviders(),
    });

    return success(req, returnTo, provider);
  } catch (error) {
    if (error instanceof SignInMethodError) {
      return failure(req, returnTo, error.code);
    }
    console.error("Provider link callback failed:", error);
    return failure(req, returnTo, "failed");
  }
}
