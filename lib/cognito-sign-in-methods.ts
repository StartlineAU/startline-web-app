import {
  AdminDeleteUserCommand,
  AdminDisableProviderForUserCommand,
  AdminGetUserCommand,
  AdminLinkProviderForUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import prisma from "./prisma";
import {
  identityFor,
  identitiesFromSnapshot,
  mayRemoveProvider,
  signInMethodsFromCognito,
  type CognitoAttribute,
  type SignInMethods,
} from "./sign-in-methods";
import {
  cognitoProviderName,
  type SocialProvider,
} from "./social-providers";

const region     = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const client     = new CognitoIdentityProviderClient({ region });

export class SignInMethodError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SignInMethodError";
  }
}

export type CognitoUserSnapshot = {
  username: string;
  userStatus: string | null;
  attributes: CognitoAttribute[];
};

export async function getCognitoUserSnapshot(username: string): Promise<CognitoUserSnapshot> {
  if (!userPoolId) {
    throw new SignInMethodError("unavailable", 503, "Sign-in methods cannot be managed in this environment.");
  }
  const result = await client.send(new AdminGetUserCommand({
    UserPoolId: userPoolId,
    Username: username,
  }));
  return {
    username: result.Username ?? username,
    userStatus: result.UserStatus ?? null,
    attributes: result.UserAttributes ?? [],
  };
}

export async function getSignInMethods(
  username: string,
  enabledProviders: SocialProvider[],
): Promise<SignInMethods> {
  const snapshot = await getCognitoUserSnapshot(username);
  return signInMethodsFromCognito(snapshot, enabledProviders);
}

export async function unlinkProvider({
  username,
  provider,
  enabledProviders,
}: {
  username: string;
  provider: SocialProvider;
  enabledProviders: SocialProvider[];
}): Promise<SignInMethods> {
  const snapshot = await getCognitoUserSnapshot(username);
  const methods = signInMethodsFromCognito(snapshot, enabledProviders);

  if (!mayRemoveProvider(methods, provider)) {
    const linked = methods.providers.find((method) => method.provider === provider)?.linked;
    if (!linked) {
      throw new SignInMethodError("not-linked", 409, "That account is not connected.");
    }
    throw new SignInMethodError("last-method", 409, "Connect another way to sign in before disconnecting this one.");
  }

  const identity = identityFor(identitiesFromSnapshot(snapshot), provider);
  if (!identity) {
    throw new SignInMethodError("not-linked", 409, "That account is not connected.");
  }

  try {
    await client.send(new AdminDisableProviderForUserCommand({
      UserPoolId: userPoolId,
      User: {
        ProviderName: identity.providerName,
        ProviderAttributeName: "Cognito_Subject",
        ProviderAttributeValue: identity.subject,
      },
    }));
  } catch (error) {
    throw mapCognitoError(error, "Could not disconnect that account.");
  }

  return getSignInMethods(snapshot.username, enabledProviders);
}

export type LinkCompletion = {
  currentUsername: string;
  currentSub: string;
  provider: SocialProvider;
  providerSubject: string;
  // The Cognito user the provider authorization produced. When Cognito had not
  // seen this identity before it made a fresh external-provider profile; that
  // has to be removed before it can be linked to the signed-in account.
  resultUsername: string;
  resultSub: string;
  resultEmail?: string;
  enabledProviders: SocialProvider[];
};

export async function completeProviderLink(completion: LinkCompletion): Promise<SignInMethods> {
  const {
    currentUsername, currentSub, provider, providerSubject,
    resultUsername, resultSub, resultEmail, enabledProviders,
  } = completion;

  const current = await getCognitoUserSnapshot(currentUsername);
  const currentIdentities = identitiesFromSnapshot(current);
  const already = identityFor(currentIdentities, provider);
  if (already) {
    if (already.subject === providerSubject) {
      return signInMethodsFromCognito(current, enabledProviders);
    }
    // One account per provider. Connecting a second Google account would
    // silently swap which identity gets in, so refuse it instead.
    throw new SignInMethodError("already-linked", 409, "That provider is already connected to this account.");
  }

  // The pre sign-up trigger already linked this identity to the signed-in user,
  // usually because both addresses match. Re-read rather than assuming: the
  // claim can lag, and reporting success without a link would leave the card
  // showing nothing.
  if (resultSub === currentSub) {
    const updated = await getCognitoUserSnapshot(currentUsername);
    if (identityFor(identitiesFromSnapshot(updated), provider)?.subject === providerSubject) {
      return signInMethodsFromCognito(updated, enabledProviders);
    }
    throw new SignInMethodError("failed", 502, "Cognito did not confirm the new sign-in method.");
  }

  const result = await getCognitoUserSnapshot(resultUsername);
  // A local account, or an external profile already linked to one, is somebody
  // else's account. Never pull its identity across.
  if (result.userStatus !== "EXTERNAL_PROVIDER") {
    throw new SignInMethodError("already-linked", 409, "That account is already connected to a different Startline account.");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { cognitoSub: resultSub },
        ...(resultEmail ? [{ email: resultEmail }] : []),
      ],
    },
    select: { cognitoSub: true },
  });
  if (existing && existing.cognitoSub !== currentSub) {
    throw new SignInMethodError("already-linked", 409, "That account is already connected to a different Startline account.");
  }

  try {
    // Cognito will not merge a federated profile that has already signed up.
    // Deleting the throwaway external profile leaves the provider identity free
    // to be linked to the signed-in account instead.
    await client.send(new AdminDeleteUserCommand({
      UserPoolId: userPoolId,
      Username: resultUsername,
    }));

    await client.send(new AdminLinkProviderForUserCommand({
      UserPoolId: userPoolId,
      DestinationUser: {
        ProviderName: "Cognito",
        ProviderAttributeValue: currentUsername,
      },
      SourceUser: {
        ProviderName: cognitoProviderName(provider),
        ProviderAttributeName: "Cognito_Subject",
        ProviderAttributeValue: providerSubject,
      },
    }));
  } catch (error) {
    throw mapCognitoError(error, "Could not connect that account.");
  }

  const updated = await getCognitoUserSnapshot(currentUsername);
  if (!identityFor(identitiesFromSnapshot(updated), provider)) {
    throw new SignInMethodError("failed", 502, "Cognito did not confirm the new sign-in method.");
  }
  return signInMethodsFromCognito(updated, enabledProviders);
}

function mapCognitoError(error: unknown, fallback: string): SignInMethodError {
  if (error instanceof SignInMethodError) return error;

  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";

  if (name === "ResourceNotFoundException" || name === "UserNotFoundException") {
    return new SignInMethodError("not-found", 404, "That account could not be found.");
  }
  if (name === "AliasExistsException") {
    return new SignInMethodError("already-linked", 409, "That account is already connected to a different Startline account.");
  }
  if (name === "InvalidParameterException" && /already|merg|link/i.test(message)) {
    return new SignInMethodError("already-linked", 409, "That account is already connected to a different Startline account.");
  }
  if (name === "TooManyRequestsException" || name === "LimitExceededException") {
    return new SignInMethodError("rate-limited", 429, "Too many attempts. Please wait a few minutes and try again.");
  }
  if (name === "NotAuthorizedException") {
    return new SignInMethodError("not-authorized", 403, "Startline is not allowed to manage sign-in methods for this account.");
  }

  console.error("Cognito sign-in method request failed:", error);
  return new SignInMethodError("failed", 500, fallback);
}

export { userPoolId };
