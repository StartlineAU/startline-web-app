"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import SignInModal from "@/components/SignInModal";
import { useAuthContext } from "@/context/AuthContext";

type InviteView = {
  organisationName: string;
  email: string;
  state: "pending" | "accepted" | "expired";
  signedIn: boolean;
  signedInAsInvitee: boolean;
};

const btnPrimary =
  "bg-machined shadow-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 rounded-md disabled:opacity-50";

// The page an organiser invitation email links to. Nothing changes until the
// invitee, signed in with the invited address, presses Accept.
function InviteContent() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const { status } = useAuthContext();

  const [invite, setInvite] = useState<InviteView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setError("This invitation link is not valid."); return; }
    try {
      const res = await fetch(`/api/organiser/invites?token=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "This invitation link is not valid."); return; }
      setError("");
      setInvite(data as InviteView);
    } catch {
      setError("Could not load this invitation. Please try again.");
    }
  }, [token]);

  // Load again when sign-in state settles, so "signed in as" is current.
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
  }, [status, load]);

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/organiser/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not accept this invitation."); return; }
      // Make the new organisation the active one, then open its dashboard.
      await fetch("/api/organiser/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organiserId: data.organiserId }),
      }).catch(() => {});
      router.push("/organiser/dashboard");
    } catch {
      setError("Could not accept this invitation. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-[520px] mx-auto px-4 py-16">
      <div className="bg-dark border border-dark-lighter rounded-[14px] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <MailCheck className="w-5 h-5 text-primary" />
          <h1 className="font-headline text-[15px] font-bold uppercase tracking-widest text-light">Organiser invitation</h1>
        </div>

        {!invite && !error && <p className="text-[14px] text-muted">Loading…</p>}

        {invite && (
          <>
            <p className="text-[14px] text-light leading-relaxed">
              <span className="font-bold">{invite.organisationName}</span> has invited{" "}
              <span className="font-bold">{invite.email}</span> to manage their events on Startline.
            </p>

            {invite.state === "accepted" && (
              <p className="text-[14px] text-muted">This invitation has already been accepted.</p>
            )}
            {invite.state === "expired" && (
              <p className="text-[14px] text-muted">This invitation has expired. Ask the organisation to send a new one.</p>
            )}

            {invite.state === "pending" && !invite.signedIn && (
              <>
                <p className="text-[14px] text-muted">Sign in with {invite.email} to accept.</p>
                <button type="button" className={btnPrimary} onClick={() => setSignInOpen(true)}>Sign in</button>
              </>
            )}

            {invite.state === "pending" && invite.signedIn && !invite.signedInAsInvitee && (
              <p className="text-[14px] text-muted">
                You are signed in with a different account. Sign out, then sign in with {invite.email} to accept.
              </p>
            )}

            {invite.state === "pending" && invite.signedInAsInvitee && (
              <button type="button" className={btnPrimary} onClick={accept} disabled={busy}>
                {busy ? "Accepting…" : "Accept invitation"}
              </button>
            )}
          </>
        )}

        {error && <p role="alert" className="text-[13px] text-red-300">{error}</p>}
      </div>

      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} onSuccess={() => { setSignInOpen(false); void load(); }} />
    </main>
  );
}

export default function OrganiserInvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteContent />
    </Suspense>
  );
}
