"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, MapPin } from "lucide-react";

export default function HeroSearch() {
  const router = useRouter();
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");

  function handleSearch() {
    const params = new URLSearchParams();
    if (what.trim())  params.set("what", what.trim());
    if (where.trim()) params.set("where", where.trim());
    const qs = params.toString();
    router.push(qs ? `/events?${qs}` : "/events");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  return (
    <div className="w-full mt-10">
      {/* Search bar */}
      <div className="flex items-stretch gap-0.5 bg-dark-darker">

        {/* EVENT input */}
        <div className="flex-1 bg-dark px-6 py-4 border-r border-dark-lighter min-w-0">
          <label className="font-headline text-xs font-black uppercase tracking-widest text-primary block mb-1.5">
            Event
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Event name, type or keyword"
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              onKeyDown={handleKey}
              className="w-full bg-transparent text-light font-headline text-xl placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none"
            />
            {what && (
              <button onClick={() => setWhat("")} className="text-muted hover:text-light flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* WHERE input */}
        <div className="flex-1 bg-dark px-6 py-4 border-r border-dark-lighter min-w-0">
          <label className="font-headline text-xs font-black uppercase tracking-widest text-primary block mb-1.5">
            Where
          </label>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted flex-shrink-0" />
            <input
              type="text"
              placeholder="State, city, or suburb"
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              onKeyDown={handleKey}
              className="w-full bg-transparent text-light font-headline text-xl placeholder:text-muted/40 border-0 focus:ring-0 focus:outline-none"
            />
            {where && (
              <button onClick={() => setWhere("")} className="text-muted hover:text-light flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* CTA button */}
        <button
          onClick={handleSearch}
          className="flex items-center gap-3 bg-primary hover:bg-primary/90 text-dark font-headline text-base font-black uppercase tracking-widest px-10 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all duration-100 active:translate-x-0 active:translate-y-0 flex-shrink-0"
        >
          <Search className="w-5 h-5" />
          Find Events Now
        </button>

      </div>
    </div>
  );
}
