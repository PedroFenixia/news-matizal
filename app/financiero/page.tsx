import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLatestEdition } from "@/lib/storage/editions";
import type { FinancialBriefing } from "@/lib/types";
import { FinancialBriefingView } from "@/components/FinancialBriefingView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Financiero",
  description: "Briefing diario de mercados, macroeconomía y empresas.",
  alternates: { canonical: "/financiero" },
};

export default function FinancieroHoyPage() {
  const briefing = getLatestEdition("financial") as FinancialBriefing | null;

  if (!briefing) {
    notFound();
  }

  return (
    <FinancialBriefingView briefing={briefing} isLatest path="/financiero" />
  );
}
