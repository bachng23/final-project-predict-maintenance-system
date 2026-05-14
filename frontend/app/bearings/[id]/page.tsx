import { redirect } from "next/navigation";

export default async function BearingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/agents?bearing=${encodeURIComponent(decodeURIComponent(id))}`);
}
