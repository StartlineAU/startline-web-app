"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchAuthSession, getCurrentUser, signOut } from "aws-amplify/auth";

export type AuthUser = {
  sub:   string;
  email: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user:    AuthUser | null;
  status:  AuthStatus;
  loading: boolean;
  refresh: () => Promise<void>;
  logout:  () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user:    null,
  status:  "loading",
  loading: true,
  refresh: async () => {},
  logout:  async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,   setUser]   = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const hydrate = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      if (!session.tokens?.accessToken) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }

      const current = await getCurrentUser();
      const idPayload = session.tokens.idToken?.payload;
      const loginId = current.signInDetails?.loginId ?? "";
      const email =
        (typeof idPayload?.email === "string" && idPayload.email.includes("@")
          ? idPayload.email
          : loginId.includes("@")
            ? loginId
            : "");

      setUser({
        sub:   current.userId,
        email,
      });
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        loading: status === "loading",
        refresh: hydrate,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
