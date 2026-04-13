"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";

  useEffect(() => {
    const params = new URLSearchParams();
    if (returnTo !== "/") params.set("returnTo", returnTo);
    const qs = params.toString();
    window.location.href = `/auth/login${qs ? `?${qs}` : ""}`;
  }, [returnTo]);

  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center">
      <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted animate-pulse">
        Redirecting to sign in...
      </p>
    </main>
  );
}
