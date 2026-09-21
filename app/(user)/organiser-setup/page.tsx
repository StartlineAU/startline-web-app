import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOrganiserSession } from "@/lib/amplify-server";
import { organiserHref } from "@/lib/portal-domains";
import OrganiserSetupForm from "@/components/organiser/OrganiserSetupForm";

/**
 * "Become an organiser".
 *
 * Anyone who already owns or belongs to an organisation is sent to their
 * organiser portal rather than being offered the setup form. Submitting it
 * never created a second organisation — the route returns the existing one —
 * but it asked for details it then ignored (#338).
 */
export default async function OrganiserSetupPage() {
  const session = await getOrganiserSession();
  if (session) redirect(organiserHref("/organiser/dashboard", (await headers()).get("host")));

  return <OrganiserSetupForm />;
}
