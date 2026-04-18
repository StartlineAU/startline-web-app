"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Bell } from "lucide-react";
import { addRegisteredInterest, getRegisteredEventIds } from "@/lib/client-lists";

interface RegisterInterestButtonProps {
  eventId: string;
}

export default function RegisterInterestButton({ eventId }: RegisterInterestButtonProps) {
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRegistered(getRegisteredEventIds().includes(eventId));
  }, [eventId]);

  function handleRegister() {
    if (registered) return;

    setLoading(true);
    try {
      if (addRegisteredInterest(eventId)) {
        setRegistered(true);
      }
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
