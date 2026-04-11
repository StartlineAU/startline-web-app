"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import Link from "next/link";

interface ScrollCarouselProps {
  title: string;
  eyebrow?: string;
  viewAllHref?: string;
  /** Tailwind `top-*` class to vertically centre arrows on the card images.
   *  Calculate as: (card width × image height ratio) / 2.
   *  e.g. 260px card × 0.75 (4/3 aspect) / 2 ≈ "top-[98px]"  */
  arrowTopClass?: string;
  children: React.ReactNode;
}

export function ScrollCarousel({ title, eyebrow, viewAllHref, arrowTopClass = "top-1/2", children }: ScrollCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(true);

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener("scroll", checkScroll, { passive: true });
    // re-check on resize
    window.addEventListener("resize", checkScroll);
    return () => {
      el?.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? el.clientWidth * 0.8 : -el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          {eyebrow && (
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-1">
              {eyebrow}
            </p>
          )}
          <h2 className="font-headline text-3xl font-black italic tracking-tighter text-light">
            {title}
          </h2>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors group"
          >
            View all
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>

      {/* Scrollable row with floating edge arrows */}
      <div className="relative group/carousel">
        {/* Left arrow */}
        <button
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className={`absolute left-0 ${arrowTopClass} -translate-y-1/2 -translate-x-1/2 z-10 w-12 h-12 rounded-full bg-dark border border-dark-lighter flex items-center justify-center text-muted hover:text-primary hover:border-primary shadow-lg transition-all duration-150 ${canLeft ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Right arrow */}
        <button
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className={`absolute right-0 ${arrowTopClass} -translate-y-1/2 translate-x-1/2 z-10 w-12 h-12 rounded-full bg-dark border border-dark-lighter flex items-center justify-center text-muted hover:text-primary hover:border-primary shadow-lg transition-all duration-150 ${canRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto no-scrollbar"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
