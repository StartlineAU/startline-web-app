"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

interface SaveEventButtonProps {
  eventId: string;
  className?: string;
}

export default function SaveEventButton({ eventId, className = "" }: SaveEventButtonProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch("/api/user/save-event", { credentials: "include" })
      .then((r) => r.json())
      .then((ids: string[]) => {
        if (Array.isArray(ids) && ids.includes(eventId)) setSaved(true);
      })
      .catch(() => {});
  }, [user, eventId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/save-event", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });
      const data = await res.json();
      setSaved(data.saved);
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
