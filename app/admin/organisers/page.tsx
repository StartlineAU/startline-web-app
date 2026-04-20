"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CheckCircle, XCircle, Clock, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

type OrgStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED" | "all";

interface Organiser {
  id: string; email: string; status: string; orgName: string | null; contactName: string | null;
  phone: string | null; abn: string | null; website: string | null; bio: string | null;
  logoUrl: string | null; insuranceUrl: string | null; pastEventsUrl: string | null;
  certifications: string | null; createdAt: string; _count: { events: number };
}

function AdminOrganisersInner() {
  const searchParams = useSearchParams();
  const [organisers, setOrganisers]   = useState<Organiser[]>([]);
  const [loading,    setLoading]      = useState(true);
  const [expanded,   setExpanded]     = useState<string | null>(null);
  const [notes,      setNotes]        = useState<Record<string, string>>({});
  const [reason,     setReason]       = useState<Record<string, string>>({});
  const [acting,     setActing]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrgStatus>(
    (searchParams.get("s") as OrgStatus) ?? "PENDING_REVIEW"
  );

  const FILTERS: { k: OrgStatus; l: string }[] = [
    { k: "PENDING_REVIEW", l: "Pending" },
    { k: "APPROVED",       l: "Approved" },
    { k: "REJECTED",       l: "Rejected" },
    { k: "all",            l: "All" },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/admin/organisers?status=${statusFilter}`);
    const data = await res.json();
    setOrganisers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    await fetch(`/api/admin/organisers/${id}/${action}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ notes: notes[id], reason: reason[id] }),
    });
    setActing(null);
    load();
  };

  return (
    <div className="min-h-screen bg-dark-darker">
      <div className="p-6 lg:p-10 max-w-[1000px] mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/dashboard" className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <span className="text-muted-dark">/</span>
          <span className="font-headline text-[11px] uppercase tracking-widest text-light">Organisers</span>
        </div>

        <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-6">
          Organiser<br /><span className="text-primary">applications.</span>
        </h1>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {FILTERS.map(({ k, l }) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md chip ${statusFilter === k ? "chip-active" : ""}`}>
              {l}
            </button>
          ))}
        </div>

        {loading && <div className="text-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>}

        {!loading && organisers.length === 0 && (
          <div className="text-center py-16">
            <Clock className="w-8 h-8 text-muted mx-auto mb-3" />
            <div className="font-headline text-lg font-black italic text-light mb-1">All clear</div>
            <div className="text-muted text-sm">No {statusFilter === "all" ? "" : statusFilter.toLowerCase().replace("_", " ")} applications.</div>
          </div>
        )}

        <div className="space-y-3">
          {organisers.map((org) => (
            <div key={org.id} className="bg-dark border border-dark-lighter rounded-lg overflow-hidden">
              {/* Summary row */}
              <button onClick={() => setExpanded(expanded === org.id ? null : org.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-dark-light/30 transition-colors text-left">
                <div className="w-10 h-10 rounded-full bg-dark-light border border-dark-lighter flex items-center justify-center font-headline font-black italic text-primary text-lg flex-shrink-0">
                  {(org.orgName ?? org.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-headline text-[15px] font-black italic tracking-tighter text-light truncate">{org.orgName ?? "(profile incomplete)"}</div>
                  <div className="font-headline text-[11px] uppercase tracking-widest text-muted">{org.email} · Applied {new Date(org.createdAt).toLocaleDateString("en-AU")}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={org.status} />
                  {expanded === org.id ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === org.id && (
                <div className="border-t border-dark-lighter p-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-[13px]">
                    {[
                      { l: "Contact",  v: org.contactName },
                      { l: "Phone",    v: org.phone },
                      { l: "ABN",      v: org.abn },
                      { l: "Website",  v: org.website, link: true },
                    ].map(({ l, v, link }) => v && (
                      <div key={l}>
                        <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-0.5">{l}</div>
                        {link ? <a href={v} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-1 truncate">{v} <ExternalLink className="w-3 h-3 flex-shrink-0" /></a>
                               : <div className="text-light">{v}</div>}
                      </div>
                    ))}
                  </div>

                  {org.bio && (
                    <div>
                      <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-1">About</div>
                      <p className="text-muted-light text-[13px] leading-relaxed">{org.bio}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { l: "Insurance document", v: org.insuranceUrl },
                      { l: "Past events evidence", v: org.pastEventsUrl },
                    ].map(({ l, v }) => (
                      <div key={l} className="bg-dark-light rounded-md p-3">
                        <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">{l}</div>
                        {v ? (
                          <a href={v} target="_blank" rel="noopener"
                            className="font-headline text-[12px] uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                            Open document <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="font-headline text-[11px] uppercase tracking-widest text-red-400">Not provided</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {org.certifications && (
                    <div>
                      <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-1">Certifications</div>
                      <p className="text-muted-light text-[13px]">{org.certifications}</p>
                    </div>
                  )}

                  {org.status === "PENDING_REVIEW" && (
                    <div className="border-t border-dark-lighter pt-4 space-y-3">
                      <div>
                        <label className="font-headline text-[10px] uppercase tracking-widest text-muted block mb-1.5">Internal notes (optional)</label>
                        <textarea rows={2} value={notes[org.id] ?? ""} onChange={(e) => setNotes({ ...notes, [org.id]: e.target.value })}
                          placeholder="Notes visible to admins only…"
                          className="w-full bg-dark-light border border-dark-lighter rounded-md px-3 py-2 text-[13px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none resize-none" />
                      </div>
                      <div>
                        <label className="font-headline text-[10px] uppercase tracking-widest text-muted block mb-1.5">Rejection reason (shown to organiser if rejected)</label>
                        <textarea rows={2} value={reason[org.id] ?? ""} onChange={(e) => setReason({ ...reason, [org.id]: e.target.value })}
                          placeholder="e.g. Insurance document not accessible or expired."
                          className="w-full bg-dark-light border border-dark-lighter rounded-md px-3 py-2 text-[13px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none resize-none" />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => act(org.id, "approve")} disabled={acting === org.id}
                          className="bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform disabled:opacity-50">
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button onClick={() => act(org.id, "reject")} disabled={acting === org.id}
                          className="bg-dark border border-red-500/40 hover:border-red-500 text-red-400 hover:text-red-300 font-headline text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md flex items-center gap-2 transition-colors disabled:opacity-50">
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING_REVIEW:  "bg-blue-900/30 text-blue-400",
    APPROVED:        "bg-primary/10 text-primary",
    REJECTED:        "bg-red-900/30 text-red-400",
    SUSPENDED:       "bg-dark-lighter text-muted",
    PENDING_EMAIL:   "bg-dark-lighter text-muted",
    PENDING_PROFILE: "bg-dark-lighter text-muted",
  };
  const label: Record<string, string> = {
    PENDING_REVIEW:  "Pending",
    APPROVED:        "Approved",
    REJECTED:        "Rejected",
    SUSPENDED:       "Suspended",
    PENDING_EMAIL:   "Unverified",
    PENDING_PROFILE: "Incomplete",
  };
  return (
    <span className={`font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${map[status] ?? "bg-dark-lighter text-muted"}`}>
      {label[status] ?? status}
    </span>
  );
}

export default function AdminOrganisersPage() {
  return <Suspense><AdminOrganisersInner /></Suspense>;
}
