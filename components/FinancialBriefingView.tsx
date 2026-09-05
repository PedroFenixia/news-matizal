import type { FinancialBriefing } from "@/lib/types";
import { BriefingHeader } from "./BriefingHeader";
import { ExecutiveSummaryList } from "./ExecutiveSummaryList";
import { SectionBlock } from "./SectionBlock";
import { SectionHeading } from "./SectionHeading";
import { OutletHighlightCard } from "./OutletHighlight";
import { ArticleCard } from "./ArticleCard";
import { ComparisonTable } from "./ComparisonTable";
import { WatchTodayList } from "./WatchTodayList";
import { PriorityBadge } from "./PriorityBadge";
import { SourceList } from "./SourceLink";
import { PriorityFilter } from "./PriorityFilter";
import { TableOfContents, type TocEntry } from "./TableOfContents";
import { RevisionTagBadge } from "./RevisionTagBadge";

export function FinancialBriefingView({
  briefing,
  isLatest,
  path,
}: {
  briefing: FinancialBriefing;
  isLatest: boolean;
  path: string;
}) {
  let order = 1;
  const summaryOrder = order++;
  const sectionOrders = briefing.sections.map(() => order++);
  const businessImpactOrder = order++;
  const outletsOrder = order++;
  const comparisonOrder = order++;
  const watchOrder = order++;
  const articlesOrder = briefing.recommendedArticles.length > 0 ? order++ : null;

  const tocEntries: TocEntry[] = [
    { key: "A", title: "Resumen ejecutivo" },
    ...briefing.sections.map((s) => ({ key: s.key, title: s.title })),
    { key: "K", title: "Impacto empresarial" },
    { key: "L", title: "Qué destaca cada medio" },
    { key: "M", title: "Comparación editorial" },
    { key: "N", title: "Qué vigilar hoy" },
    ...(articlesOrder !== null
      ? [{ key: "O", title: "Artículos recomendados" }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
      <div className="max-w-3xl">
        <BriefingHeader
          kicker="Financiero"
          title="Edición de mercados y economía"
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

          <section id="seccion-K" className="scroll-mt-24 py-10 border-b border-(--border)">
            <SectionHeading order={businessImpactOrder} title="Impacto empresarial" />
            {briefing.businessImpact.length === 0 ? (
              <p className="text-(--muted) text-sm italic">Sin material suficiente hoy.</p>
            ) : (
              <div className="flex flex-col gap-8">
                {briefing.businessImpact.map((item) => (
                  <article key={item.id} data-priority={item.priority} className="priority-item flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <PriorityBadge level={item.priority} />
                      <RevisionTagBadge tag={item.revisionTag} />
                    </div>
                    <h3 className="font-serif text-xl font-medium leading-snug">
                      {item.headline}
                    </h3>
                    <p className="text-(--ink-2) leading-relaxed text-justify max-w-2xl">{item.body}</p>
                    <SourceList sources={item.sources} />
                  </article>
                ))}
              </div>
            )}
          </section>

          <section id="seccion-L" className="scroll-mt-24 py-10 border-b border-(--border)">
            <SectionHeading order={outletsOrder} title="Qué destaca cada medio" />
            <div className="grid sm:grid-cols-2 gap-4">
              {briefing.outlets.map((o, idx, arr) => (
                <OutletHighlightCard
                  key={o.outlet}
                  highlight={o}
                  className={idx === arr.length - 1 && arr.length % 2 === 1 ? "sm:col-span-2" : ""}
                />
              ))}
            </div>
          </section>

          <section id="seccion-M" className="scroll-mt-24 py-10 border-b border-(--border)">
            <SectionHeading order={comparisonOrder} title="Comparación editorial" />
            <ComparisonTable rows={briefing.comparison} />
          </section>

          <section id="seccion-N" className="scroll-mt-24 py-10 border-b border-(--border)">
            <SectionHeading order={watchOrder} title="Qué vigilar hoy" />
            <WatchTodayList items={briefing.watchToday} />
          </section>

          {articlesOrder !== null && (
            <section id="seccion-O" className="scroll-mt-24 py-10">
              <SectionHeading order={articlesOrder} title="Artículos recomendados" />
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
        </div>
      </div>
    </div>
  );
}
