import { ResourcesConfig } from "aws-amplify";

const poolId   = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID    ?? "";
const endpoint = process.env.NEXT_PUBLIC_COGNITO_ENDPOINT;

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: poolId,
      userPoolClientId: clientId,
      loginWith: { email: true },
      ...(endpoint ? { userPoolEndpoint: endpoint } : {}),
      authenticationFlowType: endpoint ? "USER_PASSWORD_AUTH" : "USER_SRP_AUTH",
    },
  },
} as ResourcesConfig;
