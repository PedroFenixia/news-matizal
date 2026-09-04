import type { GeneralBriefing } from "@/lib/types";
import { BriefingHeader } from "./BriefingHeader";
import { ExecutiveSummaryList } from "./ExecutiveSummaryList";
import { SectionBlock } from "./SectionBlock";
import { OutletHighlightCard } from "./OutletHighlight";
import { ArticleCard } from "./ArticleCard";
import { ComparisonTable } from "./ComparisonTable";
import { WatchTodayList } from "./WatchTodayList";
import { PriorityFilter } from "./PriorityFilter";
import { TableOfContents, type TocEntry } from "./TableOfContents";

export function GeneralBriefingView({
  briefing,
  isLatest,
  path,
}: {
  briefing: GeneralBriefing;
  isLatest: boolean;
  path: string;
}) {
  const tocEntries: TocEntry[] = [
    { key: "A", title: "Resumen ejecutivo" },
    ...briefing.sections.map((s) => ({ key: s.key, title: s.title })),
    { key: "G", title: "Qué destaca cada cabecera" },
    ...(briefing.recommendedArticles.length > 0
      ? [{ key: "H", title: "Artículo recomendado por cabecera" }]
      : []),
    { key: "I", title: "Comparación editorial" },
    { key: "J", title: "Qué vigilar hoy" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
      <div className="max-w-3xl">
        <BriefingHeader
          kicker="Prensa general"
          title="Briefing de prensa española"
          date={briefing.date}
          updatedAt={briefing.updatedAt}
          editionLabel={briefing.editionLabel}
          isDemo={briefing.isDemo}
          isLatest={isLatest}
          path={path}
        />
        <div className="-mt-4 mb-8">
          <PriorityFilter />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:gap-12">
        <TableOfContents entries={tocEntries} />

        <div className="min-w-0 max-w-3xl">
          <section id="seccion-A" className="scroll-mt-24 pb-10 border-b border-(--border)">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="section-mark text-2xl">§ A</span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Resumen ejecutivo
              </h2>
            </div>
            <ExecutiveSummaryList items={briefing.executiveSummary} />
          </section>

          {briefing.sections.map((section) => (
            <SectionBlock key={section.key} section={section} />
          ))}

          <section id="seccion-G" className="scroll-mt-24 py-10 border-b border-(--border)">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="section-mark text-2xl">§ G</span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Qué destaca cada cabecera
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {briefing.newspapers.map((n) => (
                <OutletHighlightCard key={n.outlet} highlight={n} />
              ))}
            </div>
          </section>

          {briefing.recommendedArticles.length > 0 && (
            <section id="seccion-H" className="scroll-mt-24 py-10 border-b border-(--border)">
              <div className="flex items-baseline gap-3 mb-6">
                <span className="section-mark text-2xl">§ H</span>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                  Artículo recomendado por cabecera
                </h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {briefing.recommendedArticles.map((a, idx) => (
                  <ArticleCard key={idx} article={a} />
                ))}
              </div>
            </section>
          )}

          <section id="seccion-I" className="scroll-mt-24 py-10 border-b border-(--border)">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="section-mark text-2xl">§ I</span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Comparación editorial
              </h2>
            </div>
            <ComparisonTable rows={briefing.comparison} />
          </section>

          <section id="seccion-J" className="scroll-mt-24 py-10">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="section-mark text-2xl">§ J</span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Qué vigilar hoy
              </h2>
            </div>
            <WatchTodayList items={briefing.watchToday} />
          </section>
        </div>
      </div>
    </div>
  );
}
