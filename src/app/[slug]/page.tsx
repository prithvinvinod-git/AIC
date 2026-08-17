import { notFound } from "next/navigation";
import EventPage from "@/components/events/EventPage";
import { EASTER_EGG_SLUGS } from "@/lib/types";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(EASTER_EGG_SLUGS as readonly string[]).includes(slug)) {
    notFound();
  }
  return <EventPage slug={slug} />;
}
