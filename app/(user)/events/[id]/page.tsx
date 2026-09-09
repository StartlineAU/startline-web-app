import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EventDetailView from "@/components/event/EventDetailView";
import { getAllEvents, getPublicEventById } from "@/lib/events";
import { getEventDetail } from "@/lib/event-detail";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const events = await getAllEvents();
    return events.flatMap((e: { id: string; slug: string | null }) =>
      e.slug ? [{ id: e.id }, { id: e.slug }] : [{ id: e.id }],
    );
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const found = await getPublicEventById(id);
  if (!found) return { title: "Event" };

  const title = found.title;
  const description =
    found.description?.replace(/<[^>]+>/g, "").slice(0, 160) ||
    `${found.title} — ${found.city}, ${found.state.toUpperCase()}`;
  const image = found.coverImageUrl || undefined;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://startlineau.com"}/events/${found.slug ?? id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/**
 * The screen itself lives in EventDetailView, which the events listing also
 * renders beside its results (issue #309).
 */
export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getEventDetail(id);
  if (!detail) notFound();

  return (
    <main className="min-h-screen bg-dark-darker pt-14">
      <EventDetailView data={detail} />
    </main>
  );
}
