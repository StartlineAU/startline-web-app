"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionItemProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function AccordionItem({ title, icon, children, defaultOpen = false }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-dark-lighter last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left group hover:bg-dark-lighter/20 transition-colors duration-150"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <span className={`flex-shrink-0 transition-colors ${open ? "text-primary" : "text-muted group-hover:text-primary"}`}>
              {icon}
            </span>
          )}
          <span className={`font-headline text-sm font-bold uppercase tracking-widest transition-colors ${open ? "text-primary" : "text-light group-hover:text-primary"}`}>
            {title}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-primary flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* CSS grid trick for smooth height animation without JS measurement */}
      <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="px-6 pb-6 pt-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AccordionGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionGroup({ children, className = "" }: AccordionGroupProps) {
  return (
    <div className={`bg-dark divide-y divide-dark-lighter ${className}`}>
      {children}
    </div>
  );
}
