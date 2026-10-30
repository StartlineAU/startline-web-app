import type { ServerSession } from "@/lib/amplify-server";
import { getSignInMethods } from "@/lib/cognito-sign-in-methods";
import { simulatedSignInMethods } from "@/lib/e2e-sign-in-methods";
import type { SignInMethods } from "@/lib/sign-in-methods";
import { enabledSocialProviders } from "@/lib/social-providers";

/**
 * The signed-in account's sign-in methods. Returns null when Cognito cannot be
 * read, so callers can fail closed instead of treating an unknown state as
 * "password only".
 */
export async function getSessionSignInMethods(
  session: ServerSession,
): Promise<SignInMethods | null> {
  if (session.bypass) {
    return simulatedSignInMethods(session.bypass, enabledSocialProviders());
  }
  if (!session.username) return null;

  try {
    return await getSignInMethods(session.username, enabledSocialProviders());
  } catch (err) {
    console.error("Could not read Cognito sign-in methods:", err);
    return null;
  }
}
