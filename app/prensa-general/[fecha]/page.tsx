import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEdition, listDates, getLatestEdition } from "@/lib/storage/editions";
import type { GeneralBriefing } from "@/lib/types";
import { GeneralBriefingView } from "@/components/GeneralBriefingView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ fecha: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { fecha } = await params;
  return {
    title: `Prensa general — ${fecha}`,
    description: `Briefing de prensa española del ${fecha}.`,
    alternates: { canonical: `/prensa-general/${fecha}` },
  };
}

export default async function PrensaGeneralFechaPage({ params }: PageProps) {
  const { fecha } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    notFound();
  }

  const briefing = getEdition("general", fecha) as GeneralBriefing | null;
  if (!briefing) {
    notFound();
  }

  const latest = getLatestEdition("general");
  const isLatest = latest?.date === fecha && latest?.editionId === briefing.editionId;

  return (
    <GeneralBriefingView
      briefing={briefing}
      isLatest={isLatest}
      path={`/prensa-general/${fecha}`}
    />
  );
}

export async function generateStaticParams() {
  try {
    return listDates("general").map((fecha) => ({ fecha }));
  } catch {
    return [];
  }
}
