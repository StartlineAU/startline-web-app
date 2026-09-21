import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getOrganiserSession, getServerSession } from "@/lib/amplify-server";
import { customerHref } from "@/lib/portal-domains";
import OrganiserLandingActions from "@/components/organiser/OrganiserLandingActions";

/**
 * The way into the organiser portal, for anyone who is not already in it.
 *
 * Where it sends you depends only on what you have (#338):
 *   - an organisation, owned or joined -> straight to your dashboard
 *   - signed in with none              -> straight into setting one up
 *   - signed out                       -> this page, to sign in or start one
 */
export default async function OrganiserLandingPage() {
  const session = await getOrganiserSession();
  if (session) redirect("/organiser/dashboard");

  // `/organiser-setup` lives on the athlete site, which is a different host only
  // in production. Every other deployment serves all three portals from one
  // host, where an absolute customer URL points at a hostname that doesn't
  // resolve (issue #302).
  const setupHref = customerHref("/organiser-setup", (await headers()).get("host"));

  // Signed in, but no organisation: this page would only ask them to sign in
  // again. Setting one up is the whole of what is left to do.
  if (await getServerSession()) redirect(setupHref);

  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] text-light mb-4">
          Become an<br /><span className="text-primary">Organiser.</span>
        </h1>
        <p className="text-muted text-[15px] leading-relaxed mb-8">
          Sign up for a free user account, then set up your organiser profile to start publishing events on Australia&apos;s fitness calendar.
        </p>
        <OrganiserLandingActions setupHref={setupHref} />
      </div>
    </main>
  );
}
