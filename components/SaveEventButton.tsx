"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { getSavedEventIds, toggleSavedEventId } from "@/lib/client-lists";

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
    <button
      onClick={toggle}
      disabled={loading}
      className={`p-2 rounded-full transition-all ${
        saved
          ? "text-primary bg-primary/10 hover:bg-primary/20"
          : "text-muted hover:text-primary hover:bg-dark-light"
      } disabled:opacity-50 ${className}`}
      aria-label={saved ? "Unsave event" : "Save event"}
      title={saved ? "Remove from saved" : "Save event"}
    >
      <Heart className={`w-4 h-4 ${saved ? "fill-primary" : ""}`} />
    </button>
  );
}
