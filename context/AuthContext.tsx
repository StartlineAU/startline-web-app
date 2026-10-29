"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, startTransition } from "react";
import { fetchAuthSession, getCurrentUser, signOut } from "aws-amplify/auth";

export type Role = "user" | "organiser" | "admin";

export type OrgMembership = {
  organiserId:   string;
  organiserName: string | null;
  role:          string;
  logoUrl:       string | null;
};

export type AuthUser = {
  sub:   string;
  email: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user:         AuthUser | null;
  role:         Role | null;
  hasOrganiser: boolean;
  organiserCount: number;
  memberships:  OrgMembership[];
  status:       AuthStatus;
  loading:      boolean;
  refresh:      () => Promise<void>;
  logout:       () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user:         null,
  role:         null,
  hasOrganiser: false,
  organiserCount: 0,
  memberships:  [],
  status:       "loading",
  loading:      true,
  refresh:      async () => {},
  logout:       async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,         setUser]         = useState<AuthUser | null>(null);
  const [role,         setRole]         = useState<Role | null>(null);
  const [hasOrganiser, setHasOrganiser] = useState(false);
  const [organiserCount, setOrganiserCount] = useState(0);
  const [memberships,  setMemberships]  = useState<OrgMembership[]>([]);
  const [status,       setStatus]       = useState<AuthStatus>("loading");

  const userRef = useRef<AuthUser | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const hydrate = useCallback(async () => {
    if (process.env.NODE_ENV === "development" && typeof document !== "undefined" && document.cookie.includes("__e2e_bypass")) {
      // The cookie's value names the identity, so changing it is an account
      // switch, which is what lets e2e cover one.
      const identity = document.cookie.match(/(?:^|;\s*)__e2e_bypass=([^;]*)/)?.[1] ?? "";
      const sub = `dev-bypass-${identity}`;
      setUser(prev => (prev?.sub === sub ? prev : { sub, email: "bypass@startline.test" }));
      setStatus("authenticated");
      return;
    }

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

      // Same account: keep the object, so a re-check on focus re-renders nothing.
      setUser(prev =>
        prev?.sub === current.userId && prev.email === email
          ? prev
          : { sub: current.userId, email },
      );
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    startTransition(() => hydrate());
  }, [hydrate]);

  // Every tab shares one set of Cognito cookies, so signing in or out in one
  // tab changes the account under all the others. Re-read it when a tab comes
  // back into view, or it keeps showing the account it loaded with while every
  // request it makes goes out as the new one.
  useEffect(() => {
    const recheck = async () => {
      if (document.visibilityState !== "visible") return;
      if (process.env.NODE_ENV === "development" && document.cookie.includes("__e2e_bypass")) {
        startTransition(() => hydrate());
        return;
      }
      try {
        const session = await fetchAuthSession();
        if (!session.tokens?.accessToken) {
          startTransition(() => {
            setUser(null);
            setStatus("unauthenticated");
          });
          return;
        }
        const { userId } = await getCurrentUser();
        if (userId !== userRef.current?.sub) startTransition(() => hydrate());
      } catch {
        // A failed check (offline, a refresh mid-flight) says nothing about
        // which account this is, so it signs nobody out.
      }
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [hydrate]);

  // Role and memberships belong to the account, so refetch them whenever it
  // changes, not only when status does: a switch from one account to another
  // stays "authenticated" throughout and would keep the previous one's role,
  // which is how an athlete ended up with the admin's menu.
  const sub = user?.sub ?? null;
  useEffect(() => {
    startTransition(() => {
      setRole(null);
      setHasOrganiser(false);
      setOrganiserCount(0);
      setMemberships([]);
    });
    if (status !== "authenticated" || !sub) return;
    let cancelled = false;
    fetch("/api/user/role")
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data?.role) {
          setRole(data.role);
          setHasOrganiser(Boolean(data.hasOrganiser));
          setOrganiserCount(data.organiserCount ?? 0);
          setMemberships(Array.isArray(data.memberships) ? data.memberships : []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status, sub]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setStatus("unauthenticated");
    setRole(null);
    setHasOrganiser(false);
    setOrganiserCount(0);
    setMemberships([]);
  }, []);

  return (
      <AuthContext.Provider
        value={{
          user,
          role,
          hasOrganiser,
          organiserCount,
          memberships,
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
