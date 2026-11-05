import { Suspense } from "react";
import CheckInScreen from "@/components/checkin/CheckInScreen";
import { Skeleton } from "@/components/ui/skeleton";

export default async function DirectCheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ registration?: string }>;
}) {
  const { eventId } = await params;
  const { registration } = await searchParams;

  return (
    <Suspense fallback={
      <main className="min-h-screen bg-dark-darker">
        <div className="max-w-[480px] mx-auto px-4 py-16 space-y-4">
          <Skeleton className="h-12 w-12 rounded-xl mx-auto" />
          <Skeleton className="h-6 w-2/3 mx-auto" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </main>
    }>
      <CheckInScreen eventId={eventId} registrationId={registration ?? null} />
    </Suspense>
  );
}
