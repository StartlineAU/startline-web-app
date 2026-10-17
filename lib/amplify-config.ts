import { ResourcesConfig } from "aws-amplify";

const poolId   = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID    ?? "";
const domain   = process.env.NEXT_PUBLIC_COGNITO_DOMAIN       ?? "";

// Google and Apple sign in through Cognito's hosted endpoint, which hands back
// to /auth/callback on whichever host started it. Built from the current origin
// because the code verifier lives in that origin's storage: a callback on
// another portal could not finish the exchange. Every origin here must be in
// the client's callback_urls (oauth_origins in startline-infra) or Cognito
// refuses the redirect.
function oauthConfig() {
  if (!domain || typeof window === "undefined") return undefined;
  const origin = window.location.origin;
  return {
    domain,
    scopes: ["openid", "email", "profile", "aws.cognito.signin.user.admin"],
    redirectSignIn: [`${origin}/auth/callback`],
    redirectSignOut: [`${origin}/`],
    responseType: "code" as const,
  };
}

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: poolId,
      userPoolClientId: clientId,
      loginWith: { email: true, oauth: oauthConfig() },
      authenticationFlowType: "USER_SRP_AUTH",
    },
  },
} as ResourcesConfig;
