"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  sectionId: string;
  number: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({
  sectionId,
  number,
  title,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Listen for nav-triggered opens from SectionNav
  useEffect(() => {
    function handleOpen(e: Event) {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      if (id === sectionId) {
        setOpen(true);
        // Scroll after the animation has a moment to start
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = wrapperRef.current;
            if (!el) return;
            const offset = el.getBoundingClientRect().top + window.scrollY - 120;
            window.scrollTo({ top: offset, behavior: "smooth" });
          });
        });
      }
    }
    window.addEventListener("open-section", handleOpen);
    return () => window.removeEventListener("open-section", handleOpen);
  }, [sectionId]);

  return (
    <div ref={wrapperRef} className="border-t border-dark-lighter">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between pt-8 pb-6 group"
      >
        <div className="flex items-center gap-4">
          <span className="font-headline text-xs font-black tracking-widest text-primary uppercase">
            {number}
          </span>
          <h2 className={`font-headline text-xs font-black tracking-widest uppercase transition-colors ${open ? "text-light" : "text-muted group-hover:text-light"}`}>
            {title}
          </h2>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-primary flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="pb-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
