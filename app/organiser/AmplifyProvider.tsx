"use client";

import { Amplify } from "aws-amplify";
import { amplifyConfig } from "@/lib/amplify-config";

/**
 * Configures Amplify once on the client with ssr:true so tokens are stored
 * in cookies (not localStorage), making them readable server-side.
 * This component renders no UI — it is purely a configuration side-effect.
 */
Amplify.configure(amplifyConfig, { ssr: true });

export default function AmplifyProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
