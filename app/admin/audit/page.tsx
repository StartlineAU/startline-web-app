"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import AdminNav from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  admin: { id: string; email: string; name: string | null };
}

const ACTION_COLORS: Record<string, string> = {
  APPROVE_EVENT:       "bg-lime-50 text-lime-700",
  REJECT_EVENT:        "bg-red-50 text-red-600",
  DELETE_EVENT:        "bg-red-50 text-red-600",
  PIN_EVENT:           "bg-blue-50 text-blue-600",
  UNPIN_EVENT:         "bg-gray-100 text-gray-500",
  BULK_APPROVE:        "bg-lime-50 text-lime-700",
  BULK_REJECT:         "bg-red-50 text-red-600",
  BULK_DELETE:         "bg-red-50 text-red-600",
  VERIFY_ORGANISER:    "bg-lime-50 text-lime-700",
  UNVERIFY_ORGANISER:  "bg-gray-100 text-gray-500",
  SUSPEND_ORGANISER:   "bg-red-50 text-red-600",
  ACTIVATE_ORGANISER:  "bg-lime-50 text-lime-700",
  BAN_USER:            "bg-red-50 text-red-600",
  UNBAN_USER:          "bg-lime-50 text-lime-700",
  REFUND_REGISTRATION: "bg-amber-50 text-amber-700",
};

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function metaSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const parts: string[] = [];
  if (typeof meta.title        === "string") parts.push(meta.title);
  if (typeof meta.reason       === "string" && meta.reason) parts.push(`Reason: ${meta.reason}`);
  if (typeof meta.count        === "number") parts.push(`${meta.count} event${meta.count !== 1 ? "s" : ""}`);
  if (typeof meta.athleteName  === "string") parts.push(meta.athleteName);
  if (typeof meta.amountCents  === "number") parts.push(`$${(meta.amountCents as number / 100).toFixed(2)}`);
  if (typeof meta.newStatus    === "string") parts.push(`→ ${meta.newStatus}`);
  return parts.join(" · ");
}

const ALL_ACTIONS = [
  "APPROVE_EVENT", "REJECT_EVENT", "DELETE_EVENT", "PIN_EVENT", "UNPIN_EVENT",
  "BULK_APPROVE", "BULK_REJECT", "BULK_DELETE",
  "VERIFY_ORGANISER", "UNVERIFY_ORGANISER", "SUSPEND_ORGANISER", "ACTIVATE_ORGANISER",
  "BAN_USER", "UNBAN_USER",
  "REFUND_REGISTRATION",
];

export default function AdminAuditPage() {
  const [logs,       setLogs]       = useState<AuditLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("");
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async (action: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (action) params.set("action", action);
      const res  = await fetch(`/api/admin/audit?${params}`);
      const data = await res.json() as { logs: AuditLog[]; total: number; totalPages: number };
      if (res.ok) {
        setLogs(data.logs);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(filter, page); }, [filter, page, fetchLogs]);

  const handleFilterChange = (action: string) => {
    setFilter(action);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-2">
                Admin portal
              </div>
              <h1 className="font-headline text-[44px] font-black italic tracking-tighter leading-none text-gray-900">
                Audit log.
              </h1>
            </div>
            <button
              onClick={() => fetchLogs(filter, page)}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Filter by action */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => handleFilterChange("")}
              className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors
                ${filter === "" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700"}`}
            >
              All
            </button>
            {ALL_ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => handleFilterChange(action)}
                className={`font-headline text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors
                  ${filter === action
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700"
                  }`}
              >
                {action.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            {loading && (
              <div className="p-12 text-center">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-gray-500 uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && logs.length === 0 && (
              <div className="p-12 text-center">
                <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <div className="font-headline text-lg font-black italic text-gray-900 mb-1">
                  No audit entries yet
                </div>
                <div className="text-gray-500 text-sm">
                  Admin actions will be recorded here automatically.
                </div>
              </div>
            )}

            {!loading && logs.map((log) => {
              const colorClass = ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600";
              const summary    = metaSummary(log.meta);
              return (
                <div key={log.id} className="border-b border-gray-100 last:border-0 px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 pt-0.5">
                      <span className={`inline-block font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${colorClass}`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-headline text-[12px] uppercase tracking-widest text-gray-500">
                        <span className="text-gray-700">{log.admin.name ?? log.admin.email}</span>
                        {" · "}<span className="capitalize">{log.targetType}</span>
                        {summary && <span className="text-gray-400"> · {summary}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 font-headline text-[11px] uppercase tracking-widest text-gray-400 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>

          {!loading && logs.length > 0 && (
            <div className="mt-4 flex items-center justify-between font-headline text-[12px] uppercase tracking-widest text-gray-400">
              <span>{total} entr{total !== 1 ? "ies" : "y"}</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded border border-gray-200 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-gray-500">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1 rounded border border-gray-200 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
