import type { GeneralBriefing } from "@/lib/types";
import { BriefingHeader } from "./BriefingHeader";
import { ExecutiveSummaryList } from "./ExecutiveSummaryList";
import { SectionBlock } from "./SectionBlock";
import { SectionHeading } from "./SectionHeading";
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
  // Orden real de aparición: Resumen (1), secciones dinámicas B-F (2..n),
  // luego las fijas restantes. El número mostrado es esta posición, no la
  // "key" interna (que sigue usándose solo como id de ancla estable).
  let order = 1;
  const summaryOrder = order++;
  const sectionOrders = briefing.sections.map(() => order++);
  const outletsOrder = order++;
  const articlesOrder = briefing.recommendedArticles.length > 0 ? order++ : null;
  const comparisonOrder = order++;
  const watchOrder = order++;

  const tocEntries: TocEntry[] = [
    { key: "A", title: "Resumen ejecutivo" },
    ...briefing.sections.map((s) => ({ key: s.key, title: s.title })),
    { key: "G", title: "Qué destaca cada cabecera" },
    ...(articlesOrder !== null
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
          title="Edición de prensa española"
          date={briefing.date}
          updatedAt={briefing.updatedAt}
          editionLabel={briefing.editionLabel}
          isDemo={briefing.isDemo}
          isLatest={isLatest}
          path={path}
          revisionSummary={briefing.revisionSummary}
        />
        <div className="-mt-4 mb-8">
          <PriorityFilter />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:gap-12">
        <TableOfContents entries={tocEntries} />

        <div className="min-w-0 max-w-3xl">
          <section id="seccion-A" className="scroll-mt-24 pb-10 border-b border-(--border)">
            <SectionHeading order={summaryOrder} title="Resumen ejecutivo" />
            <ExecutiveSummaryList items={briefing.executiveSummary} />
          </section>

          {briefing.sections.map((section, idx) => (
            <SectionBlock key={section.key} section={section} order={sectionOrders[idx]} />
          ))}

          <section id="seccion-G" className="scroll-mt-24 py-10 border-b border-(--border)">
            <SectionHeading order={outletsOrder} title="Qué destaca cada cabecera" />
            <div className="grid sm:grid-cols-2 gap-4">
              {briefing.newspapers.map((n, idx, arr) => (
                <OutletHighlightCard
                  key={n.outlet}
                  highlight={n}
                  className={idx === arr.length - 1 && arr.length % 2 === 1 ? "sm:col-span-2" : ""}
                />
              ))}
            </div>
          </section>

          {articlesOrder !== null && (
            <section id="seccion-H" className="scroll-mt-24 py-10 border-b border-(--border)">
              <SectionHeading order={articlesOrder} title="Artículo recomendado por cabecera" />
              <div className="grid sm:grid-cols-2 gap-4">
                {briefing.recommendedArticles.map((a, idx, arr) => (
                  <ArticleCard
                    key={idx}
                    article={a}
                    className={idx === arr.length - 1 && arr.length % 2 === 1 ? "sm:col-span-2" : ""}
                  />
                ))}
              </div>
            </section>
          )}

          <section id="seccion-I" className="scroll-mt-24 py-10 border-b border-(--border)">
            <SectionHeading order={comparisonOrder} title="Comparación editorial" />
            <ComparisonTable rows={briefing.comparison} />
          </section>

          <section id="seccion-J" className="scroll-mt-24 py-10">
            <SectionHeading order={watchOrder} title="Qué vigilar hoy" />
            <WatchTodayList items={briefing.watchToday} />
          </section>
        </div>
      </div>
    </div>
  );
}
