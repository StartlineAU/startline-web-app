"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { getSavedEventIds, toggleSavedEventId } from "@/lib/client-lists";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SaveEventButtonProps {
  eventId: string;
  className?: string;
  variant?: "icon" | "labeled";
}

export default function SaveEventButton({
  eventId,
  className = "",
  variant = "icon",
}: SaveEventButtonProps) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSaved(getSavedEventIds().includes(eventId));
  }, [eventId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    try {
      const nowSaved = toggleSavedEventId(eventId);
      setSaved(nowSaved);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant === "labeled" ? "outline" : "ghost"}
      size={variant === "labeled" ? "default" : "icon"}
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Unsave event" : "Save event"}
      title={saved ? "Remove from saved" : "Save event"}
      className={cn(
        variant === "labeled"
          ? "w-full font-headline text-[11px] font-bold uppercase tracking-widest gap-2"
          : "h-auto w-auto p-2 rounded-full transition-all",
        saved
          ? variant === "labeled"
            ? "border-primary text-primary bg-primary/10 hover:bg-primary/20"
            : "text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary"
          : variant === "labeled"
            ? "border-dark-lighter text-muted hover:border-primary hover:text-primary"
            : "text-muted hover:text-primary hover:bg-dark-light",
        className
      )}
    >
      <Heart className={cn("w-4 h-4", saved && "fill-primary")} />
      {variant === "labeled" && (saved ? "Saved" : "Save event")}
    </Button>
  );
}
