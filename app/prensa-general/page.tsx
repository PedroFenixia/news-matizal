import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLatestEdition } from "@/lib/storage/editions";
import type { GeneralBriefing } from "@/lib/types";
import { GeneralBriefingView } from "@/components/GeneralBriefingView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prensa general",
  description: "Edición diaria de prensa nacional española, contrastada entre cabeceras.",
  alternates: { canonical: "/prensa-general" },
};

export default function PrensaGeneralHoyPage() {
  const briefing = getLatestEdition("general") as GeneralBriefing | null;

  if (!briefing) {
    notFound();
  }

  return (
    <GeneralBriefingView briefing={briefing} isLatest path="/prensa-general" />
  );
}
