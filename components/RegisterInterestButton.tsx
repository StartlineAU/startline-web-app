"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Bell } from "lucide-react";
import { addRegisteredInterest, getRegisteredEventIds } from "@/lib/client-lists";

import { Button } from "@/components/ui/button";

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

  const sharedClass =
    "border-primary/40 text-primary hover:text-primary px-6 py-3 h-auto rounded-xl";

  if (registered) {
    return (
      <Button variant="outline" disabled className={`${sharedClass} bg-primary/10`}>
        <CheckCircle className="w-4 h-4" />
        Interest Registered
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleRegister}
      disabled={loading}
      className={`${sharedClass} bg-transparent hover:bg-primary/10 transition-colors`}
    >
      <Bell className="w-4 h-4" />
      {loading ? "Registering..." : "Register Interest"}
    </Button>
  );
}
