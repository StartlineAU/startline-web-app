"use client";

import { useState, useEffect, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import AmplifyProvider from "@/components/AmplifyProvider";
import { AuthProvider } from "@/context/AuthContext";
import SignInModal from "@/components/SignInModal";
import { readSignInRequest, PASSWORD_RESET_NOTICE } from "@/lib/password-reset-return";

// The organiser portal had no sign-in of its own: the modal is mounted in the
// athlete NavBar and in the organiser layout, neither of which covers this page,
// so a returning organiser on organiser.startlineau.com could only bounce
// between the landing page and a redirect (issue #302). This page sits outside
// both layouts, so it brings its own Amplify and auth providers.
function Actions({ setupHref }: { setupHref: string }) {
  const router = useRouter();
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInNotice, setSignInNotice] = useState<string | undefined>(undefined);

  // The organiser forgot-password page returns here with ?signin=true once the
  // new password is set, so the organiser can sign in straight away (#508).
  // The params are stripped so a refresh after closing does not reopen it.
  useEffect(() => {
    const request = readSignInRequest(window.location.search);
    if (!request) return;
    startTransition(() => {
      setSignInEmail(request.email);
      setSignInNotice(request.afterReset ? PASSWORD_RESET_NOTICE : undefined);
      setSignInOpen(true);
    });
    router.replace(window.location.pathname, { scroll: false });
  }, [router]);

  return (
    <>
      <Link
        href={setupHref}
        className="bg-machined shadow-machined inline-flex items-center gap-2 text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 px-8 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
      >
        Get started <ArrowRight className="w-4 h-4" />
      </Link>
      <p className="mt-6 font-headline text-[11px] uppercase tracking-widest text-muted">
        Already have an organiser profile?{" "}
        <button
          type="button"
          onClick={() => {
            setSignInEmail("");
            setSignInNotice(undefined);
            setSignInOpen(true);
          }}
          className="text-primary hover:underline uppercase tracking-widest"
        >
          Sign in
        </button>
      </p>
      <SignInModal
        isOpen={signInOpen}
        onClose={() => setSignInOpen(false)}
        initialEmail={signInEmail}
        notice={signInNotice}
        // Re-render the server component rather than pushing a route: it already
        // redirects to the dashboard when the new session resolves to an
        // organiser, and keeps someone without one here on the sign-up path.
        onSuccess={() => router.refresh()}
      />
    </>
  );
}

export default function OrganiserLandingActions({ setupHref }: { setupHref: string }) {
  return (
    <AmplifyProvider>
      <AuthProvider>
        <Actions setupHref={setupHref} />
      </AuthProvider>
    </AmplifyProvider>
  );
}
