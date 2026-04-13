"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Bell } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

interface RegisterInterestButtonProps {
  eventId: string;
  eventTitle: string;
}

export default function RegisterInterestButton({ eventId, eventTitle }: RegisterInterestButtonProps) {
  const { user } = useAuth();
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch("/api/user/register")
      .then((r) => r.json())
      .then((ids: string[]) => {
        if (Array.isArray(ids) && ids.includes(eventId)) setRegistered(true);
      })
      .catch(() => {});
  }, [user, eventId]);

  async function handleRegister() {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (registered) return;

    setLoading(true);
    try {
      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, event_title: eventTitle }),
      });
      if (res.ok) setRegistered(true);
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 border border-primary/40 bg-primary/10 text-primary font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 rounded-xl"
      >
        <CheckCircle className="w-4 h-4" />
        Interest Registered
      </button>
    );
  }

  return (
    <button
      onClick={handleRegister}
      disabled={loading}
      className="inline-flex items-center gap-2 border border-primary/40 text-primary font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
    >
      <Bell className="w-4 h-4" />
      {loading ? "Registering..." : "Register Interest"}
    </button>
  );
}
