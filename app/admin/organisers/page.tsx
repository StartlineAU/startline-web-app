"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, CalendarDays, Star, Users as UsersIcon } from "lucide-react";
import AdminNav from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface OrganiserRow {
  id: string;
  orgName: string | null;
  contactName: string | null;
  email: string;
  phone: string | null;
  abn: string | null;
  status: string;
  stripeOnboardingComplete: boolean;
  insuranceDeclared: boolean;
  createdAt: string;
  eventCount: number;
  liveEventCount: number;
  reviewCount: number;
  registrationCount: number;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function OrganiserCard({ o }: { o: OrganiserRow }) {
  const name = o.orgName || o.contactName || o.email;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="border-b border-gray-100 last:border-0 px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-gray-900 text-white font-headline font-black italic flex items-center justify-center shrink-0">
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
            <span className="font-headline text-[15px] font-black italic tracking-tighter text-gray-900 truncate">
              {name}
            </span>
            {o.status === "SUSPENDED" ? (
              <Badge className="gap-1.5 bg-red-50 text-red-600 border-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Suspended
              </Badge>
            ) : (
              <Badge className="gap-1.5 bg-lime-50 text-lime-700 border-0">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-500" /> Active
              </Badge>
            )}
            {o.stripeOnboardingComplete ? (
              <span className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-lime-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Stripe ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-amber-600">
                <AlertCircle className="w-3.5 h-3.5" /> Stripe pending
              </span>
            )}
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-gray-400 mb-2">
            {o.email}
            {o.abn && <span className="text-gray-300"> · ABN {o.abn}</span>}
            <span className="text-gray-300"> · Joined {formatDate(o.createdAt)}</span>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 font-headline text-[11px] uppercase tracking-widest text-gray-500">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
              {o.eventCount} event{o.eventCount !== 1 ? "s" : ""}
              {o.liveEventCount > 0 && (
                <span className="text-lime-600">({o.liveEventCount} live)</span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <UsersIcon className="w-3.5 h-3.5 text-gray-400" />
              {o.registrationCount} registration{o.registrationCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-gray-400" />
              {o.reviewCount} review{o.reviewCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrganisersPage() {
  const [organisers, setOrganisers] = useState<OrganiserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrganisers = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/organisers");
      const data = await res.json();
      setOrganisers(res.ok && Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrganisers(); }, [fetchOrganisers]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="pt-16">
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-2">
                Admin portal
              </div>
              <h1 className="font-headline text-[44px] font-black italic tracking-tighter leading-none text-gray-900">
                Organisers.
              </h1>
            </div>
            <button
              onClick={fetchOrganisers}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* List */}
          <Card className="overflow-hidden">
            {loading && (
              <div className="p-12 text-center">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-gray-500 uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && organisers.length === 0 && (
              <div className="p-12 text-center">
                <div className="font-headline text-lg font-black italic text-gray-900 mb-1">No organisers yet</div>
                <div className="text-gray-500 text-sm">Organiser accounts will appear here once they sign up.</div>
              </div>
            )}

            {!loading && organisers.map((o) => <OrganiserCard key={o.id} o={o} />)}
          </Card>

          {!loading && organisers.length > 0 && (
            <div className="mt-4 font-headline text-[12px] uppercase tracking-widest text-gray-400 text-right">
              {organisers.length} organiser{organisers.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
