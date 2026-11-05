import CheckInScreen from "@/components/checkin/CheckInScreen";

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ eventId: string; shortCode: string }>;
}) {
  const { eventId, shortCode } = await params;
  return <CheckInScreen eventId={eventId} shortCode={shortCode} />;
}
