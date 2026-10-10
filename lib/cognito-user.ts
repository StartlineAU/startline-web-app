import { cookies } from "next/headers";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

const region   = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";

/** For calls made as the signed-in user, authorised by their own access token. */
export const cognito = new CognitoIdentityProviderClient({ region });

/**
 * The signed-in user's Cognito access token, read from the cookies Amplify
 * writes. Null when there is no real Cognito session, which includes the e2e
 * bypass identities.
 */
export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  const lastAuthUser = store.get(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)?.value;
  if (!lastAuthUser) return null;
  return (
    store.get(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`)?.value ??
    store.get(`CognitoIdentityServiceProvider.${clientId}.${encodeURIComponent(lastAuthUser)}.accessToken`)?.value ??
    null
  );
}

/**
 * Turns a Cognito rejection into something a person can act on. These used to
 * escape as a bare 500, so the settings screen could only say "something went
 * wrong" to a mistyped password or code.
 */
export function describeCognitoError(err: unknown): { status: number; error: string } {
  const name = err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAuthorizedException":
      return { status: 400, error: "Your current password is incorrect." };
    case "InvalidPasswordException":
      return { status: 400, error: "That password does not meet the requirements." };
    case "CodeMismatchException":
    case "EnableSoftwareTokenMFAException":
      return { status: 400, error: "That code did not match. Check it and try again." };
    case "ExpiredCodeException":
      return { status: 400, error: "That code has expired. Request a new one." };
    case "AliasExistsException":
    case "UsernameExistsException":
      return { status: 409, error: "That email address is already used by another account." };
    case "InvalidParameterException":
      return { status: 400, error: "That does not look like a valid email address." };
    case "LimitExceededException":
    case "TooManyRequestsException":
      return { status: 429, error: "Too many attempts. Please wait a few minutes and try again." };
    default:
      console.error("Cognito request failed:", err);
      return { status: 500, error: "Something went wrong. Please try again." };
  }
}
