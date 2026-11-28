import ScanTicketsClient from "./ScanTicketsClient";

export default async function ScanTicketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ScanTicketsClient eventId={id} />;
}
