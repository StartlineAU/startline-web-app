"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, ChevronRight, CircleAlert } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { organiserHref } from "@/lib/portal-domains";
import { usePortalHost } from "@/lib/use-portal-host";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote, SectionShell } from "@/components/settings/primitives";

// Payments and Members each have a full page in the organiser portal. These
// sections say where things stand and link there, so the settings menu does
// not grow a second copy of either.

const linkCls = "inline-flex items-center gap-2 border border-primary/40 bg-primary/10 text-primary font-headline text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md hover:bg-primary/20 transition-colors";

function useActiveOrganisation<T>(url: string): { data: T | null; failed: boolean } {
  const [data,   setData]   = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) { if (d) setData(d); else setFailed(true); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);
  return { data, failed };
}

// ── Payments ────────────────────────────────────────────────────────────────

type PaymentsProfile = {
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  abn: string | null;
  legalName: string | null;
};

function StatusRow({ label, done, doneText, todoText }: { label: string; done: boolean; doneText: string; todoText: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-dark-lighter last:border-0">
      {done
        ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden />
        : <CircleAlert className="w-4 h-4 mt-0.5 shrink-0 text-muted-dark" aria-hidden />}
      <div>
        <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted-light">{label}</div>
        <div className={`text-[12px] mt-0.5 ${done ? "text-muted" : "text-muted-light"}`}>{done ? doneText : todoText}</div>
      </div>
    </div>
  );
}

export function PaymentsSection() {
  const { close } = useSettings();
  const host = usePortalHost();
  const { data, failed } = useActiveOrganisation<PaymentsProfile>("/api/organiser/profile");

  return (
    <SectionShell
      title="Payments"
      description="Payouts run through your organisation's Stripe account. Paid events cannot go live until everything here is in place."
    >
      {failed && <ErrorNote>Your payment details could not be loaded.</ErrorNote>}
      {!data && !failed && (
        <div className="space-y-3" role="status" aria-label="Loading payment details">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      )}
      {data && (
        <div>
          <StatusRow label="Stripe payouts" done={data.stripeOnboardingComplete}
            doneText="Connected. Entry fees are paid out to your bank account."
            todoText={data.stripeAccountId ? "Started but not finished. Complete Stripe's setup to receive payouts." : "Not set up yet."} />
          <StatusRow label="ABN or ACN" done={Boolean(data.abn?.trim())}
            doneText="On file." todoText="Missing. Needed before a paid event can be approved." />
          <StatusRow label="Legal name" done={Boolean(data.legalName?.trim())}
            doneText="On file." todoText="Missing." />
        </div>
      )}
      <Link href={organiserHref("/organiser/payments", host)} onClick={close} className={`${linkCls} mt-6`}>
        Manage payments <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </SectionShell>
  );
}

// ── Members ─────────────────────────────────────────────────────────────────

type MembersResponse = {
  members: { id: string; role: string; user: { name: string | null; email: string } }[];
  currentMemberId: string | null;
};

export function MembersSection() {
  const { close } = useSettings();
  const host = usePortalHost();
  const { data, failed } = useActiveOrganisation<MembersResponse>("/api/organiser/members");

  return (
    <SectionShell
      title="Members"
      description="Who can manage this organisation. Owners control members, payments and notifications; managers run events."
    >
      {failed && <ErrorNote>The member list could not be loaded.</ErrorNote>}
      {!data && !failed && (
        <div className="space-y-3" role="status" aria-label="Loading members">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      )}
      {data && (
        <ul>
          {data.members.map(m => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-3 border-b border-dark-lighter last:border-0">
              <div className="min-w-0">
                <div className="text-[13px] text-light truncate">
                  {m.user.name || m.user.email}{m.id === data.currentMemberId && <span className="text-muted-dark"> (you)</span>}
                </div>
                {m.user.name && <div className="text-[11px] text-muted-dark truncate">{m.user.email}</div>}
              </div>
              <span className={`shrink-0 font-headline text-[9px] uppercase tracking-widest rounded px-1.5 py-0.5 border
                ${m.role === "OWNER" ? "text-primary border-primary/40" : "text-white/40 border-white/15"}`}>
                {m.role === "OWNER" ? "Owner" : "Manager"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href={organiserHref("/organiser/members", host)} onClick={close} className={`${linkCls} mt-6`}>
        Manage members <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </SectionShell>
  );
}
