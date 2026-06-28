import Link from "next/link";
import { ArrowLeft, User, Trophy, History } from "lucide-react";
import { LevelBadge } from "@/components/profile/LevelBadge";
import { RegistrationList } from "@/components/profile/RegistrationList";
import type { LevelProgress } from "@/lib/user-level";
import type { UserRegistrationEvent } from "@/lib/user-registrations";

interface PublicProfilePageProps {
  params: Promise<{ username: string }>;
}

async function getProfile(username: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/user/profile/${username}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

interface Profile {
  id: string;
  name: string | null;
  username: string;
  bio: string | null;
  profilePicUrl: string | null;
  isPublic: boolean;
  gamification: LevelProgress;
  registrations: {
    upcoming: UserRegistrationEvent[];
    past: UserRegistrationEvent[];
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const profile: Profile | null = await getProfile(username);

  if (!profile) {
    return (
      <main className="min-h-screen bg-dark-darker flex items-center justify-center pt-20">
        <div className="text-center">
          <User className="w-16 h-16 text-muted mx-auto mb-4" />
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light mb-2">
            Profile not found
          </h1>
          <p className="text-muted text-sm mb-6">This user doesn&apos;t exist or their profile is private.</p>
          <Link href="/" className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const initial = profile.name?.[0]?.toUpperCase() ?? profile.username[0].toUpperCase();

  return (
    <main className="min-h-screen bg-dark-darker pt-20">
      <div className="max-w-[720px] mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 font-headline text-xs uppercase tracking-widest text-muted hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        <div className="bg-dark rounded-2xl border border-dark-lighter p-8">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="font-headline text-3xl font-black text-dark">{initial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-headline text-2xl font-black italic tracking-tighter text-light">
                {profile.name ?? profile.username}
              </h1>
              <p className="font-headline text-xs uppercase tracking-widest text-muted mt-1">
                @{profile.username}
              </p>
              {profile.bio && (
                <p className="text-muted text-sm mt-3 leading-relaxed">{profile.bio}</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <LevelBadge gamification={profile.gamification} compact />
          </div>
        </div>

        {(profile.registrations.upcoming.length > 0 || profile.registrations.past.length > 0) && (
          <div className="mt-8 space-y-8">
            {profile.registrations.upcoming.length > 0 && (
              <section>
                <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> Upcoming events
                </h2>
                <div className="bg-dark rounded-xl border border-dark-lighter p-6">
                  <RegistrationList
                    registrations={profile.registrations.upcoming}
                    emptyTitle=""
                    emptyDescription=""
                  />
                </div>
              </section>
            )}

            {profile.registrations.past.length > 0 && (
              <section>
                <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                  <History className="w-4 h-4" /> Event history
                </h2>
                <div className="bg-dark rounded-xl border border-dark-lighter p-6">
                  <RegistrationList
                    registrations={profile.registrations.past}
                    emptyTitle=""
                    emptyDescription=""
                  />
                </div>
              </section>
            )}
          </div>
        )}

        {profile.registrations.upcoming.length === 0 && profile.registrations.past.length === 0 && (
          <p className="text-muted text-sm text-center mt-8">
            No public event history yet.
          </p>
        )}
      </div>
    </main>
  );
}
