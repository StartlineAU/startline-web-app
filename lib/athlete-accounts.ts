import { randomBytes } from "crypto";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";

const region     = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const client     = new CognitoIdentityProviderClient({ region });

function generateTempPassword(): string {
  const rand = randomBytes(8).toString("hex");
  return rand + "A!";
}

export async function ensureAthleteCognitoUser(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();

  try {
    const result = await client.send(new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: normalized,
    }));
    return result.Username ?? normalized;
  } catch (err) {
    if (!(err instanceof UsernameExistsException) && (err as { name?: string }).name !== "UserNotFoundException") {
      throw err;
    }
  }

  try {
    await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: normalized,
      TemporaryPassword: generateTempPassword(),
      MessageAction: "SUPPRESS",
    }));
  } catch (err) {
    if (!(err instanceof UsernameExistsException)) throw err;
  }

  const result = await client.send(new AdminGetUserCommand({
    UserPoolId: userPoolId,
    Username: normalized,
  }));
  return result.Username ?? normalized;
}

/**
 * Find a Cognito user by the email they type at sign-in.
 *
 * Native users have the email as their username, so AdminGetUser finds them.
 * Google and Apple users get a provider-generated username (`Google_<sub>`),
 * so the email is only an attribute and AdminGetUser cannot find them. A
 * ListUsers filter does, and it returns the username the app must hand to
 * Amplify once a password has been added to that profile.
 */
export async function findCognitoUserByEmail(
  email: string,
): Promise<{ username: string; status: string | null } | null> {
  const normalized = email.toLowerCase().trim();

  try {
    const result = await client.send(new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: normalized,
    }));
    return { username: result.Username ?? normalized, status: result.UserStatus ?? null };
  } catch (err) {
    if ((err as { name?: string }).name !== "UserNotFoundException") throw err;
  }

  const escaped = normalized.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const result = await client.send(new ListUsersCommand({
    UserPoolId: userPoolId,
    Filter: `email = "${escaped}"`,
    Limit: 1,
  }));
  const user = result.Users?.[0];
  if (!user?.Username) return null;
  return { username: user.Username, status: user.UserStatus ?? null };
}

export async function getCognitoUserStatus(email: string): Promise<{ exists: boolean; status: string | null }> {
  const user = await findCognitoUserByEmail(email);
  if (!user) return { exists: false, status: null };
  // Coarse status only — never leak the raw lifecycle (e.g.
  // FORCE_CHANGE_PASSWORD / RESET_REQUIRED) to unauthenticated callers.
  return { exists: true, status: user.status === "UNCONFIRMED" ? "UNCONFIRMED" : "CONFIRMED" };
}


