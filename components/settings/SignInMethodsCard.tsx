"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Link2 } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ErrorNote, SuccessNote, cardCls, inputCls, labelCls, outlineBtnCls,
} from "@/components/settings/primitives";
import { linkErrorMessage, type SignInMethods } from "@/lib/sign-in-methods";
import type { SocialProvider } from "@/lib/social-providers";

const primaryBtn = outlineBtnCls + " border-primary/30 text-primary hover:bg-primary/10";
const neutralBtn = outlineBtnCls + " border-dark-lighter text-muted hover:text-light";
const dangerBtn  = outlineBtnCls + " border-red-500/30 text-red-400 hover:bg-red-500/10";

type Message = { kind: "error" | "success"; text: string } | null;

// The password and a code from the authenticator app, sent only when the account
// has one (see requireStepUp in the sign-in-methods route).
type Proof = { password: string; code: string };

async function send(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await fetch("/api/user/sign-in-methods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, data: await response.json().catch(() => ({})) };
}

const errorOf = (data: Record<string, unknown>, fallback: string) =>
  typeof data.error === "string" ? data.error : fallback;

function flashFromQuery(query: URLSearchParams): Message {
  const linked = query.get("linked");
  const error = query.get("linkError");
  if (linked === "google" || linked === "apple") {
    return { kind: "success", text: `${linked === "google" ? "Google" : "Apple"} is now connected to your account.` };
  }
  if (error) return { kind: "error", text: linkErrorMessage(error) ?? "Something went wrong." };
  return null;
}

function ProofFields({
  id, password, code, onPassword, onCode, disabled,
}: {
  id: string;
  password: string;
  code: string;
  onPassword: (value: string) => void;
  onCode: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${id}-password`} className={labelCls}>Password</label>
        <input
          id={`${id}-password`}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          disabled={disabled}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`${id}-code`} className={labelCls}>Authenticator code</label>
        <input
          id={`${id}-code`}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => onCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={disabled}
          placeholder="000000"
          className={`${inputCls} tracking-[0.5em] text-center font-bold`}
        />
      </div>
    </div>
  );
}

export default function SignInMethodsCard({
  onChanged, refreshKey,
}: {
  onChanged?: () => void | Promise<void>;
  // Bumped by the settings page after a password is added, so this card
  // reloads hasPassword and enables disconnect.
  refreshKey?: number;
}) {
  const { user } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [methods, setMethods] = useState<SignInMethods | null>(null);
  const [loadingError, setLoadingError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // The callback lands back here with ?linked= or ?linkError=. Seed the notice
  // once, then strip the parameter so a refresh does not repeat it.
  const [message, setMessage] = useState<Message>(() =>
    flashFromQuery(new URLSearchParams(searchParams.toString())),
  );
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [confirming, setConfirming] = useState<SocialProvider | null>(null);
  const [connectingWith, setConnectingWith] = useState<SocialProvider | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [proofError, setProofError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("linked") && !params.has("linkError")) return;
    params.delete("linked");
    params.delete("linkError");
    const query = params.toString();
    router.replace(`${pathname ?? "/"}${query ? `?${query}` : ""}`, { scroll: false });
  }, [router, pathname]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/user/sign-in-methods")
      .then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setLoadingError(errorOf(data, "Could not load your sign-in methods."));
          return;
        }
        setMethods(data as SignInMethods);
      })
      .catch(() => {
        if (!cancelled) setLoadingError("Could not load your sign-in methods.");
      });

    return () => { cancelled = true; };
  }, [reloadKey, refreshKey]);

  const openProof = (mode: "connect" | "disconnect", provider: SocialProvider) => {
    setMessage(null);
    setPassword("");
    setCode("");
    setProofError("");
    if (mode === "connect") {
      setConnectingWith(provider);
      setConfirming(null);
    } else {
      setConfirming(provider);
      setConnectingWith(null);
    }
  };

  // With an authenticator app, the password and a code go with the request. A
  // refusal keeps the form open with the reason, rather than leaving the card.
  const connect = async (provider: SocialProvider, proof: Proof | null = null) => {
    setBusy(provider);
    setMessage(null);
    try {
      const { ok, data } = await send({
        action: "link",
        provider,
        returnTo: window.location.pathname,
        ...proof,
      });
      if (!ok || typeof data.url !== "string") {
        const text = errorOf(data, "Could not start connecting that account.");
        if (proof) {
          setProofError(text);
          setCode("");
        } else {
          setMessage({ kind: "error", text });
        }
        setBusy(null);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
      setBusy(null);
    }
  };

  const disconnect = async (provider: SocialProvider, proof: Proof | null = null) => {
    setBusy(provider);
    setMessage(null);
    try {
      const { ok, data } = await send({ action: "unlink", provider, ...proof });
      if (!ok) {
        const text = errorOf(data, "Could not disconnect that account.");
        if (proof) {
          setProofError(text);
          setCode("");
        } else {
          setMessage({ kind: "error", text });
        }
        return;
      }
      setMethods(data as SignInMethods);
      setConfirming(null);
      setPassword("");
      setCode("");
      setProofError("");
      setMessage({ kind: "success", text: `${provider === "google" ? "Google" : "Apple"} is no longer connected.` });
      await onChanged?.();
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  const shown = methods?.providers.filter((method) => method.linked || method.enabled) ?? [];

  return (
    <div className={cardCls}>
      <div className="flex items-start gap-3">
        <Link2 className="w-5 h-5 mt-0.5 shrink-0 text-muted-dark" />
        <div>
          <h4 className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Google and Apple</h4>
          <p className="text-muted text-[12px] mt-0.5 leading-relaxed">
            Manage the Google and Apple accounts that can sign in to Startline.
          </p>
          {methods?.mfaRequired && (
            <p className="text-muted-dark text-[11px] mt-1 leading-relaxed">
              Your account uses an authenticator app. Connecting or disconnecting Google or Apple needs
              your password and a code from the app. Once connected, signing in with them doesn&apos;t ask
              for that code.
            </p>
          )}
          {user?.email && <p className="text-muted-dark text-[11px] mt-1 break-all">{user.email}</p>}
        </div>
      </div>

      {!methods && !loadingError && <Skeleton className="h-20 w-full rounded-lg" />}

      {loadingError && (
        <div className="space-y-3">
          <ErrorNote>{loadingError}</ErrorNote>
          <button type="button" onClick={() => { setLoadingError(""); setReloadKey((key) => key + 1); }} className={neutralBtn}>
            Try again
          </button>
        </div>
      )}

      {methods && shown.length === 0 && (
        <p className="text-[12px] text-muted-dark leading-relaxed">
          Google and Apple sign-in are not available on this deployment.
        </p>
      )}

      {methods && shown.length > 0 && (
        <div className="divide-y divide-dark-lighter">
          {shown.map((method) => {
            const name = method.label;
            return (
              <div key={method.provider} className="py-3 first:pt-0 last:pb-0 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-light">{name}</div>
                    <p className="text-[12px] text-muted mt-1 leading-relaxed">
                      {method.linked
                        ? methods.hasPassword
                          ? "Connected. You can sign in with this account."
                          : `You sign in with ${name}. Your email address is managed by ${name}.`
                        : method.enabled
                          ? "Not connected."
                          : "Not available on this deployment."}
                    </p>
                    {method.linked && !methods.hasPassword && (
                      <p className="text-[11px] text-muted-dark mt-1 leading-relaxed">
                        This is your only way to sign in. Set a password before disconnecting it.
                        Your email is managed by {name}; change it there, then sign in again.
                      </p>
                    )}
                    {method.linked && methods.hasPassword && (
                      <p className="text-[11px] text-muted-dark mt-1 leading-relaxed">
                        You can also sign in with your password. To change your email here,
                        disconnect {name} first.
                      </p>
                    )}
                    {method.linked && methods.hasPassword && !method.canRemove && (
                      <p className="text-[11px] text-muted-dark mt-1 leading-relaxed">
                        This is your only way to sign in. Connect another before disconnecting it.
                      </p>
                    )}
                  </div>

                  {method.linked ? (
                    <button
                      type="button"
                      onClick={() => openProof("disconnect", method.provider)}
                      disabled={!method.canRemove || !methods.hasPassword || busy !== null}
                      className={dangerBtn + " shrink-0"}
                    >
                      Disconnect
                    </button>
                  ) : method.enabled ? (
                    <button
                      type="button"
                      onClick={() => (methods.mfaRequired ? openProof("connect", method.provider) : connect(method.provider))}
                      disabled={busy !== null}
                      className={primaryBtn + " shrink-0"}
                    >
                      {busy === method.provider ? "Connecting…" : "Connect"}
                    </button>
                  ) : null}
                </div>

                {connectingWith === method.provider && (
                  <form
                    onSubmit={(e) => { e.preventDefault(); connect(method.provider, { password, code }); }}
                    className="border-t border-dark-lighter pt-3 space-y-3"
                  >
                    <p className="text-[13px] text-muted leading-relaxed">
                      Confirm it&apos;s you, then connect {name}. After this, signing in with {name} won&apos;t ask for
                      your authenticator code.
                    </p>
                    <ProofFields
                      id={`connect-${method.provider}`}
                      password={password}
                      code={code}
                      onPassword={setPassword}
                      onCode={setCode}
                      disabled={busy !== null}
                    />
                    {proofError && <ErrorNote>{proofError}</ErrorNote>}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={busy !== null || !password || code.length !== 6}
                        className={primaryBtn}
                      >
                        {busy === method.provider ? "Connecting…" : `Connect ${name}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConnectingWith(null)}
                        disabled={busy !== null}
                        className={neutralBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {confirming === method.provider && (
                  <div className="border-t border-dark-lighter pt-3">
                    <p className="text-[13px] text-muted leading-relaxed">
                      Disconnect {name}? You will no longer be able to sign in with this account.
                    </p>
                    {methods.mfaRequired && (
                      <div className="mt-3 space-y-3">
                        <ProofFields
                          id={`disconnect-${method.provider}`}
                          password={password}
                          code={code}
                          onPassword={setPassword}
                          onCode={setCode}
                          disabled={busy !== null}
                        />
                        {proofError && <ErrorNote>{proofError}</ErrorNote>}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => disconnect(method.provider, methods.mfaRequired ? { password, code } : null)}
                        disabled={busy !== null || (methods.mfaRequired && (!password || code.length !== 6))}
                        className={dangerBtn}
                      >
                        {busy === method.provider ? "Disconnecting…" : "Yes, disconnect"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        disabled={busy !== null}
                        className={neutralBtn}
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {message && (message.kind === "error"
        ? <ErrorNote>{message.text}</ErrorNote>
        : <SuccessNote>{message.text}</SuccessNote>)}
    </div>
  );
}
