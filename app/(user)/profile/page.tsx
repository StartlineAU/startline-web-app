import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";
import ProfileServerView, {
  PROFILE_USER_SELECT,
  type ProfileUser,
} from "@/components/profile/ProfileServerView";

export default async function ProfilePage() {
  const session = await getUserSession();

  if (!session) {
    return (
      <main className="min-h-screen bg-dark-darker pt-20">
        <section className="max-w-[1440px] mx-auto px-6 py-24 text-center">
          <h1 className="font-headline text-3xl font-black tracking-tighter text-light mb-4">
            Sign in to see your profile
          </h1>
          <p className="font-headline text-sm text-muted mb-8">
            Save events, track registrations, and manage your account.
          </p>
        </section>
      </main>
    );
  }

  // `session.sub` is a Prisma User id resolved from the verified Cognito
  // subject. Never look the row up by email: that would show whichever
  // account owns the address to anyone who can present it.
  const resolved = (await prisma.user.findUnique({
    where: { id: session.sub },
    select: PROFILE_USER_SELECT,
  })) as ProfileUser | null;
  if (!resolved) return null;

  // Users without a handle can't reach /profile/{username}, so render their
  // own profile directly by id.
  if (!resolved.username) {
    return <ProfileServerView user={resolved} isOwner />;
  }

  redirect(`/profile/${resolved.username}`);
}
