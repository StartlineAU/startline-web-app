"use client";

import { useEffect, useState } from "react";

const ALL_SECTIONS = [
  { id: "section-basics",       label: "Overview"     },
  { id: "section-datetime",     label: "Date & Venue" },
  { id: "section-categories",   label: "Categories"   },
  { id: "section-registration", label: "Registration" },
  { id: "section-pricing",      label: "Pricing"      },
  { id: "section-prizes",       label: "Prizes"       },
  { id: "section-expo",         label: "Expo"         },
  { id: "section-additional",   label: "Info"         },
];

export function SectionNav({ visibleIds }: { visibleIds: string[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const targets = visibleIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleIds]);

  const sections = ALL_SECTIONS.filter((s) => visibleIds.includes(s.id));

  function handleClick(id: string) {
    // Fire the open-section event so the CollapsibleSection opens itself,
    // then it handles the scroll internally after the animation starts.
    window.dispatchEvent(new CustomEvent("open-section", { detail: { id } }));
    setActive(id);
  }

  return (
    <div className="sticky top-16 z-30 bg-dark-darker py-3">
      <div className="max-w-[1440px] mx-auto px-8">
        <div className="flex justify-center">
          <div className="bg-dark rounded-full px-2 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar border border-dark-lighter">
            {sections.map((section, i) => (
              <button
                key={section.id}
                onClick={() => handleClick(section.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-150 whitespace-nowrap group ${
                  active === section.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:text-light hover:bg-dark-lighter/40"
                }`}
              >
                <span className={`font-headline text-[10px] font-black tracking-widest transition-colors ${active === section.id ? "text-primary" : "text-muted/40 group-hover:text-muted"}`}>
                  0{i + 1}
                </span>
                <span className="font-headline text-xs font-bold uppercase tracking-widest">
                  {section.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
