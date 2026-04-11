"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HeroImageCarouselProps {
  images: string[];
  alt: string;
}

export function HeroImageCarousel({ images, alt }: HeroImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setCurrent((c) => (c + 1) % images.length), [images.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (images.length <= 1 || paused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [images.length, paused, next]);

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={`${alt} — image ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover brightness-50 transition-opacity duration-1000 ease-in-out ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Prev / Next arrows — appear on hover */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous image"
            className="absolute left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-dark/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/60 hover:text-primary hover:border-primary/50 transition-all duration-150 opacity-0 group-hover/hero:opacity-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            aria-label="Next image"
            className="absolute right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-dark/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/60 hover:text-primary hover:border-primary/50 transition-all duration-150 opacity-0 group-hover/hero:opacity-100"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dot indicators — top right, subtle */}
      {images.length > 1 && (
        <div className="absolute top-5 right-6 z-10 flex items-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to image ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-5 h-1.5 bg-primary"
                  : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
