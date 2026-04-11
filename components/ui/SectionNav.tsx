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
    <div className="sticky top-16 z-30 bg-dark-darker">
      <div className="max-w-[1440px] mx-auto px-8">
        <div className="bg-dark border-b border-dark-lighter overflow-x-auto">
          <div className="flex items-stretch justify-center gap-0 min-w-max mx-auto">
            {sections.map((section, i) => (
              <button
                key={section.id}
                onClick={() => handleClick(section.id)}
                className={`flex items-center gap-2 px-5 py-3.5 border-b-2 transition-all duration-150 whitespace-nowrap group ${
                  active === section.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-light hover:border-dark-lighter"
                }`}
              >
                <span className={`font-headline text-[10px] font-black tracking-widest transition-colors ${active === section.id ? "text-primary" : "text-muted/50 group-hover:text-muted"}`}>
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
