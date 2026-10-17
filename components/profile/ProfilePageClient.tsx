"use client";

import { Edit2 } from "lucide-react";
import UserProfileView, {
  type ProfileRaceHistory,
} from "@/components/profile/UserProfileView";
import { useSettings } from "@/context/SettingsContext";

export type PublicProfileData = {
  username: string;
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

  return (
    <UserProfileView
      username={profile.username}
      bio={profile.bio}
      profilePicUrl={profile.profilePicUrl}
      history={profile.history}
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
