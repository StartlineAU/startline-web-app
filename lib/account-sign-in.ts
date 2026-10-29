import {
  AdminDisableProviderForUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import type { ServerSession } from "@/lib/amplify-server";
import {
  parseIdentities,
  simulatedSignInState,
  type AccountSignInState,
  type LinkedIdentity,
} from "@/lib/account-sign-in-shared";

export * from "@/lib/account-sign-in-shared";

const region     = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const client     = new CognitoIdentityProviderClient({ region });

/**
 * The current sign-in methods, read from Cognito rather than trusted from the
 * browser. A stale ID token still carries identities after an unlink, so the
 * user profile is the authoritative copy.
 */
export async function getAccountSignInState(
  session: ServerSession,
): Promise<AccountSignInState | null> {
  if (session.bypass) return simulatedSignInState(session.bypass);
  if (!userPoolId) return null;

  try {
    const result = await client.send(new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username:   session.cognitoUsername ?? session.email,
    }));
    const identities = result.UserAttributes?.find((attribute) => attribute.Name === "identities")?.Value;
    return {
      // EXTERNAL_PROVIDER is Cognito's "this profile has no password" state.
      // AdminSetUserPassword moves it to CONFIRMED.
      hasPassword: result.UserStatus !== "EXTERNAL_PROVIDER",
      identities:  parseIdentities(identities),
    };
  } catch (err) {
    console.error("Could not read Cognito sign-in methods:", err);
    return null;
  }
}

/**
 * Add a permanent password to the existing Cognito profile. For a federated
 * user this moves UserStatus from EXTERNAL_PROVIDER to CONFIRMED; the username
 * itself does not change.
 */
export async function setAccountPassword(session: ServerSession, password: string): Promise<void> {
  if (!userPoolId) throw new Error("Cognito is not configured.");
  await client.send(new AdminSetUserPasswordCommand({
    UserPoolId: userPoolId,
    Username:   session.cognitoUsername ?? session.email,
    Password:   password,
    Permanent:  true,
  }));
}

/**
 * Remove one provider identity from the current Cognito profile. The person
 * keeps the same Cognito subject and their password.
 */
export async function unlinkProvider(
  session: ServerSession,
  identity: LinkedIdentity,
): Promise<void> {
  if (!userPoolId) throw new Error("Cognito is not configured.");
  await client.send(new AdminDisableProviderForUserCommand({
    UserPoolId: userPoolId,
    User: {
      ProviderAttributeName:  "Cognito_Subject",
      ProviderAttributeValue: identity.userId,
      ProviderName:           identity.providerName,
    },
  }));
}
