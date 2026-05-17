"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";

interface Props {
  photos: string[];
  isOrganiser?: boolean;
}

export default function PhotoCarousel({ photos, isOrganiser }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -340 : 340, behavior: "smooth" });
  };

  if (!photos.length && !isOrganiser) return null;

  return (
    <>
      <div className="relative group/photos">
        {/* Nav arrows */}
        {photos.length > 4 && (
          <>
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-dark border border-dark-lighter hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-all opacity-0 group-hover/photos:opacity-100 shadow-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-dark border border-dark-lighter hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-all opacity-0 group-hover/photos:opacity-100 shadow-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {photos.length === 0 ? (
          /* Empty state — only shown to organiser */
          <div className="border border-dashed border-dark-lighter rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center">
            <ImageIcon className="w-8 h-8 text-muted-dark opacity-50" />
            <div>
              <div className="font-headline text-[13px] font-bold text-light">No photos yet</div>
              <div className="text-[12px] text-muted mt-0.5">Add photos from your past events to showcase your work.</div>
            </div>
            <button className="font-headline text-[11px] font-bold uppercase tracking-widest text-dark bg-machined shadow-machined px-4 py-2 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform">
              Upload photos
            </button>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            {photos.map((src, i) => (
              <button
                key={i}
                onClick={() => setLightbox(src)}
                className="flex-none w-[320px] h-[220px] rounded-lg overflow-hidden border border-dark-lighter hover:border-primary/50 transition-all group/photo card-hover"
              >
                <img
                  src={src}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300"
                />
              </button>
            ))}

            {/* Upload more — organiser only */}
            {isOrganiser && (
              <button className="flex-none w-[320px] h-[220px] rounded-lg border border-dashed border-dark-lighter hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-dark-lighter group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <ImageIcon className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                </div>
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted group-hover:text-primary transition-colors">Add photo</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-dark-darker/95 backdrop-blur-sm flex items-center justify-center p-4 overlay-in"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-dark border border-dark-lighter hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox}
            alt="Event photo"
            className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
