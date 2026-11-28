import { redirect } from "next/navigation";

/**
 * The old Support address. Refunds are the only thing it ever handled, so it
 * now lives at `/refunds`; links in emails already sent still land here.
 */
export default async function SupportRedirect({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const { event } = await searchParams;
  redirect(typeof event === "string" ? `/refunds?event=${encodeURIComponent(event)}` : "/refunds");
}
