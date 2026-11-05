import {
  AdminInitiateAuthCommand,
  AdminSetUserMFAPreferenceCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import prisma from "./prisma";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  matchRecoveryCode,
} from "./recovery-codes";

const region       = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId   = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const linkClientId = process.env.NEXT_PUBLIC_COGNITO_LINK_CLIENT_ID ?? "";
const client       = new CognitoIdentityProviderClient({ region });

export type RecoveryOutcome =
  | { kind: "reset" }
  | { kind: "bad-credentials" }
  | { kind: "bad-code" }
  | { kind: "no-codes" }
  | { kind: "unavailable" };

function cognitoName(error: unknown): string {
  return error instanceof Error ? error.name : "";
}

/**
 * Turns the authenticator app off after the person proves the password and
 * spends a recovery code. The password is checked by Cognito (the same
 * ADMIN_USER_PASSWORD_AUTH flow as the Settings step-up); the code is checked
 * here, because Cognito has no API for a recovery code. Both are needed: the
 * password alone is what the second factor exists to protect.
 */
export async function resetAuthenticatorWithRecoveryCode({
  email,
  password,
  code,
}: {
  email: string;
  password: string;
  code: string;
}): Promise<RecoveryOutcome> {
  if (!userPoolId || !linkClientId) return { kind: "unavailable" };
  const username = email.trim().toLowerCase();

  let challenge;
  try {
    challenge = await client.send(new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: linkClientId,
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }));
  } catch (error) {
    if (cognitoName(error) === "NotAuthorizedException" || cognitoName(error) === "UserNotFoundException") {
      return { kind: "bad-credentials" };
    }
    throw error;
  }

  // Not an authenticator challenge means TOTP is not what is blocking this
  // account, so there is nothing to recover and nothing to reveal.
  if (challenge.ChallengeName !== "SOFTWARE_TOKEN_MFA") {
    return { kind: "bad-credentials" };
  }

  const user = await prisma.user.findUnique({
    where: { email: username },
    select: {
      id: true,
      recoveryCodeRows: {
        where: { usedAt: null },
        select: { id: true, codeHash: true },
      },
    },
  });
  if (!user) return { kind: "bad-credentials" };
  if (user.recoveryCodeRows.length === 0) return { kind: "no-codes" };

  const matchedHash = matchRecoveryCode(code, user.recoveryCodeRows.map((row) => row.codeHash));
  const match = user.recoveryCodeRows.find((row) => row.codeHash === matchedHash);
  if (!match) return { kind: "bad-code" };

  // One use only. A second request with the same code finds usedAt set.
  const spent = await prisma.recoveryCode.updateMany({
    where: { id: match.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (spent.count !== 1) return { kind: "bad-code" };

  await client.send(new AdminSetUserMFAPreferenceCommand({
    UserPoolId: userPoolId,
    Username: username,
    SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false },
  }));
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false },
  });

  return { kind: "reset" };
}

/** Replaces any earlier codes, so only the newest sheet works. */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })),
    }),
  ]);
  return codes;
}

export async function clearRecoveryCodes(userId: string): Promise<void> {
  await prisma.recoveryCode.deleteMany({ where: { userId } });
}
