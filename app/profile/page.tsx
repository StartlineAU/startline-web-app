"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { User, Save, Heart, Calendar, MapPin, Clock, Edit2, Check, RefreshCw } from "lucide-react";
import { FitnessEvent, EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatMediumDate, formatTime } from "@/lib/utils";

interface Profile {
  auth0_sub: string;
  role: string;
  full_name: string;
  email: string;
}

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [events, setEvents] = useState<FitnessEvent[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, savedRes, registeredRes, eventsRes] = await Promise.all([
        fetch("/api/user/profile"),
        fetch("/api/user/save-event"),
        fetch("/api/user/register"),
        fetch("/api/events"),
      ]);
      const [profileData, savedData, registeredData, eventsData] = await Promise.all([
        profileRes.json(),
        savedRes.json(),
        registeredRes.json(),
        eventsRes.json(),
      ]);
      setProfile(profileData);
      setNameValue(profileData.full_name ?? "");
      setSavedIds(Array.isArray(savedData) ? savedData : []);
      setRegisteredIds(Array.isArray(registeredData) ? registeredData : []);
      setEvents(Array.isArray(eventsData) ? eventsData : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) loadData();
  }, [authLoading, user, loadData]);

  async function saveName() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: nameValue }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditingName(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-dark-darker flex items-center justify-center pt-20">
        <RefreshCw className="w-6 h-6 text-muted animate-spin" />
      </main>
    );
  }

  const savedEvents = events.filter((e) => savedIds.includes(e.id));
  const registeredEvents = events.filter((e) => registeredIds.includes(e.id));

  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="bg-dark border-b border-dark-lighter">
        <div className="max-w-[1440px] mx-auto px-6 pt-48 pb-12">
          <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4 flex items-center gap-3">
            <span className="w-10 h-px bg-primary inline-block" />
            Your Profile
          </p>
          <div className="flex items-end gap-6">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-dark" />
              )}
            </div>
            <div>
              {editingName ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className="bg-transparent border-b border-primary text-light font-headline text-3xl font-black italic tracking-tighter focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={saveName}
                    disabled={saving}
                    className="text-primary hover:text-light transition-colors"
                  >
                    {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="font-headline text-3xl sm:text-4xl font-black italic tracking-tighter text-light">
                    {profile?.full_name || user?.name || "User"}
                  </h1>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-muted hover:text-primary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mt-1">
                {user?.email} &middot; {profile?.role === "organiser" ? "Organiser" : "Athlete"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-6 py-12" id="saved">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Saved Events */}
          <div className="bg-dark rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Heart className="w-5 h-5 text-primary" />
              <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
                Saved Events
              </h2>
              <span className="ml-auto font-headline text-xs text-muted">{savedEvents.length}</span>
            </div>
            {savedEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted text-sm mb-3">No saved events yet.</p>
                <Link
                  href="/events"
                  className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  Browse Events
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {savedEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-light transition-colors group"
                  >
                    <div className="flex-shrink-0 w-12 text-center">
                      <span className="font-headline text-[10px] uppercase tracking-widest text-primary block">
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-headline text-sm font-bold italic tracking-tighter text-light group-hover:text-primary transition-colors truncate">
                        {event.title}
                      </p>
                      <div className="flex items-center gap-3 text-muted font-headline text-[10px] uppercase tracking-widest mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-primary" />
                          {formatMediumDate(event.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" />
                          {event.city}, {STATE_LABELS[event.state]}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Registered Events */}
          <div className="bg-dark rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Save className="w-5 h-5 text-primary" />
              <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
                Registered Events
              </h2>
              <span className="ml-auto font-headline text-xs text-muted">{registeredEvents.length}</span>
            </div>
            {registeredEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted text-sm mb-3">No registrations yet.</p>
                <Link
                  href="/events"
                  className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  Browse Events
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {registeredEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-light transition-colors group"
                  >
                    <div className="flex-shrink-0 w-12 text-center">
                      <span className="font-headline text-[10px] uppercase tracking-widest text-primary block">
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-headline text-sm font-bold italic tracking-tighter text-light group-hover:text-primary transition-colors truncate">
                        {event.title}
                      </p>
                      <div className="flex items-center gap-3 text-muted font-headline text-[10px] uppercase tracking-widest mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-primary" />
                          {formatMediumDate(event.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-primary" />
                          {formatTime(event.time)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
