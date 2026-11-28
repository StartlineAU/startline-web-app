"use client";

import { useMemo, useState } from "react";
import { Edit2, EyeOff } from "lucide-react";
import UserProfileView, {
  type ProfileRaceHistory,
} from "@/components/profile/UserProfileView";
import { useSettings } from "@/context/SettingsContext";

export type PublicProfileData = {
  username: string;
  /** Heading text: the handle, or a fallback for owners who have not set one. */
  displayName: string;
  bio: string | null;
  profilePicUrl: string | null;
  history: ProfileRaceHistory;
};

type Props = {
  profile: PublicProfileData;
  isOwner: boolean;
};

export default function ProfilePageClient({ profile, isOwner }: Props) {
  const { open } = useSettings();
  const [removed, setRemoved] = useState<string[]>([]);

  const history = useMemo<ProfileRaceHistory>(() => {
    if (removed.length === 0) return profile.history;
    const registrations = profile.history.registrations.filter((r) => !removed.includes(r.id));
    return { completed: registrations.filter((r) => r.phase === "ended").length, registrations };
  }, [profile.history, removed]);

  return (
    <UserProfileView
      displayName={profile.displayName}
      bio={profile.bio}
      profilePicUrl={profile.profilePicUrl}
      history={history}
      cardFooter={
        isOwner
          ? (reg) => (
              <RemoveFromProfile
                registrationId={reg.id}
                eventTitle={reg.event.title}
                onRemoved={() => setRemoved((prev) => [...prev, reg.id])}
              />
            )
          : undefined
      }
      headerActions={
        isOwner ? (
          <button
            type="button"
            onClick={() => open("profile")}
            className="inline-flex items-center gap-2 shrink-0 bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
          >
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </button>
        ) : undefined
      }
    />
  );
}

/* The owner's way back from a wrong "Me" ticket or a race added by mistake
   (#598). The entry itself is untouched: it stays in Activity and with the
   organiser, and can be added again from there. */
function RemoveFromProfile({
  registrationId,
  eventTitle,
  onRemoved,
}: {
  registrationId: string;
  eventTitle: string;
  onRemoved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/user/registrations/${registrationId}/claim`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Couldn't remove this race. Try again.");
        return;
      }
      onRemoved();
    } catch {
      setError("Couldn't remove this race. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const button =
    "inline-flex items-center gap-1.5 h-8 px-2 font-headline text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 mt-1.5" data-testid="remove-from-profile">
      {error && <p className="text-[12px] text-red-400 mr-auto" role="alert">{error}</p>}
      {confirming ? (
        <>
          <span className="text-[12px] text-muted">Take {eventTitle} off your profile?</span>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={`${button} text-muted hover:text-light`}>
            Cancel
          </button>
          <button type="button" onClick={remove} disabled={busy} className={`${button} text-red-400 hover:text-red-300`}>
            {busy ? "Removing" : "Remove"}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={`${button} text-muted-dark hover:text-light`}>
          <EyeOff className="w-3.5 h-3.5" /> Remove from my profile
        </button>
      )}
    </div>
  );
}
