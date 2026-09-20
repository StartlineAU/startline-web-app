"use client";

import { useEffect, useRef } from "react";

const VIDEO_SRC = "/videos/hero.mp4?v=6";
const POSTER_SRC = "/videos/hero-poster.jpg?v=6";

export default function HeroCarousel() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (motion.matches) {
        video.pause();
        video.currentTime = 0;
      } else {
        video.play().catch(() => {
          // Autoplay blocked — poster stays visible.
        });
      }
    };

    sync();
    motion.addEventListener("change", sync);
    return () => motion.removeEventListener("change", sync);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          filter: "brightness(0.70)",
          objectPosition: "50% 60%",
          WebkitMaskImage: "linear-gradient(to bottom, #000 70%, transparent)",
          maskImage: "linear-gradient(to bottom, #000 70%, transparent)",
        }}
        src={VIDEO_SRC}
        poster={POSTER_SRC}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        disablePictureInPicture
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-r from-darker/75 via-darker/50 to-darker/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-darker from-[12%] via-transparent to-darker/35" />
    </div>
  );
}
