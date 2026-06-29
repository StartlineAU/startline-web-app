import Link from "next/link";
import { Calendar, MapPin, ArrowLeft, User } from "lucide-react";

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
  registrations: {
    eventId: string;
    event: {
      basics: { title: string } | null;
      schedule: { eventDate: string; city: string; state: string } | null;
    };
  }[];
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
        </div>

        {profile.registrations.length > 0 && (
          <section className="mt-8">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4">
              Events attended
            </h2>
            <div className="space-y-2">
              {profile.registrations.map((reg) => (
                <Link
                  key={reg.eventId}
                  href={`/events/${reg.eventId}`}
                  className="flex items-center gap-4 p-4 bg-dark rounded-xl hover:bg-dark-light transition-colors group"
                >
                  <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-headline text-sm font-bold italic tracking-tighter text-light group-hover:text-primary transition-colors truncate">
                      {reg.event.basics?.title}
                    </p>
                    <div className="flex items-center gap-3 text-muted font-headline text-[10px] uppercase tracking-widest mt-0.5">
                      <span>{reg.event.schedule?.eventDate}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {reg.event.schedule?.city}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
