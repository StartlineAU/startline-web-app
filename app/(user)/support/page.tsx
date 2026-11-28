import { redirect } from "next/navigation";

/**
 * The old Support address. Refunds are the only thing it ever handled, so it
 * now lives at `/refunds`; links in emails already sent still land here, with
 * the entry or event they were for.
 */
export default async function SupportRedirect({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[]; registration?: string | string[] }>;
}) {
  const { event, registration } = await searchParams;
  const query = new URLSearchParams();
  if (typeof registration === "string") query.set("registration", registration);
  if (typeof event === "string") query.set("event", event);
  const qs = query.toString();
  redirect(qs ? `/refunds?${qs}` : "/refunds");
}
