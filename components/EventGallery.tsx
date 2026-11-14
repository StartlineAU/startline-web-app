"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function EventGallery({ images, title }: { images: string[]; title: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const close = useCallback(() => setLightbox(null), []);
  const prev = useCallback(() => setLightbox(i => (i === null ? i : (i + images.length - 1) % images.length)), [images.length]);
  const next = useCallback(() => setLightbox(i => (i === null ? i : (i + 1) % images.length)), [images.length]);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, close, prev, next]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightbox(i)}
            className="relative aspect-video rounded-xl overflow-hidden bg-dark group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Image
              src={src}
              alt={`${title} — photo ${i + 1}`}
              fill
              unoptimized={src.startsWith("blob:")}
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
          </button>
        ))}
      </div>

      {lightbox !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center" onClick={close}>
          <button
            type="button"
            onClick={close}
            aria-label="Close gallery"
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-dark/70 text-muted hover:text-light flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); prev(); }}
                aria-label="Previous photo"
                className="absolute left-2 sm:left-4 z-10 w-11 h-11 rounded-full bg-dark/70 text-muted hover:text-light flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); next(); }}
                aria-label="Next photo"
                className="absolute right-2 sm:right-4 z-10 w-11 h-11 rounded-full bg-dark/70 text-muted hover:text-light flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="relative w-full h-full max-w-6xl max-h-[85vh] m-4" onClick={e => e.stopPropagation()}>
            <Image
              src={images[lightbox]}
              alt={`${title} — photo ${lightbox + 1}`}
              fill
              unoptimized={images[lightbox].startsWith("blob:")}
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>

          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 font-headline text-xs font-medium uppercase tracking-widest text-muted">
            {lightbox + 1} / {images.length}
          </span>
        </div>
      )}
    </>
  );
}
