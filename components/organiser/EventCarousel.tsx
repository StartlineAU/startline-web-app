"use client";

import { useRef } from "react";
import { MapPin, ChevronLeft, ChevronRight, Bookmark, BookmarkCheck } from "lucide-react";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

export interface CarouselEvent {
  id: string;
  title: string;
  discipline: string;
  city: string;
  state: string;
  eventDate: string;
  status: EventStatus;
  coverImageUrl?: string | null;
  waves: { price: string }[];
  isPinned?: boolean;
}

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string }> = {
  APPROVED: { bg: "bg-primary/20",  text: "text-primary",  dot: "bg-primary",   label: "LIVE"     },
  PENDING:  { bg: "bg-blue-900/30", text: "text-blue-400", dot: "bg-blue-400",  label: "PENDING"  },
  DRAFT:    { bg: "bg-dark-lighter",text: "text-muted",    dot: "bg-muted",     label: "DRAFT"    },
  REJECTED: { bg: "bg-red-900/30",  text: "text-red-400",  dot: "bg-red-400",   label: "REJECTED" },
  ARCHIVED: { bg: "bg-dark-lighter",text: "text-muted-dark",dot: "bg-muted-dark",label: "ARCHIVED"},
};

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return {
      day:   d.getDate(),
      month: d.toLocaleString("en-AU", { month: "short" }).toUpperCase(),
      year:  d.getFullYear(),
    };
  } catch {
    return { day: "—", month: "", year: new Date().getFullYear() };
  }
}

function getMinPrice(waves: { price: string }[]): string | null {
  if (!waves?.length) return null;
  const prices = waves.map(w => parseFloat(w.price)).filter(p => !isNaN(p) && p > 0);
  if (!prices.length) return null;
  return `From $${Math.min(...prices).toFixed(0)}`;
}

interface Props {
  events: CarouselEvent[];
  pinnedIds: string[];
  isOrganiser?: boolean;
  onPin: (id: string) => void;
}

export default function EventCarousel({ events, pinnedIds, isOrganiser, onPin }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" });
  };

  // Pinned events always float to the front
  const sorted = [
    ...events.filter(e => pinnedIds.includes(e.id)),
    ...events.filter(e => !pinnedIds.includes(e.id)),
  ];

  if (!sorted.length) return null;

  return (
    <div className="relative group/carousel">
      {/* Fade gradients */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-dark-darker to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-dark-darker to-transparent z-10" />

      {/* Nav arrows — visible on hover */}
      {sorted.length > 3 && (
        <>
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-dark border border-dark-lighter hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-all opacity-0 group-hover/carousel:opacity-100 shadow-lg"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-dark border border-dark-lighter hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-all opacity-0 group-hover/carousel:opacity-100 shadow-lg"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {sorted.map(e => {
          const pinned = pinnedIds.includes(e.id);
          const s      = STATUS_STYLE[e.status];
          const date   = formatDate(e.eventDate);
          const price  = getMinPrice(e.waves);
          const pinnable = isOrganiser && (e.status === "APPROVED" || e.status === "PENDING");

          return (
            <div
              key={e.id}
              className={`flex-none w-[272px] bg-dark border rounded-xl overflow-hidden transition-all card-hover ${pinned ? "border-primary/50" : "border-dark-lighter hover:border-primary/40"}`}
            >
              {/* Cover */}
              <div className="relative h-36 overflow-hidden">
                {e.coverImageUrl ? (
                  <img src={e.coverImageUrl} alt={e.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 hero-topo scan-grid" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-dark/10 to-transparent" />

                {/* Status */}
                <div className="absolute top-2.5 left-2.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-headline text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm ${s.bg} ${s.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${e.status === "APPROVED" ? "animate-pulse-dot" : ""}`} />
                    {s.label}
                  </span>
                </div>

                {/* Pinned badge */}
                {pinned && (
                  <div className="absolute top-2.5 right-2.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/90 text-dark font-headline text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm">
                      <BookmarkCheck className="w-2.5 h-2.5" /> Featured
                    </span>
                  </div>
                )}

                {/* Date */}
                <div className="absolute bottom-2 right-3 text-right">
                  <div className="font-headline text-[8px] uppercase tracking-widest text-light/60">{date.month} {date.year}</div>
                  <div className="font-headline text-[22px] font-black italic leading-none text-light drop-shadow">{date.day}</div>
                </div>
              </div>

              {/* Body */}
              <div className="p-3.5">
                <div className="font-headline text-[9px] uppercase tracking-widest text-primary mb-0.5">{e.discipline}</div>
                <div className="font-headline text-[15px] font-black italic tracking-tighter text-light leading-snug mb-2 line-clamp-2">{e.title}</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 font-headline text-[10px] text-muted uppercase tracking-widest">
                    <MapPin className="w-2.5 h-2.5 text-primary shrink-0" />
                    {e.city}, {e.state.toUpperCase()}
                  </div>
                  {price && <span className="font-headline text-[11px] font-bold text-light">{price}</span>}
                </div>

                {/* Pin toggle */}
                {pinnable && (
                  <button
                    onClick={() => onPin(e.id)}
                    className={`mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md font-headline text-[10px] font-bold uppercase tracking-widest transition-colors border ${
                      pinned
                        ? "border-primary/30 bg-primary/10 text-primary hover:bg-red-900/20 hover:border-red-400/30 hover:text-red-400"
                        : "border-dark-lighter text-muted hover:border-primary/40 hover:text-primary"
                    }`}
                  >
                    {pinned ? <Bookmark className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                    {pinned ? "Remove from featured" : "Feature this event"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
