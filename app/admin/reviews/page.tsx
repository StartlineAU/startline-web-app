"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Star, Eye, EyeOff, BadgeCheck, Trash2, RefreshCw } from "lucide-react";
import AdminNav from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Filter = "all" | "published" | "hidden";

interface ReviewRow {
  id: string;
  overallRating: number;
  communicationRating: number | null;
  organisationRating: number | null;
  experienceRating: number | null;
  title: string;
  body: string;
  reviewerName: string;
  eventTitle: string | null;
  isVerified: boolean;
  isPublished: boolean;
  createdAt: string;
  organiser: { id: string; orgName: string | null; email: string };
}

const TABS: { filter: Filter; label: string }[] = [
  { filter: "all",       label: "All"       },
  { filter: "published", label: "Published" },
  { filter: "hidden",    label: "Hidden"    },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  onChanged,
  onDeleted,
}: {
  review: ReviewRow;
  onChanged: (r: ReviewRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const organiserName = review.organiser.orgName || review.organiser.email;

  const patch = async (data: { isPublished?: boolean; isVerified?: boolean }) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json() as { isPublished: boolean; isVerified: boolean };
        onChanged({ ...review, ...updated });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this review permanently? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(review.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`border-b border-gray-100 last:border-0 px-5 py-4 ${!review.isPublished ? "bg-gray-50/60" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
            <Stars value={review.overallRating} />
            <span className="font-headline text-[15px] font-black italic tracking-tighter text-gray-900">
              {review.title}
            </span>
            {review.isVerified && (
              <span className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-lime-600">
                <BadgeCheck className="w-3.5 h-3.5" /> Verified
              </span>
            )}
            {!review.isPublished && (
              <span className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <EyeOff className="w-3.5 h-3.5" /> Hidden
              </span>
            )}
          </div>

          <p className="text-[14px] text-gray-700 leading-relaxed mb-2">{review.body}</p>

          <div className="font-headline text-[11px] uppercase tracking-widest text-gray-400">
            {review.reviewerName}
            {review.eventTitle && <span className="text-gray-300"> · {review.eventTitle}</span>}
            <span className="text-gray-300"> · for {organiserName}</span>
            <span className="text-gray-300"> · {formatDate(review.createdAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => patch({ isPublished: !review.isPublished })}
            disabled={busy}
            title={review.isPublished ? "Hide review" : "Publish review"}
            className="flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest border border-gray-200 text-gray-600 px-2.5 py-2 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            {review.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {review.isPublished ? "Hide" : "Publish"}
          </button>
          <button
            onClick={() => patch({ isVerified: !review.isVerified })}
            disabled={busy}
            title={review.isVerified ? "Remove verification" : "Mark verified"}
            className={`flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest border px-2.5 py-2 rounded-md transition-colors disabled:opacity-40
              ${review.isVerified
                ? "border-lime-300 text-lime-700 hover:bg-lime-50"
                : "border-gray-200 text-gray-600 hover:bg-gray-100"}`}
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            {review.isVerified ? "Verified" : "Verify"}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            title="Delete review"
            className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminReviewsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const filterParam  = (searchParams.get("filter") ?? "all").toLowerCase() as Filter;
  const activeFilter = TABS.find((t) => t.filter === filterParam)?.filter ?? "all";

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async (filter: Filter) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/reviews?filter=${filter}`);
      const data = await res.json();
      setReviews(res.ok && Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(activeFilter); }, [activeFilter, fetchReviews]);

  const switchFilter = (filter: Filter) => {
    router.push(`/admin/reviews?filter=${filter}`, { scroll: false });
  };

  const handleChanged = (updated: ReviewRow) => {
    setReviews((prev) =>
      activeFilter === "all"
        ? prev.map((r) => (r.id === updated.id ? updated : r))
        : prev.filter((r) =>
            activeFilter === "published" ? updated.isPublished : !updated.isPublished,
          ),
    );
  };

  const handleDeleted = (id: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-2">
                Admin portal
              </div>
              <h1 className="font-headline text-[44px] font-black italic tracking-tighter leading-none text-gray-900">
                Reviews.
              </h1>
            </div>
            <button
              onClick={() => fetchReviews(activeFilter)}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            {TABS.map(({ filter, label }) => (
              <button
                key={filter}
                onClick={() => switchFilter(filter)}
                className={`font-headline text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 border-b-2 transition-colors -mb-px
                  ${activeFilter === filter
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          <Card className="overflow-hidden">
            {loading && (
              <div className="p-12 text-center">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-gray-500 uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && reviews.length === 0 && (
              <div className="p-12 text-center">
                <div className="font-headline text-lg font-black italic text-gray-900 mb-1">No reviews</div>
                <div className="text-gray-500 text-sm">
                  {activeFilter === "all" ? "No reviews have been submitted yet." : `No ${activeFilter} reviews.`}
                </div>
              </div>
            )}

            {!loading && reviews.map((r) => (
              <ReviewCard key={r.id} review={r} onChanged={handleChanged} onDeleted={handleDeleted} />
            ))}
          </Card>

          {!loading && reviews.length > 0 && (
            <div className="mt-4 font-headline text-[12px] uppercase tracking-widest text-gray-400 text-right">
              {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminReviewsPage() {
  return (
    <Suspense>
      <AdminReviewsContent />
    </Suspense>
  );
}
