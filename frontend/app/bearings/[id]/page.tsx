import { BearingDetailPage } from "@/components/pages/bearing-detail-page";

export default async function BearingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <BearingDetailPage bearingId={decodeURIComponent(id)} />;
}
