import { ResourcesConfig } from "aws-amplify";

/**
 * Amplify v6 configuration using environment variables.
 * NEXT_PUBLIC_* vars are safe to expose to the browser.
 * When env vars aren't set (local dev bypass), returns an empty config
 * so Amplify.configure() doesn't throw "Auth UserPool not configured".
 */
const hasCognitoConfig = !!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

export const amplifyConfig: ResourcesConfig = hasCognitoConfig
  ? {
      Auth: {
        Cognito: {
          userPoolId:       process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
          userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
          loginWith: {
            email: true,
          },
        },
      },
    }
  : ({} as ResourcesConfig);
