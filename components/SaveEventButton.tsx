"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { getSavedEventIds, toggleSavedEventId } from "@/lib/client-lists";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SaveEventButtonProps {
  eventId: string;
  className?: string;
}

export default function SaveEventButton({ eventId, className = "" }: SaveEventButtonProps) {
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
      variant="ghost"
      size="icon"
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Unsave event" : "Save event"}
      title={saved ? "Remove from saved" : "Save event"}
      className={cn(
        "h-auto w-auto p-2 rounded-full transition-all",
        saved
          ? "text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary"
          : "text-muted hover:text-primary hover:bg-dark-light",
        className
      )}
    >
      <Heart className={cn("w-4 h-4", saved && "fill-primary")} />
    </Button>
  );
}
