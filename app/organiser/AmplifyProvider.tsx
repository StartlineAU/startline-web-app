"use client";

import { useEffect } from "react";
import { Amplify } from "aws-amplify";
import { amplifyConfig } from "@/lib/amplify-config";

const hasCognitoConfig = !!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

if (hasCognitoConfig) {
  Amplify.configure(amplifyConfig, { ssr: true });
}

const CURRENT_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";

function clearStaleCognitoCookies() {
  const currentPrefix = `CognitoIdentityServiceProvider.${CURRENT_CLIENT_ID}`;
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0].trim();
    if (name.startsWith("CognitoIdentityServiceProvider") && !name.startsWith(currentPrefix)) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
}

export default function AmplifyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    clearStaleCognitoCookies();
  }, []);

  return <>{children}</>;
}
