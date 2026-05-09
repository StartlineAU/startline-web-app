"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Grid2x2, X } from "lucide-react";

interface HeroImageCarouselProps {
  images: string[];
  alt: string;
}

export function HeroImageCarousel({ images, alt }: HeroImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryActive, setGalleryActive] = useState(0);

  const next = useCallback(() => setCurrent((c) => (c + 1) % images.length), [images.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (images.length <= 1 || paused || galleryOpen) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [images.length, paused, galleryOpen, next]);

  // Close gallery on Escape
  useEffect(() => {
    if (!galleryOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setGalleryOpen(false);
      if (e.key === "ArrowRight") setGalleryActive((c) => (c + 1) % images.length);
      if (e.key === "ArrowLeft")  setGalleryActive((c) => (c - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [galleryOpen, images.length]);

  function openGallery(index: number) {
    setGalleryActive(index);
    setGalleryOpen(true);
  }

  return (
    <>
      {/* ── Carousel ── */}
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

        {/* Prev / Next arrows */}
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

        {/* Dot indicators — top right */}
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

        {/* Show all button — bottom right */}
        <button
          onClick={() => openGallery(current)}
          className="absolute bottom-5 right-6 z-10 flex items-center gap-2 bg-dark/70 backdrop-blur-sm border border-white/10 text-white/70 hover:text-primary hover:border-primary/50 font-headline text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-all duration-150"
        >
          <Grid2x2 className="w-3.5 h-3.5" />
          Show all photos
        </button>
      </div>

      {/* ── Full-screen gallery modal ── */}
      {galleryOpen && (
        <div
          className="fixed inset-0 z-[100] bg-dark-darker/95 backdrop-blur-sm flex flex-col"
          onClick={(e) => { if (e.target === e.currentTarget) setGalleryOpen(false); }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-dark-lighter flex-shrink-0">
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
              {alt} — {images.length} Photos
            </p>
            <button
              onClick={() => setGalleryOpen(false)}
              className="w-9 h-9 rounded-full border border-dark-lighter flex items-center justify-center text-muted hover:text-primary hover:border-primary transition-all"
              aria-label="Close gallery"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Main view + thumbnails */}
          <div className="flex flex-1 overflow-hidden gap-4 p-6">

            {/* Large active image */}
            <div className="flex-1 rounded-3xl overflow-hidden relative">
              <img
                src={images[galleryActive]}
                alt={`${alt} — image ${galleryActive + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Prev/Next on large image */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setGalleryActive((c) => (c - 1 + images.length) % images.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-dark/70 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-primary hover:border-primary/50 transition-all"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setGalleryActive((c) => (c + 1) % images.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-dark/70 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-primary hover:border-primary/50 transition-all"
                    aria-label="Next"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  {/* Counter */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-dark/70 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="font-headline text-xs font-medium text-white/70 uppercase tracking-widest">
                      {galleryActive + 1} / {images.length}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="w-36 flex flex-col gap-3 overflow-y-auto p-2">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryActive(i)}
                    className={`relative flex-shrink-0 aspect-square rounded-xl overflow-hidden transition-all duration-150 ${
                      i === galleryActive
                        ? "outline outline-2 outline-primary outline-offset-2"
                        : "opacity-50 hover:opacity-90"
                    }`}
                  >
                    <img src={src} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
