import { ResourcesConfig } from "aws-amplify";

/**
 * Amplify v6 configuration using environment variables.
 * NEXT_PUBLIC_* vars are safe to expose to the browser.
 * The User Pool Client must have no secret (public client).
 */
export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId:       process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: {
        email: true,
      },
    },
  },
};
