import {
  signInMethodsFromCognito,
  type CognitoUserSnapshot,
  type SignInMethods,
} from "./sign-in-methods";
import type { SocialProvider } from "./social-providers";

/**
 * The dev/E2E bypass identities have no Cognito user. These fixed snapshots
 * let Settings → Login & security render the #389 states without AWS.
 */
export function simulatedSignInMethods(
  bypass: string,
  enabledProviders: SocialProvider[] = [],
): SignInMethods {
  const snapshot = (userStatus: string, identities: unknown[]): CognitoUserSnapshot => ({
    userStatus,
    attributes: identities.length
      ? [{ Name: "identities", Value: JSON.stringify(identities) }]
      : [],
  });

  if (bypass === "social") {
    return signInMethodsFromCognito(
      snapshot("EXTERNAL_PROVIDER", [{ providerName: "Google", userId: "google-social" }]),
      enabledProviders,
    );
  }
  if (bypass === "apple") {
    return signInMethodsFromCognito(
      snapshot("EXTERNAL_PROVIDER", [{ providerName: "SignInWithApple", userId: "apple-social" }]),
      enabledProviders,
    );
  }
  if (bypass === "linked") {
    return signInMethodsFromCognito(
      snapshot("CONFIRMED", [{ providerName: "Google", userId: "google-linked" }]),
      enabledProviders,
    );
  }
  return signInMethodsFromCognito(snapshot("CONFIRMED", []), enabledProviders);
}
