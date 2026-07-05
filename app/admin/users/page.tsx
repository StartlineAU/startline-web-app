"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Ban, CheckCircle2, Building2, UserX } from "lucide-react";
import AdminNav from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  isPublic: boolean;
  isBanned: boolean;
  city: string | null;
  state: string | null;
  createdAt: string;
  organiser: { id: string; orgName: string | null; status: string } | null;
  _count: { registrations: number };
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

function UserRow({
  user,
  onBanToggled,
}: {
  user: UserRow;
  onBanToggled: (id: string, isBanned: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  const displayName = user.name || user.username || user.email;
  const initial     = displayName.charAt(0).toUpperCase();

  const handleToggleBan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/ban`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json() as { isBanned: boolean };
        onBanToggled(user.id, data.isBanned);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-b border-gray-100 last:border-0 px-5 py-4">
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-lg font-headline font-black italic flex items-center justify-center shrink-0 text-sm
          ${user.isBanned ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-700"}`}>
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
            <span className="font-headline text-[15px] font-black italic tracking-tighter text-gray-900 truncate">
              {displayName}
            </span>

            {user.isBanned && (
              <Badge className="gap-1.5 bg-red-50 text-red-600 border-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Banned
              </Badge>
            )}

            {user.organiser && (
              <span className={`inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest
                ${user.organiser.status === "SUSPENDED" ? "text-red-500" : "text-lime-600"}`}>
                <Building2 className="w-3.5 h-3.5" />
                {user.organiser.orgName ?? "Organiser"}
                {user.organiser.status === "SUSPENDED" && " (suspended)"}
              </span>
            )}
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-gray-400 mb-1">
            {user.email}
            {user.username && <span className="text-gray-300"> · @{user.username}</span>}
            {(user.city || user.state) && (
              <span className="text-gray-300">
                {" · "}{[user.city, user.state?.toUpperCase()].filter(Boolean).join(", ")}
              </span>
            )}
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-gray-500">
            {user._count.registrations} registration{user._count.registrations !== 1 ? "s" : ""}
            <span className="text-gray-300"> · Joined {formatDate(user.createdAt)}</span>
            {!user.isPublic && <span className="text-gray-300"> · Private profile</span>}
          </div>
        </div>

        <div className="shrink-0 ml-auto pl-2">
          <button
            onClick={handleToggleBan}
            disabled={loading}
            className={`flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest px-3 py-2 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              ${user.isBanned
                ? "border border-lime-300 text-lime-700 hover:bg-lime-50"
                : "border border-red-200 text-red-600 hover:bg-red-50"
              }`}
          >
            {loading
              ? <span className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
              : user.isBanned
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> Unban</>
                : <><Ban className="w-3.5 h-3.5" /> Ban</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users,      setUsers]      = useState<UserRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [query,      setQuery]      = useState("");
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (q) params.set("search", q);
      const res  = await fetch(`/api/admin/users?${params}`);
      const data = await res.json() as { users: UserRow[]; total: number; totalPages: number };
      if (res.ok) {
        setUsers(data.users);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(query, page); }, [query, page, fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  };

  const handleBanToggled = (id: string, isBanned: boolean) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, isBanned } : u));
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
                Users.
              </h1>
            </div>
            <button
              onClick={() => fetchUsers(query, page)}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or username…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-[14px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 placeholder:text-gray-400"
              />
            </div>
            <button
              type="submit"
              className="font-headline text-[12px] font-bold uppercase tracking-widest bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Search
            </button>
            {query && (
              <button
                type="button"
                onClick={() => { setSearch(""); setQuery(""); setPage(1); }}
                className="font-headline text-[12px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 px-3 py-2.5 transition-colors"
              >
                Clear
              </button>
            )}
          </form>

          <Card className="overflow-hidden">
            {loading && (
              <div className="p-12 text-center">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-gray-500 uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && users.length === 0 && (
              <div className="p-12 text-center">
                <UserX className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <div className="font-headline text-lg font-black italic text-gray-900 mb-1">
                  {query ? "No users found" : "No users yet"}
                </div>
                <div className="text-gray-500 text-sm">
                  {query ? `No users match "${query}".` : "User accounts will appear here once they sign up."}
                </div>
              </div>
            )}

            {!loading && users.map((u) => (
              <UserRow key={u.id} user={u} onBanToggled={handleBanToggled} />
            ))}
          </Card>

          {!loading && users.length > 0 && (
            <div className="mt-4 flex items-center justify-between font-headline text-[12px] uppercase tracking-widest text-gray-400">
              <span>{total} user{total !== 1 ? "s" : ""}</span>
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
