"use client";

import { useAuthContext } from "@/context/AuthContext";

/**
 * Returns the current auth state from AuthContext.
 * Must be used inside <AuthProvider>.
 */
export function useAuth() {
  return useAuthContext();
}
