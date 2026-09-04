import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEdition, listDates, getLatestEdition } from "@/lib/storage/editions";
import type { FinancialBriefing } from "@/lib/types";
import { FinancialBriefingView } from "@/components/FinancialBriefingView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ fecha: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { fecha } = await params;
  return {
    title: `Financiero — ${fecha}`,
    description: `Briefing de mercados y economía del ${fecha}.`,
    alternates: { canonical: `/financiero/${fecha}` },
  };
}

export default async function FinancieroFechaPage({ params }: PageProps) {
  const { fecha } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    notFound();
  }

  const briefing = getEdition("financial", fecha) as FinancialBriefing | null;
  if (!briefing) {
    notFound();
  }

  const latest = getLatestEdition("financial");
  const isLatest = latest?.date === fecha && latest?.editionId === briefing.editionId;

  return (
    <FinancialBriefingView
      briefing={briefing}
      isLatest={isLatest}
      path={`/financiero/${fecha}`}
    />
  );
}

export async function generateStaticParams() {
  try {
    return listDates("financial").map((fecha) => ({ fecha }));
  } catch {
    return [];
  }
}
